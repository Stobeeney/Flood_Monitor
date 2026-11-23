#pragma once
#include <Arduino.h>

struct RtcDateTime {
  uint16_t year;
  uint8_t month;
  uint8_t day;
  uint8_t hour;
  uint8_t minute;
  uint8_t second;

  bool isValid() const {
    return year >= 2024 && year <= 2099 && month >= 1 && month <= 12 &&
           day >= 1 && day <= 31 && hour <= 23 && minute <= 59 && second <= 59;
  }

  String formatIso() const {
    char buf[20];
    snprintf(buf, sizeof(buf), "%04u-%02u-%02u %02u:%02u:%02u", year, month,
             day, hour, minute, second);
    return String(buf);
  }

  String formatShortTime() const {
    char buf[9];
    snprintf(buf, sizeof(buf), "%02u:%02u:%02u", hour, minute, second);
    return String(buf);
  }
};

// Lightweight 3-wire DS1302 driver for MH-Real-Time Clock Module 2.
class Ds1302Rtc {
 public:
  Ds1302Rtc(uint8_t clkPin, uint8_t datPin, uint8_t rstPin)
      : clkPin_(clkPin), datPin_(datPin), rstPin_(rstPin) {}

  void begin() {
    pinMode(rstPin_, OUTPUT);
    pinMode(clkPin_, OUTPUT);
    pinMode(datPin_, OUTPUT);
    digitalWrite(rstPin_, LOW);
    digitalWrite(clkPin_, LOW);
    delayMicroseconds(10);

    // Ensure clock is running if valid, or seed from firmware compile time.
    const uint8_t rawSec = readRegister(0x81);
    const bool clockHalted = (rawSec & 0x80) != 0;
    const RtcDateTime current = now();
    if (clockHalted || !current.isValid()) {
      setDateTime(compileDateTime());
    }
  }

  RtcDateTime now() {
    RtcDateTime dt{};
    const uint8_t secRaw = readRegister(0x81);
    const uint8_t minRaw = readRegister(0x83);
    const uint8_t hourRaw = readRegister(0x85);
    const uint8_t dayRaw = readRegister(0x87);
    const uint8_t monthRaw = readRegister(0x89);
    const uint8_t yearRaw = readRegister(0x8D);

    dt.second = bcdToDec(secRaw & 0x7F);
    dt.minute = bcdToDec(minRaw & 0x7F);
    if (hourRaw & 0x80) {
      // Convert 12-hour register format if previously configured that way.
      const uint8_t hr12 = bcdToDec(hourRaw & 0x1F);
      const bool isPm = (hourRaw & 0x20) != 0;
      dt.hour = (hr12 % 12) + (isPm ? 12 : 0);
    } else {
      dt.hour = bcdToDec(hourRaw & 0x3F);
    }
    dt.day = bcdToDec(dayRaw & 0x3F);
    dt.month = bcdToDec(monthRaw & 0x1F);
    dt.year = 2000 + bcdToDec(yearRaw);
    return dt;
  }

  bool setDateTime(const RtcDateTime& dt) {
    if (!dt.isValid()) {
      return false;
    }
    writeRegister(0x8E, 0x00);  // Clear write-protect bit.
    writeRegister(0x80, decToBcd(dt.second) & 0x7F);  // CH=0 starts clock.
    writeRegister(0x82, decToBcd(dt.minute));
    writeRegister(0x84, decToBcd(dt.hour) & 0x3F);    // 24-hour mode.
    writeRegister(0x86, decToBcd(dt.day));
    writeRegister(0x88, decToBcd(dt.month));
    writeRegister(0x8A, 1);                           // Day of week (1-7).
    writeRegister(0x8C, decToBcd(static_cast<uint8_t>(dt.year - 2000)));
    writeRegister(0x8E, 0x80);  // Re-enable write-protect.
    return true;
  }

  static RtcDateTime compileDateTime() {
    RtcDateTime dt{2026, 1, 1, 0, 0, 0};
    const char* dateStr = __DATE__;  // "Mmm dd yyyy"
    const char* timeStr = __TIME__;  // "hh:mm:ss"

    static constexpr const char* kMonths[] = {"Jan", "Feb", "Mar", "Apr",
                                              "May", "Jun", "Jul", "Aug",
                                              "Sep", "Oct", "Nov", "Dec"};
    for (uint8_t i = 0; i < 12; ++i) {
      if (strncmp(dateStr, kMonths[i], 3) == 0) {
        dt.month = i + 1;
        break;
      }
    }
    dt.day = static_cast<uint8_t>(atoi(dateStr + 4));
    dt.year = static_cast<uint16_t>(atoi(dateStr + 7));
    dt.hour = static_cast<uint8_t>(atoi(timeStr));
    dt.minute = static_cast<uint8_t>(atoi(timeStr + 3));
    dt.second = static_cast<uint8_t>(atoi(timeStr + 6));
    return dt;
  }

 private:
  uint8_t clkPin_;
  uint8_t datPin_;
  uint8_t rstPin_;

  static uint8_t bcdToDec(uint8_t bcd) {
    return ((bcd >> 4) * 10) + (bcd & 0x0F);
  }

  static uint8_t decToBcd(uint8_t dec) {
    return static_cast<uint8_t>(((dec / 10) << 4) | (dec % 10));
  }

  void startTransaction() {
    digitalWrite(clkPin_, LOW);
    digitalWrite(rstPin_, LOW);
    delayMicroseconds(4);
    digitalWrite(rstPin_, HIGH);
    delayMicroseconds(4);
  }

  void endTransaction() {
    digitalWrite(clkPin_, LOW);
    digitalWrite(rstPin_, LOW);
    delayMicroseconds(4);
  }

  void writeByte(uint8_t value, bool keepLastClockHighForRead) {
    pinMode(datPin_, OUTPUT);
    for (uint8_t i = 0; i < 8; ++i) {
      digitalWrite(datPin_, (value >> i) & 0x01);
      delayMicroseconds(2);
      digitalWrite(clkPin_, HIGH);
      delayMicroseconds(2);
      if (i < 7 || !keepLastClockHighForRead) {
        digitalWrite(clkPin_, LOW);
        delayMicroseconds(2);
      }
    }
  }

  uint8_t readByteAfterCommand() {
    pinMode(datPin_, INPUT);
    delayMicroseconds(1);
    digitalWrite(clkPin_, LOW);  // DS1302 outputs bit 0 on this falling edge.
    delayMicroseconds(2);

    uint8_t value = 0;
    for (uint8_t i = 0; i < 8; ++i) {
      if (digitalRead(datPin_) == HIGH) {
        value |= (1 << i);
      }
      digitalWrite(clkPin_, HIGH);
      delayMicroseconds(2);
      digitalWrite(clkPin_, LOW);
      delayMicroseconds(2);
    }
    return value;
  }

  uint8_t readRegister(uint8_t regReadCmd) {
    startTransaction();
    writeByte(regReadCmd | 0x01, true);
    const uint8_t val = readByteAfterCommand();
    endTransaction();
    return val;
  }

  void writeRegister(uint8_t regWriteCmd, uint8_t value) {
    startTransaction();
    writeByte(regWriteCmd & 0xFE, false);
    writeByte(value, false);
    endTransaction();
  }
};
