#include <Arduino.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>

#include "config.h"
#include "dashboard.h"
#include "ds1302_rtc.h"
#include "gsm_air780e.h"
#include "lcd_i2c.h"
#include "pins.h"

namespace {
constexpr unsigned long kJsnTimeoutUs = 30000UL;
constexpr unsigned long kHcTimeoutUs = 25000UL;
constexpr unsigned long kReadIntervalMs = 1000UL;
constexpr unsigned long kGsmRetryIntervalMs = 15000UL;
constexpr unsigned long kWifiRetryIntervalMs = 20000UL;
constexpr unsigned long kCloudPushIntervalMs = 5000UL;
constexpr long kPhGmtOffsetSec = 8 * 3600;  // Asia/Manila UTC+8

constexpr float kJsnMinReliableCm = 25.0f;
constexpr float kJsnMaxRangeCm = 450.0f;
constexpr float kHcMinRangeCm = 2.0f;
constexpr float kHcMaxRangeCm = 400.0f;
constexpr uint8_t kConfirmSamples = 2;

enum class SensorSource { kNone, kJsnSr04t, kHcSr04 };
enum class FloodLevel { kNormal, kWarning, kFloodAlert };

WebServer server(80);
Preferences prefs;
Ds1302Rtc rtc(pins::kRtcClk, pins::kRtcDat, pins::kRtcRst);
Lcd16x2I2c lcd;
Air780eGsm gsm(Serial2, pins::kGsmRx, pins::kGsmTx, 115200);

// Saved Wi-Fi STA & Supabase cloud settings (persisted in NVS flash)
String savedWifiSsid;
String savedWifiPass;
String savedSupabaseUrl;
String savedSupabaseKey;
String savedStationId = "santolan";
float savedMountHeightCm = 180.0f;

bool ntpSynced = false;
int lastCloudHttpCode = 0;

float jsnDistanceCm = -1.0f;
float hcDistanceCm = -1.0f;
float fusedDistanceCm = 0.0f;
bool validReading = false;
SensorSource activeSource = SensorSource::kNone;
FloodLevel floodLevel = FloodLevel::kNormal;
FloodLevel pendingLevel = FloodLevel::kNormal;
uint8_t pendingCount = 0;

RtcDateTime currentRtc{};
unsigned long lastReadMs = 0;
unsigned long lastGsmProbeMs = 0;
unsigned long lastWifiAttemptMs = 0;
unsigned long lastCloudPushMs = 0;
unsigned long lastSmsMs = 0;
bool hasSentSms = false;
String serialCmdBuffer;

const char* sensorLabel(SensorSource src) {
  switch (src) {
    case SensorSource::kJsnSr04t:
      return "JSN-SR04T";
    case SensorSource::kHcSr04:
      return "HC-SR04";
    default:
      return "NONE";
  }
}

const char* levelLabel(FloodLevel level, bool hasValid) {
  if (!hasValid) {
    return "NO_ECHO";
  }
  switch (level) {
    case FloodLevel::kFloodAlert:
      return "FLOOD_ALERT";
    case FloodLevel::kWarning:
      return "WARNING";
    default:
      return "NORMAL";
  }
}

const char* supabaseAlertLevel(FloodLevel level) {
  switch (level) {
    case FloodLevel::kFloodAlert:
      return "RED";
    case FloodLevel::kWarning:
      return "ORANGE";
    default:
      return "GREEN";
  }
}

const char* levelShortLabel(FloodLevel level, bool hasValid) {
  if (!hasValid) {
    return "NO_ECHO";
  }
  switch (level) {
    case FloodLevel::kFloodAlert:
      return "ALERT!";
    case FloodLevel::kWarning:
      return "WARN";
    default:
      return "NORMAL";
  }
}

void updatePiezo() {
  const unsigned long now = millis();
  bool buzzerOn = false;
  if (floodLevel == FloodLevel::kFloodAlert) {
    buzzerOn = (now % 800UL) < 400UL;
  } else if (floodLevel == FloodLevel::kWarning) {
    buzzerOn = (now % 2000UL) < 150UL;
  }
  digitalWrite(pins::kPiezo, buzzerOn ? HIGH : LOW);
}

void idleService() {
  server.handleClient();
  updatePiezo();
}

void serviceDelayMs(unsigned long durationMs) {
  const unsigned long start = millis();
  while (millis() - start < durationMs) {
    idleService();
    delay(2);
  }
}

void loadSettings() {
  prefs.begin("floodcfg", true);
  savedWifiSsid = prefs.getString("ssid", "");
  savedWifiPass = prefs.getString("pass", "");
  savedSupabaseUrl = prefs.getString("sb_url", "");
  savedSupabaseKey = prefs.getString("sb_key", "");
  savedStationId = prefs.getString("station", "santolan");
  savedMountHeightCm = prefs.getFloat("mount_cm", 180.0f);
  prefs.end();
}

void startStaConnect() {
  if (savedWifiSsid.isEmpty()) {
    return;
  }
  Serial.printf("Connecting to Wi-Fi STA: %s\n", savedWifiSsid.c_str());
  WiFi.begin(savedWifiSsid.c_str(), savedWifiPass.c_str());
  lastWifiAttemptMs = millis();
}

bool syncTimeFromNtpToRtc() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  configTime(kPhGmtOffsetSec, 0, "pool.ntp.org", "time.nist.gov");
  struct tm timeinfo{};
  if (!getLocalTime(&timeinfo, 4000)) {
    Serial.println("NTP sync timed out; will retry later.");
    return false;
  }

