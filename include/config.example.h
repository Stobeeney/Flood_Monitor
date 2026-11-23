#pragma once
#include <Arduino.h>

// ESP32 access point credentials. Users connect directly to this network.
constexpr char AP_SSID[] = "FloodMonitor";
constexpr char AP_PASSWORD[] = "floodmonitor";

// Air780E SMS alert recipient (international format, e.g., "+639171234567").
// Leave as "+639XXXXXXXXX" or "" to disable SMS sending until configured.
constexpr char ALERT_PHONE_NUMBER[] = "+639XXXXXXXXX";

// Flood distance thresholds (smaller distance = water is closer to the sensor).
// Calibrate these values for your installation height.
constexpr float WARNING_DISTANCE_CM = 50.0f;
constexpr float ALERT_DISTANCE_CM = 25.0f;
constexpr float CLEAR_HYSTERESIS_CM = 5.0f;

// Minimum interval between consecutive SMS alerts (milliseconds).
constexpr unsigned long SMS_COOLDOWN_MS = 300000UL;  // 5 minutes

// LCD 16x2 I2C address: set to 0x00 to auto-detect (tries 0x27 then 0x3F).
constexpr uint8_t LCD_I2C_ADDR = 0x00;
