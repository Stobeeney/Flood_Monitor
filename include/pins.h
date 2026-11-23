#pragma once
#include <Arduino.h>

namespace pins {
// JSN-SR04T v3 (Mode 0: M1 and M2 pads left open) - normal/long range (>= 25 cm)
constexpr uint8_t kJsnTrig = 32;
constexpr uint8_t kJsnEcho = 34;  // Input-only GPIO; use 5V->3.3V voltage divider.

// HC-SR04 - close/minimum range (< 25 cm, inside JSN-SR04T blind zone)
constexpr uint8_t kHcTrig = 33;
constexpr uint8_t kHcEcho = 35;   // Input-only GPIO; use 5V->3.3V voltage divider.

// MH-Real-Time Clock Module 2 (DS1302 3-wire serial, power module from 3.3V)
constexpr uint8_t kRtcClk = 25;
constexpr uint8_t kRtcDat = 26;   // Bidirectional data pin (must support INPUT & OUTPUT).
constexpr uint8_t kRtcRst = 27;

// LCD 16x2 I2C (PCF8574 backpack)
constexpr uint8_t kI2cSda = 21;
constexpr uint8_t kI2cScl = 22;

// Active piezo buzzer (driven directly without MOSFET; use 100-220 ohm series resistor)
constexpr uint8_t kPiezo = 23;

// Air780E 4G LTE/GSM module (UART2)
constexpr uint8_t kGsmRx = 16;    // Connect to Air780E TXD
constexpr uint8_t kGsmTx = 17;    // Connect to Air780E RXD
}  // namespace pins