  RtcDateTime dt{};
  dt.year = static_cast<uint16_t>(timeinfo.tm_year + 1900);
  dt.month = static_cast<uint8_t>(timeinfo.tm_mon + 1);
  dt.day = static_cast<uint8_t>(timeinfo.tm_mday);
  dt.hour = static_cast<uint8_t>(timeinfo.tm_hour);
  dt.minute = static_cast<uint8_t>(timeinfo.tm_min);
  dt.second = static_cast<uint8_t>(timeinfo.tm_sec);
  if (rtc.setDateTime(dt)) {
    currentRtc = dt;
    ntpSynced = true;
    Serial.printf("NTP synced -> DS1302 RTC set to %s (UTC+8)\n",
                  dt.formatIso().c_str());
    return true;
  }
  return false;
}

bool isCloudConfigured() {
  return savedSupabaseUrl.startsWith("https://") &&
         savedSupabaseKey.length() > 20;
}

void pushReadingToSupabase() {
  if (!validReading || WiFi.status() != WL_CONNECTED || !isCloudConfigured()) {
    return;
  }

  String endpoint = savedSupabaseUrl;
  if (endpoint.endsWith("/")) {
    endpoint.remove(endpoint.length() - 1);
  }
  endpoint += "/rest/v1/flood_readings";

  const float waterDepthCm =
      max(0.0f, savedMountHeightCm - fusedDistanceCm);

  String payload = "{\"station_id\":\"";
  payload += savedStationId;
  payload += "\",\"raw_distance_cm\":";
  payload += String(fusedDistanceCm, 1);
  payload += ",\"water_depth_cm\":";
  payload += String(waterDepthCm, 1);
  payload += ",\"alert_level\":\"";
  payload += supabaseAlertLevel(floodLevel);
  payload += "\",\"source\":\"ESP32\"}";

  WiFiClientSecure client;
  client.setInsecure();  // Simplifies TLS for ESP32->Supabase REST HTTPS.
  HTTPClient http;
  http.setTimeout(4000);
  if (http.begin(client, endpoint)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", savedSupabaseKey);
    http.addHeader("Authorization", "Bearer " + savedSupabaseKey);
    http.addHeader("Prefer", "return=minimal");
    lastCloudHttpCode = http.POST(payload);
    http.end();
    Serial.printf("Supabase POST -> HTTP %d (%s)\n", lastCloudHttpCode,
                  payload.c_str());
  }
}

