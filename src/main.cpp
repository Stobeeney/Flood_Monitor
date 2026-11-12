#include <Arduino.h>
#include <WebServer.h>
#include <WiFi.h>
#include "config.h"
#include "dashboard.h"

namespace {
constexpr uint8_t kEchoPin = 34;
constexpr uint8_t kTrigPin = 32;
constexpr unsigned long kEchoTimeoutUs = 30000;
constexpr unsigned long kReadIntervalMs = 1000;
WebServer server(80);
float distanceCm = 0;
bool validReading = false;
unsigned long lastReadMs = 0;

void sendStatus() {
  String json = "{\"distance_cm\":";
  json += validReading ? String(distanceCm, 1) : String("null");
  json += ",\"ap_ip\":\"" + WiFi.softAPIP().toString() + "\"}";
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}
}

void setup() {
  Serial.begin(115200);
  pinMode(kEchoPin, INPUT);  // GPIO 34 is input-only, with no internal pull resistors.
  pinMode(kTrigPin, OUTPUT);
  digitalWrite(kTrigPin, LOW);
  delay(100);
  Serial.println("Flood monitor ready: ECHO=GPIO34, TRIG=GPIO32");
  WiFi.persistent(false);
  WiFi.mode(WIFI_AP);
  const IPAddress apIP(192, 168, 4, 1);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));
  if (WiFi.softAP(AP_SSID, AP_PASSWORD)) {
    Serial.printf("Direct dashboard: connect to %s, then open http://%s\n",
                  AP_SSID, WiFi.softAPIP().toString().c_str());
  } else {
    Serial.println("Could not start dashboard access point. Check AP configuration.");
  }
  server.on("/", HTTP_GET, []() {
    server.send_P(200, "text/html", DASHBOARD_HTML);
  });
  server.on("/api/status", HTTP_GET, sendStatus);
  server.onNotFound([]() { server.send(404, "text/plain", "Not found"); });
  server.begin();
  lastReadMs = millis() - kReadIntervalMs;
}

void loop() {
  server.handleClient();
  const unsigned long now = millis();
  if (now - lastReadMs < kReadIntervalMs) {
    delay(1);
    return;
  }
  lastReadMs = now;
  digitalWrite(kTrigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(kTrigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(kTrigPin, LOW);

  const unsigned long durationUs = pulseIn(kEchoPin, HIGH, kEchoTimeoutUs);
  validReading = durationUs != 0;
  if (durationUs == 0) {
    Serial.println("No echo received: check wiring or sensor range.");
  } else {
    distanceCm = durationUs * 0.0343f / 2.0f;
    Serial.printf("Distance to surface: %.1f cm\n", distanceCm);
  }
}
