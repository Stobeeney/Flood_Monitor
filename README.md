# ESP32 Flood Monitor

A standalone ESP32 firmware project built with PlatformIO and the Arduino framework for monitoring water surface distance with dual-ultrasonic sensing (**JSN-SR04T v3** for normal/long range and **HC-SR04** for close/minimum range), local **16x2 I2C LCD** readout, **MH-Real-Time Clock Module 2 (DS1302)** timestamps, **Active Piezo** alarm, **Air780E 4G GSM** SMS alerts, and a local Wi-Fi Access Point web dashboard.

## Hardware Setup & Pinout (`esp32dev`)

| Module | Module Pin | ESP32 Pin | Details / Electrical Notes |
| --- | --- | --- | --- |
| **JSN-SR04T v3** (Normal/Long Range, >= 25 cm) | `5V` | `VIN (5V)` | Mode 0 (leave onboard **M1** and **M2** pads open) |
| | `GND` | `GND` | Common ground |
| | `TRIG` | `GPIO 32` | Trigger output (20 µs pulse) |
| | `ECHO` | `GPIO 34` | Input-only GPIO; **use 5V→3.3V voltage divider** |
| **HC-SR04** (Minimum/Close Range, < 25 cm) | `VCC` | `VIN (5V)` | Covers JSN-SR04T's ~25 cm blind zone |
| | `GND` | `GND` | Common ground |
| | `TRIG` | `GPIO 33` | Trigger output (10 µs pulse) |
| | `ECHO` | `GPIO 35` | Input-only GPIO; **use 5V→3.3V voltage divider** |
| **MH-Real-Time Clock Module 2** (DS1302) | `VCC` | `3V3 (3.3V)` | Power at 3.3V so `DAT` logic is safe for ESP32; insert CR2032 cell |
| | `GND` | `GND` | Common ground |
| | `CLK` | `GPIO 25` | 3-wire serial clock |
| | `DAT` | `GPIO 26` | Bidirectional data I/O |
| | `RST` | `GPIO 27` | Chip enable / reset |
| **LCD 16x2 I2C** (PCF8574) | `VCC` | `VIN (5V)` | 5V for contrast/backlight (add I2C level shifter if backpack uses 5V pull-ups) |
| | `GND` | `GND` | Common ground |
| | `SDA` | `GPIO 21` | ESP32 default I2C SDA (auto-detects `0x27` / `0x3F`) |
| | `SCL` | `GPIO 22` | ESP32 default I2C SCL |
| **Active Piezo Buzzer** (No MOSFET) | `+` | `GPIO 23` | **Wire through a 100 Ω – 220 Ω series resistor** to protect ESP32 GPIO |
| | `-` | `GND` | Common ground |
| **Air780E 4G GSM Module** | `VCC / 5V` | External `5V` (>= 2A) | Do **not** power from ESP32 `3V3`; TX bursts draw up to 1–2A |
| | `GND` | `GND` | **Common ground** shared with ESP32 and 5V supply |
| | `TXD` | `GPIO 16 (RX2)` | Module TX → ESP32 UART2 RX |
| | `RXD` | `GPIO 17 (TX2)` | Module RX ← ESP32 UART2 TX |

### Voltage Dividers for `ECHO` Pins (GPIO 34 & GPIO 35)
ESP32 GPIOs tolerate up to 3.3V. Step down both 5V `ECHO` outputs using resistor dividers:
- **JSN-SR04T ECHO**: `10 kOhm` from `ECHO` to `GPIO 34`, and `15 kOhm` from `GPIO 34` to `GND`
- **HC-SR04 ECHO**: `10 kOhm` from `ECHO` to `GPIO 35`, and `15 kOhm` from `GPIO 35` to `GND`

### Direct Active Piezo Wiring (Without MOSFET)
ESP32 GPIOs are rated for ~12 mA recommended (40 mA max). Place a **100 Ω – 220 Ω resistor** in series between `GPIO 23` and the active buzzer `+` terminal to prevent over-current damage to the GPIO pin.

## Configuration

Copy the template configuration if `include/config.h` does not exist:
```bash
cp include/config.example.h include/config.h
```

Edit [include/config.h](file:///home/eney/Documents/flood%20monitor/include/config.h):
- `AP_SSID` / `AP_PASSWORD`: Wi-Fi AP credentials (`FloodMonitor` / `floodmonitor`)
- `ALERT_PHONE_NUMBER`: Recipient mobile number in international format (e.g., `"+639171234567"`)
- `WARNING_DISTANCE_CM` / `ALERT_DISTANCE_CM` / `CLEAR_HYSTERESIS_CM`: Site-calibrated thresholds
- `LCD_I2C_ADDR`: Leave `0x00` to auto-detect `0x27` or `0x3F`

## Building and Flashing

Using PlatformIO CLI:
```bash
pio run
pio run --target upload
pio device monitor --baud 115200
```

To set the DS1302 RTC time over USB Serial Monitor (`115200` baud), send:
```text
SET_TIME 2026-11-18 18:00:00
```

## Accessing the Dashboard

1. Power the ESP32 (and external 5V supply for Air780E).
2. Connect to the Wi-Fi network **FloodMonitor** (password: `floodmonitor`).
3. Open `http://192.168.4.1` in a browser.

## REST Endpoint

`GET /api/status` returns JSON telemetry:
```json
{
  "distance_cm": 45.2,
  "jsn_cm": 45.2,
  "hc_cm": 44.8,
  "sensor": "JSN-SR04T",
  "status": "WARNING",
  "rtc_time": "2026-11-18 17:45:10",
  "gsm_ready": true,
  "ap_ip": "192.168.4.1"
}
```
If both ultrasonic sensors time out, `distance_cm` is `null` and `sensor` is `"NONE"`.