float readUltrasonicCm(uint8_t trigPin, uint8_t echoPin,
                       uint16_t triggerPulseUs, unsigned long timeoutUs) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(triggerPulseUs);
  digitalWrite(trigPin, LOW);

  const unsigned long durationUs = pulseIn(echoPin, HIGH, timeoutUs);
  if (durationUs == 0) {
    return -1.0f;
  }
  return durationUs * 0.0343f / 2.0f;
}

void fuseReadings(float jsnCm, float hcCm) {
  const bool hcValid = (hcCm >= kHcMinRangeCm && hcCm <= kHcMaxRangeCm);
  const bool jsnValid = (jsnCm >= kJsnMinReliableCm && jsnCm <= kJsnMaxRangeCm);

  if (hcValid && hcCm < kJsnMinReliableCm) {
    fusedDistanceCm = hcCm;
    activeSource = SensorSource::kHcSr04;
    validReading = true;
    return;
  }
  if (jsnValid) {
    fusedDistanceCm = jsnCm;
    activeSource = SensorSource::kJsnSr04t;
    validReading = true;
    return;
  }
  if (hcValid) {
    fusedDistanceCm = hcCm;
    activeSource = SensorSource::kHcSr04;
    validReading = true;
    return;
  }

  activeSource = SensorSource::kNone;
  validReading = false;
}

FloodLevel evaluateTargetLevel(float distanceCm, FloodLevel current) {
  if (distanceCm <= ALERT_DISTANCE_CM) {
    return FloodLevel::kFloodAlert;
  }
  if (current == FloodLevel::kFloodAlert &&
      distanceCm < ALERT_DISTANCE_CM + CLEAR_HYSTERESIS_CM) {
    return FloodLevel::kFloodAlert;
  }
  if (distanceCm <= WARNING_DISTANCE_CM) {
    return FloodLevel::kWarning;
  }
  if (current == FloodLevel::kWarning &&
      distanceCm < WARNING_DISTANCE_CM + CLEAR_HYSTERESIS_CM) {
    return FloodLevel::kWarning;
  }
  return FloodLevel::kNormal;
}

void maybeSendAlertSms(FloodLevel previous, FloodLevel next) {
  const bool isEscalation =
      (next == FloodLevel::kWarning || next == FloodLevel::kFloodAlert);
  const bool isRecovery = (previous == FloodLevel::kFloodAlert ||
                           previous == FloodLevel::kWarning) &&
                          next == FloodLevel::kNormal;
  if (!isEscalation && !isRecovery) {
    return;
  }
  if (!Air780eGsm::isPhoneConfigured(ALERT_PHONE_NUMBER)) {
    return;
  }

  const unsigned long now = millis();
  if (hasSentSms && (now - lastSmsMs < SMS_COOLDOWN_MS) &&
      next != FloodLevel::kFloodAlert) {
    return;
  }

  String msg = "FLOOD MONITOR [";
  msg += levelLabel(next, true);
  msg += "] ";
  msg += currentRtc.formatIso();
  msg += " | Dist: ";
  msg += String(fusedDistanceCm, 1);
  msg += " cm (";
  msg += sensorLabel(activeSource);
  msg += ")";

  Serial.printf("Sending SMS to %s: %s\n", ALERT_PHONE_NUMBER, msg.c_str());
  if (gsm.sendSms(ALERT_PHONE_NUMBER, msg)) {
    lastSmsMs = millis();
    hasSentSms = true;
    Serial.println("SMS sent successfully.");
  } else {
    Serial.println("SMS failed; check Air780E power, SIM, and signal.");
  }
}

void updateFloodState() {
  if (!validReading) {
    return;
  }
  const FloodLevel target = evaluateTargetLevel(fusedDistanceCm, floodLevel);
  if (target == floodLevel) {
    pendingLevel = floodLevel;
    pendingCount = 0;
    return;
  }

  if (target == pendingLevel) {
    ++pendingCount;
  } else {
    pendingLevel = target;
    pendingCount = 1;
  }

  if (pendingCount >= kConfirmSamples) {
    const FloodLevel previous = floodLevel;
    floodLevel = target;
    pendingCount = 0;
    maybeSendAlertSms(previous, floodLevel);
    pushReadingToSupabase();
    lastCloudPushMs = millis();
  }
}

