#pragma once
#include <Arduino.h>

// Non-blocking-friendly AT command driver for the Air780E 4G LTE/GSM module.
class Air780eGsm {
 public:
  using IdleCallback = void (*)();

  Air780eGsm(HardwareSerial& serial, uint8_t rxPin, uint8_t txPin,
             uint32_t baud = 115200)
      : serial_(serial), rxPin_(rxPin), txPin_(txPin), baud_(baud) {}

  void setIdleCallback(IdleCallback cb) { idleCb_ = cb; }

  bool begin() {
    serial_.begin(baud_, SERIAL_8N1, rxPin_, txPin_);
    delay(100);
    return probeAndConfigure();
  }

  bool isReady() const { return ready_; }

  bool probeAndConfigure() {
    if (!sendCommand("AT", "OK", 800)) {
      ready_ = false;
      return false;
    }
    sendCommand("ATE0", "OK", 500);
    if (!sendCommand("AT+CMGF=1", "OK", 800)) {
      ready_ = false;
      return false;
    }
    sendCommand("AT+CSCS=\"GSM\"", "OK", 500);
    ready_ = true;
    return true;
  }

  static bool isPhoneConfigured(const char* phone) {
    if (phone == nullptr || phone[0] == '\0') {
      return false;
    }
    // Treat template placeholder "+639XXXXXXXXX" as unconfigured.
    return strchr(phone, 'X') == nullptr;
  }

  bool sendSms(const char* phoneNumber, const String& message) {
    if (!isPhoneConfigured(phoneNumber)) {
      return false;
    }
    if (!ready_ && !probeAndConfigure()) {
      return false;
    }

    drainInput();
    serial_.print("AT+CMGS=\"");
    serial_.print(phoneNumber);
    serial_.print("\"\r");

    if (!waitForToken(">", 3000)) {
      // Cancel any partial SMS prompt cleanly.
      serial_.write(0x1B);
      ready_ = false;
      return false;
    }

    serial_.print(message);
    serial_.write(0x1A);  // Ctrl+Z sends the SMS.

    const bool ok = waitForToken("OK", 10000);
    if (!ok) {
      ready_ = false;
    }
    return ok;
  }

 private:
  HardwareSerial& serial_;
  uint8_t rxPin_;
  uint8_t txPin_;
  uint32_t baud_;
  bool ready_ = false;
  IdleCallback idleCb_ = nullptr;

  void drainInput() {
    while (serial_.available()) {
      serial_.read();
    }
  }

  bool sendCommand(const char* cmd, const char* expected,
                   unsigned long timeoutMs) {
    drainInput();
    serial_.print(cmd);
    serial_.print("\r");
    return waitForToken(expected, timeoutMs);
  }

  bool waitForToken(const char* token, unsigned long timeoutMs) {
    String buffer;
    buffer.reserve(128);
    const unsigned long startMs = millis();

    while (millis() - startMs < timeoutMs) {
      while (serial_.available()) {
        const char c = static_cast<char>(serial_.read());
        buffer += c;
        if (buffer.indexOf(token) >= 0) {
          return true;
        }
        if (buffer.indexOf("ERROR") >= 0) {
          return false;
        }
        if (buffer.length() > 256) {
          buffer.remove(0, 128);
        }
      }
      if (idleCb_ != nullptr) {
        idleCb_();
      }
      delay(5);
    }
    return false;
  }
};
