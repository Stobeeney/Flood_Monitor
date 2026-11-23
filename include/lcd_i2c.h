#pragma once
#include <Arduino.h>
#include <Wire.h>

// Lightweight PCF8574-based 16x2 I2C LCD driver with address auto-detection.
class Lcd16x2I2c {
 public:
  bool begin(uint8_t sdaPin, uint8_t sclPin, uint8_t preferredAddr = 0x00) {
    Wire.begin(sdaPin, sclPin);
    Wire.setClock(100000);
    delay(50);

    addr_ = detectAddress(preferredAddr);
    connected_ = (addr_ != 0);
    if (!connected_) {
      return false;
    }

    // HD44780 4-bit initialization sequence over PCF8574.
    writeExpander(kBacklight);
    delay(50);

    write4Bits(0x30);
    delayMicroseconds(4500);
    write4Bits(0x30);
    delayMicroseconds(4500);
    write4Bits(0x30);
    delayMicroseconds(150);
    write4Bits(0x20);  // Switch to 4-bit mode.

    sendCommand(0x28);  // 4-bit, 2 lines, 5x8 font.
    sendCommand(0x0C);  // Display ON, cursor OFF, blink OFF.
    sendCommand(0x01);  // Clear display.
    delay(2);
    sendCommand(0x06);  // Entry mode: increment, no display shift.

    lastLine_[0] = "";
    lastLine_[1] = "";
    return true;
  }

  bool isConnected() const { return connected_; }
  uint8_t address() const { return addr_; }

  void updateLine(uint8_t row, const String& text) {
    if (!connected_ || row > 1) {
      return;
    }
    char buf[17];
    memset(buf, ' ', 16);
    buf[16] = '\0';
    const size_t len = min(text.length(), static_cast<size_t>(16));
    memcpy(buf, text.c_str(), len);

    const String padded(buf);
    if (padded == lastLine_[row]) {
      return;
    }
    lastLine_[row] = padded;

    sendCommand(row == 0 ? 0x80 : 0xC0);
    for (uint8_t i = 0; i < 16; ++i) {
      sendData(static_cast<uint8_t>(buf[i]));
    }
  }

 private:
  static constexpr uint8_t kRs = 0x01;
  static constexpr uint8_t kEn = 0x04;
  static constexpr uint8_t kBacklight = 0x08;

  uint8_t addr_ = 0;
  bool connected_ = false;
  String lastLine_[2];

  static bool probeAddress(uint8_t addr) {
    Wire.beginTransmission(addr);
    return Wire.endTransmission() == 0;
  }

  static uint8_t detectAddress(uint8_t preferredAddr) {
    if (preferredAddr != 0) {
      return probeAddress(preferredAddr) ? preferredAddr : 0;
    }
    if (probeAddress(0x27)) {
      return 0x27;
    }
    if (probeAddress(0x3F)) {
      return 0x3F;
    }
    return 0;
  }

  void writeExpander(uint8_t data) {
    Wire.beginTransmission(addr_);
    Wire.write(data | kBacklight);
    Wire.endTransmission();
  }

  void pulseEnable(uint8_t data) {
    writeExpander(data | kEn);
    delayMicroseconds(1);
    writeExpander(data & ~kEn);
    delayMicroseconds(50);
  }

  void write4Bits(uint8_t nibble) {
    writeExpander(nibble);
    pulseEnable(nibble);
  }

  void sendByte(uint8_t value, uint8_t mode) {
    const uint8_t highNibble = (value & 0xF0) | mode;
    const uint8_t lowNibble = ((value << 4) & 0xF0) | mode;
    write4Bits(highNibble);
    write4Bits(lowNibble);
  }

  void sendCommand(uint8_t cmd) { sendByte(cmd, 0); }
  void sendData(uint8_t data) { sendByte(data, kRs); }
};