void updateLcdDisplay() {
  if (!lcd.isConnected()) {
    return;
  }
  char line0[17];
  if (validReading) {
    snprintf(line0, sizeof(line0), "Dist: %5.1f cm  ", fusedDistanceCm);
  } else {
    snprintf(line0, sizeof(line0), "Dist:  --.- cm  ");
  }

  char line1[17];
  snprintf(line1, sizeof(line1), "%s %-7s",
           currentRtc.formatShortTime().c_str(),
           levelShortLabel(floodLevel, validReading));

  lcd.updateLine(0, line0);
  lcd.updateLine(1, line1);
}

void handleSerialCommands() {
  while (Serial.available()) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\r') {
      continue;
    }
    if (c != '\n') {
      if (serialCmdBuffer.length() < 64) {
        serialCmdBuffer += c;
      }
      continue;
    }

    serialCmdBuffer.trim();
    if (serialCmdBuffer.startsWith("SET_TIME ")) {
      RtcDateTime dt{};
      int yr = 0, mo = 0, dy = 0, hr = 0, mn = 0, sc = 0;
      if (sscanf(serialCmdBuffer.c_str() + 9, "%d-%d-%d %d:%d:%d", &yr, &mo,
                 &dy, &hr, &mn, &sc) == 6) {
        dt.year = static_cast<uint16_t>(yr);
        dt.month = static_cast<uint8_t>(mo);
        dt.day = static_cast<uint8_t>(dy);
        dt.hour = static_cast<uint8_t>(hr);
        dt.minute = static_cast<uint8_t>(mn);
        dt.second = static_cast<uint8_t>(sc);
        if (rtc.setDateTime(dt)) {
          Serial.printf("RTC updated to %s\n", dt.formatIso().c_str());
        } else {
          Serial.println("Invalid date/time values.");
        }
      } else {
        Serial.println("Usage: SET_TIME YYYY-MM-DD HH:MM:SS");
      }
    }
    serialCmdBuffer = "";
  }
}

String escapeJson(const String& s) {
  String out;
  out.reserve(s.length() + 4);
  for (size_t i = 0; i < s.length(); ++i) {
    const char c = s[i];
    if (c == '"' || c == '\\') {
      out += '\\';
    }
    out += c;
  }
  return out;
}

void sendStatus() {
  const bool staConnected = WiFi.status() == WL_CONNECTED;
  String json = "{\"distance_cm\":";
  json += validReading ? String(fusedDistanceCm, 1) : String("null");
  json += ",\"jsn_cm\":";
  json += (jsnDistanceCm > 0) ? String(jsnDistanceCm, 1) : String("null");
  json += ",\"hc_cm\":";
  json += (hcDistanceCm > 0) ? String(hcDistanceCm, 1) : String("null");
  json += ",\"sensor\":\"";
  json += sensorLabel(activeSource);
  json += "\",\"status\":\"";
  json += levelLabel(floodLevel, validReading);
  json += "\",\"rtc_time\":\"";
  json += currentRtc.formatIso();
  json += "\",\"gsm_ready\":";
  json += gsm.isReady() ? "true" : "false";
  json += ",\"wifi_connected\":";
  json += staConnected ? "true" : "false";
  json += ",\"wifi_ssid\":\"";
  json += escapeJson(savedWifiSsid);
  json += "\",\"sta_ip\":\"";
  json += staConnected ? WiFi.localIP().toString() : String("");
  json += "\",\"ntp_synced\":";
  json += ntpSynced ? "true" : "false";
  json += ",\"cloud_configured\":";
  json += isCloudConfigured() ? "true" : "false";
  json += ",\"cloud_last_code\":";
  json += String(lastCloudHttpCode);
  json += ",\"sb_url\":\"";
  json += escapeJson(savedSupabaseUrl);
  json += "\",\"station_id\":\"";
  json += escapeJson(savedStationId);
  json += "\",\"mount_cm\":";
  json += String(savedMountHeightCm, 0);
  json += ",\"ap_ip\":\"" + WiFi.softAPIP().toString() + "\"}";

  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}

