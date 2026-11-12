# ESP32 Flood Monitor

A standalone ESP32 firmware project built with PlatformIO and Arduino framework for monitoring water surface distance using an ultrasonic sensor. The device creates a local Wi-Fi Access Point and hosts an integrated browser dashboard without requiring external routers or cloud services.

## Hardware Setup

| Signal | ESP32 Pin | Details |
| --- | --- | --- |
| Sensor VCC | VIN (5V) | Power supply for ultrasonic sensor |
| Sensor GND | GND | Common ground |
| Sensor TRIG | GPIO 32 | Trigger pulse output |
| Sensor ECHO | GPIO 34 | Input via voltage divider (3.3V max) |

### Voltage Divider for ECHO
ESP32 GPIO pins tolerate up to 3.3V. For 5V echo signals, step down using a divider:
- 10 kOhm from ECHO to GPIO 34
- 15 kOhm from GPIO 34 to GND

## Configuration

Copy the template configuration before compiling:
```bash
cp include/config.example.h include/config.h
```

Modify `include/config.h` if you wish to change the default Wi-Fi SSID (`FloodMonitor`) or password (`floodmonitor`).

## Building and Flashing

Using PlatformIO CLI:
```bash
pio run
pio run --target upload
pio device monitor --baud 115200
```

## Accessing the Dashboard

1. Power the ESP32.
2. Connect to the Wi-Fi network **FloodMonitor** (password: `floodmonitor`).
3. In a web browser, open `http://192.168.4.1`.

The dashboard presents real-time distance measurements, an SVG history graph, and status indicators.

## REST Endpoint

`GET /api/status` returns JSON telemetry:
```json
{"distance_cm": 45.2, "ap_ip": "192.168.4.1"}
```
If an echo timeout occurs, `distance_cm` is `null`.
