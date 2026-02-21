# Server Monitor Card

A logbook-style card for Home Assistant that displays a timeline of errors and their severity levels.

<img width="345" height="347" alt="image" src="https://github.com/user-attachments/assets/e5ace411-a6e3-40b5-8b76-fd74125e538e" />


> An adaption of this card to be used with cat tracking

<img width="345" height="397" alt="image" src="https://github.com/user-attachments/assets/8737f0f7-3007-49d5-b324-124a0af05d6d" />

## Installation

1. Copy `server-monitor-card.js` to your `config/www/` folder
2. Add the resource to your Lovelace configuration:

```yaml
resources:
  - url: /local/server-monitor-card.js
    type: module
```

3. Restart Home Assistant
4. Add the card to your dashboard

## Configuration

| Field | Required | Description | Default |
|-------|----------|-------------|---------|
| `type` | **Yes** | Must be `custom:server-monitor-card` | — |
| `error_level_sensor` | **Yes** | Sensor entity that provides the error level (`ERROR`, `CRITICAL`, etc.) | — |
| `error_message_sensor` | **Yes** | Sensor entity that provides the error message text | — |
| `title` | No | Card title displayed at the top | `Server Monitor` |
| `max_events` | No | Maximum number of events to display | `10` |
| `max_time_ago` | No | Only show events from the last X hours | No limit |
| `accent_color` | No | Color for scrollbar and UI accents | Uses `error_color` |
| `error_color` | No | Icon color for ERROR level events | `#FFC2A2` |
| `critical_color` | No | Icon color for CRITICAL level events | `#FF9999` |
| `unknown_color` | No | Icon color for unknown level events | `#FFEE99` |
| `error_icon` | No | MDI icon for ERROR level events | `mdi:alert` |
| `critical_icon` | No | MDI icon for CRITICAL level events | `mdi:alert-octagon` |
| `unknown_icon` | No | MDI icon for unknown level events | `mdi:help-circle` |

## Example Configuration

```yaml
type: custom:server-monitor-card
error_level_sensor: sensor.server_monitor_homeassistant_error_level
error_message_sensor: sensor.server_monitor_homeassistant_last_error
title: Logs
max_events: 3
max_time_ago: 12
accent_color: "#A2D2FF"
error_icon: mdi:alert
critical_icon: mdi:alert-octagon
unknown_icon: mdi:help-circle
grid_options:
  columns: 12
  rows: 8
```

![Configuration Editor](https://github.com/user-attachments/assets/a92e6e8e-76b3-469e-b1e4-09b1f007a5ff)

## Features

- Displays error messages in a scrollable timeline
- Color-coded severity levels (Error, Critical, Unknown)
- Customizable icons per severity level
- Filters out "none" and "unknown" placeholder messages
- Collapses consecutive duplicate messages
- Visual editor for easy configuration