void handleWifiScan() {
  const int count = WiFi.scanNetworks();
  String json = "[";
  for (int i = 0; i < count; ++i) {
    if (i > 0) {
      json += ",";
    }
    json += "{\"ssid\":\"";
    json += escapeJson(WiFi.SSID(i));
    json += "\",\"rssi\":";
    json += String(WiFi.RSSI(i));
    json += "}";
  }
  json += "]";
  WiFi.scanDelete();
  server.send(200, "application/json", json);
}

void handleWifiSave() {
  if (!server.hasArg("ssid")) {
    server.send(400, "text/plain", "Missing ssid");
    return;
  }
  savedWifiSsid = server.arg("ssid");
  savedWifiSsid.trim();
  savedWifiPass = server.arg("pass");

  prefs.begin("floodcfg", false);
  prefs.putString("ssid", savedWifiSsid);
  prefs.putString("pass", savedWifiPass);
  prefs.end();

  ntpSynced = false;
  WiFi.disconnect(false);
  delay(100);
  startStaConnect();
  server.send(200, "text/plain",
              "Saved! Connecting to " + savedWifiSsid +
                  " (NTP time will sync automatically once connected).");
}

void handleNtpSync() {
  if (WiFi.status() != WL_CONNECTED) {
    server.send(400, "text/plain", "Connect ESP32 to Wi-Fi first.");
    return;
  }
  if (syncTimeFromNtpToRtc()) {
    server.send(200, "text/plain",
                "RTC synced to " + currentRtc.formatIso() + " (UTC+8).");
  } else {
    server.send(500, "text/plain", "NTP sync failed; check internet access.");
  }
}

void handleCloudSave() {
  const String url = server.arg("url");
  const String key = server.arg("key");
  const String station = server.arg("station_id");
  const String mountStr = server.arg("mount_cm");

  prefs.begin("floodcfg", false);
  if (!url.isEmpty()) {
    savedSupabaseUrl = url;
    prefs.putString("sb_url", savedSupabaseUrl);
  }
  if (!key.isEmpty()) {
    savedSupabaseKey = key;
    prefs.putString("sb_key", savedSupabaseKey);
  }
  if (!station.isEmpty()) {
    savedStationId = station;
    prefs.putString("station", savedStationId);
  }
  const float parsedMount = mountStr.toFloat();
  if (parsedMount >= 50.0f && parsedMount <= 450.0f) {
    savedMountHeightCm = parsedMount;
    prefs.putFloat("mount_cm", savedMountHeightCm);
  }
  prefs.end();

  lastCloudHttpCode = 0;
  server.send(200, "text/plain",
              "Cloud settings saved! ESP32 will push live data for station '" +
                  savedStationId + "' to Supabase.");
}
}  // namespace

