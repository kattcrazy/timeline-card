# Cat Timeline Card - Base Template

**⚠️ This is a BASE TEMPLATE that requires customization. It will NOT work as-is.**

This is a starting point for your own cat timeline card project. You are responsible for editing the JavaScript file to match your Home Assistant setup. This is not a ready-to-use card - it's a customizable base that you need to adapt to your entities, messages, and icons.

## Quick Start

1. **Edit the JavaScript file** - Open `base-cat-timeline-card.js` and replace all placeholders:
   - Find `PLACEHOLDER_*` → Replace with your Home Assistant entity IDs
   - Find `PLACEHOLDERTEXTPLACEHOLDERTEXT` → Replace with your event messages
   - Replace default icons (`mdi:cat`, `mdi:camera`, `mdi:bell`) with your preferred icons

2. **Install** - Copy your customized file to `/config/www/` and add to `configuration.yaml`:
```yaml
lovelace:
  resources:
    - url: /local/base-cat-timeline-card.js
      type: module
```

3. **Add to dashboard**:
```yaml
type: custom:cat-timeline-card
max_events: 10
primary_icon_colour: "#ff0000"
```

## What You Need to Customize

The code has three main sections with placeholders you must replace:

### 1. Events (Entity IDs)
Replace `PLACEHOLDER_*` entity IDs with your actual Home Assistant entities in:
- `initializePreviousStates()` - Lines ~97-120
- `loadHistoricalEvents()` - Lines ~122-163  
- `checkStateChanges()` - Lines ~272-344
- `processHistoricalData()` - Lines ~165-245

<details>
<summary>Read more: How to add events</summary>

Use these helper methods:

**Simple state change:**
```javascript
this.checkEntityState(
  'binary_sensor.my_cat_flap',  // Your entity
  'on',                          // State that triggers
  'Cat used the cat flap',       // Message
  'mdi:cat'                      // Icon
);
```

**Conditional event (depends on another entity):**
```javascript
this.checkEntityStateWithCondition(
  'binary_sensor.camera_occupancy',      // Entity to monitor
  'on',                                  // Trigger state
  'sensor.camera_classification',       // Entity to check
  'MyCat',                               // Value for condition
  'MyCat was seen',                      // Message if true
  'A cat was seen',                      // Message if false
  'mdi:camera'                          // Icon
);
```
</details>

### 2. Messages
Replace all `'PLACEHOLDERTEXTPLACEHOLDERTEXT'` with your event messages in:
- `checkStateChanges()` - Lines ~272-344
- `processHistoricalData()` - Lines ~165-245
- `getIconColorForEvent()` - Lines ~438-448 (update the condition that determines icon colours)

<details>
<summary>Read more: Icon colour logic</summary>

In `getIconColorForEvent()`, customize how the card determines icon colours:

```javascript
const isPrimaryEvent = message.includes('YourCatName'); // Replace with your identifier
```

This determines which events use `primary_icon_colour` vs `other_cat_icon_colour`.
</details>

### 3. Icons
Replace default icons with Material Design Icons:
- `'mdi:cat'` → Your preferred icon
- `'mdi:camera'` → Your preferred icon  
- `'mdi:bell'` → Your preferred icon

Browse icons: https://materialdesignicons.com/

<details>
<summary>Read more: Special icon features</summary>

**Special positioning:** If an icon needs different positioning, identify it in `render()` and add CSS:
```javascript
const isSpecialIcon = event.icon === 'mdi:bowl-mix';
// Then apply: timeline-icon-special class
```

**Clickable events:** Customize `handleCameraClick()` in `render()` to make events open links/media browsers.
</details>

## Configuration Options

Configure via UI editor or YAML:

- `max_events` - Maximum events to show (empty = no limit)
- `max_time_ago` - Only show events from last X hours (empty = no limit)
- `primary_icon_colour` - Hex code or CSS variable (e.g., `#ff0000` or `var(--accent-color)`)
- `other_cat_icon_colour` - Hex code or CSS variable for other cat events (empty = uses primary)

<details>
<summary>Read more: Advanced customization</summary>

**Rate limiting:** Customize in `addTimelineEvent()` and `shouldAddEvent()` to prevent too-frequent events.

**Timestamp format:** Modify `formatTimestamp()` to change how times are displayed.

**Event deduplication:** Automatically collapses 3+ consecutive duplicates (shows "..."). Works automatically.

**Code structure:** The card tracks state changes, loads historical data, manages events, and renders the timeline. See the code comments for details.
</details>

## Tips

- Start with one event type, test it, then add more
- Check browser console for errors (prefix: "CAT TIMELINE CARD:")
- Find entity IDs in Home Assistant: Developer Tools > States
- Keep message text consistent for deduplication to work
- Ensure entities have history enabled for historical events

## Troubleshooting

**No events?** Check entity IDs are correct and entities are updating in Home Assistant.

**Too many events?** Adjust rate limiting in `addTimelineEvent()` or `shouldAddEvent()`.

**Wrong colours?** Check `getIconColorForEvent()` logic matches your message text.

**Historical events not loading?** Verify entities have history enabled and entity IDs match.

---

**Remember: This is a template. You need to customize it yourself to match your setup.**