void setup() {
  Serial.begin(115200);

  pinMode(pins::kJsnEcho, INPUT);
  pinMode(pins::kJsnTrig, OUTPUT);
  digitalWrite(pins::kJsnTrig, LOW);

  pinMode(pins::kHcEcho, INPUT);
  pinMode(pins::kHcTrig, OUTPUT);
  digitalWrite(pins::kHcTrig, LOW);

  pinMode(pins::kPiezo, OUTPUT);
  digitalWrite(pins::kPiezo, LOW);

  loadSettings();

  rtc.begin();
  currentRtc = rtc.now();

  if (lcd.begin(pins::kI2cSda, pins::kI2cScl, LCD_I2C_ADDR)) {
    Serial.printf("LCD 16x2 detected at I2C 0x%02X\n", lcd.address());
    lcd.updateLine(0, "Flood Monitor");
    lcd.updateLine(1, "WiFi Setup...");
  } else {
    Serial.println("LCD 16x2 I2C not detected (check SDA=21, SCL=22, 5V).");
  }

  gsm.setIdleCallback(idleService);
  if (gsm.begin()) {
    Serial.println("Air780E GSM ready.");
  } else {
    Serial.println("Air780E not ready yet (will retry in background).");
  }

  // Run AP + STA together so http://192.168.4.1 setup portal is always available
  WiFi.persistent(false);
  WiFi.mode(WIFI_AP_STA);
  const IPAddress apIP(192, 168, 4, 1);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));
  if (WiFi.softAP(AP_SSID, AP_PASSWORD)) {
    Serial.printf("Local setup portal: connect to %s -> http://%s\n", AP_SSID,
                  WiFi.softAPIP().toString().c_str());
  }
  startStaConnect();

  server.on("/", HTTP_GET, []() {
    server.send_P(200, "text/html", DASHBOARD_HTML);
  });
  server.on("/api/status", HTTP_GET, sendStatus);
  server.on("/api/wifi/scan", HTTP_GET, handleWifiScan);
  server.on("/api/wifi/save", HTTP_POST, handleWifiSave);
  server.on("/api/ntp/sync", HTTP_POST, handleNtpSync);
  server.on("/api/cloud/save", HTTP_POST, handleCloudSave);
  server.onNotFound([]() { server.send(404, "text/plain", "Not found"); });
  server.begin();

  Serial.printf("Flood monitor ready (%s). Tip: SET_TIME YYYY-MM-DD HH:MM:SS\n",
                currentRtc.formatIso().c_str());
  lastReadMs = millis() - kReadIntervalMs;
}

void loop() {
  idleService();
  handleSerialCommands();

  const unsigned long now = millis();

  // Maintain Wi-Fi STA connection & auto-sync NTP -> DS1302 RTC once connected
  if (!savedWifiSsid.isEmpty()) {
    if (WiFi.status() == WL_CONNECTED) {
      if (!ntpSynced) {
        syncTimeFromNtpToRtc();
      }
    } else if (now - lastWifiAttemptMs >= kWifiRetryIntervalMs) {
      startStaConnect();
    }
  }

  if (!gsm.isReady() && (now - lastGsmProbeMs >= kGsmRetryIntervalMs)) {
    lastGsmProbeMs = now;
    if (gsm.probeAndConfigure()) {
      Serial.println("Air780E GSM came online.");
    }
  }

  if (now - lastReadMs < kReadIntervalMs) {
    delay(2);
    return;
  }
  lastReadMs = now;

  // Trigger sequentially with a 35 ms gap to prevent ultrasonic crosstalk.
  hcDistanceCm = readUltrasonicCm(pins::kHcTrig, pins::kHcEcho, 10, kHcTimeoutUs);
  serviceDelayMs(35);
  jsnDistanceCm =
      readUltrasonicCm(pins::kJsnTrig, pins::kJsnEcho, 20, kJsnTimeoutUs);

  fuseReadings(jsnDistanceCm, hcDistanceCm);
  currentRtc = rtc.now();
  updateFloodState();
  updateLcdDisplay();
  updatePiezo();

  // Push live telemetry to Supabase every 5 seconds for the Vercel dashboard
  if (now - lastCloudPushMs >= kCloudPushIntervalMs) {
    lastCloudPushMs = now;
    pushReadingToSupabase();
  }

  if (validReading) {
    Serial.printf("[%s] Dist: %.1f cm (%s) | JSN=%.1f HC=%.1f | %s\n",
                  currentRtc.formatIso().c_str(), fusedDistanceCm,
                  sensorLabel(activeSource), jsnDistanceCm, hcDistanceCm,
                  levelLabel(floodLevel, validReading));
  } else {
    Serial.printf("[%s] No echo received from JSN-SR04T or HC-SR04.\n",
                  currentRtc.formatIso().c_str());
  }
}
