// Server Monitor Card - Timeline of error messages with severity-based coloring
// Add type="module" to your resource definition in configuration.yaml:
//   - url: /local/server-monitor-card.js
//     type: module
//
import { html, css, LitElement, nothing } from 'https://cdn.jsdelivr.net/gh/lit/dist@2/core/lit-core.min.js';

class ServerMonitorCard extends LitElement {
  static properties = {
    hass: { type: Object, attribute: false },
    _config: { type: Object, state: true },
    timelineEvents: { type: Array, state: true },
  };

  constructor() {
    super();
    this.hass = null;
    this._config = null;
    this.timelineEvents = [];
    this.previousErrorMessage = null;
    this._scrollPosition = 0;
  }

  static getConfigElement() {
    return document.createElement('server-monitor-card-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:server-monitor-card',
      error_level_sensor: '',
      error_message_sensor: '',
      title: 'Server Monitor',
      max_events: 10,
      max_time_ago: null,
      accent_color: null,
      error_color: '#FFC2A2',
      critical_color: '#FF9999',
      unknown_color: '#FFEE99',
      error_icon: 'mdi:alert',
      critical_icon: 'mdi:alert-octagon',
      unknown_icon: 'mdi:help-circle',
    };
  }

  setConfig(config) {
    this._config = config || {};
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    
    if (changedProperties.has('hass') && this.hass) {
      const wasFirstLoad = !changedProperties.get('hass');
      if (wasFirstLoad) {
        this.initializePreviousState();
        this.loadHistoricalEvents();
      }
      this.checkStateChanges();
    }
    
    if (this._scrollPosition !== undefined && this._scrollPosition > 0) {
      const timelineContainer = this.shadowRoot?.querySelector('.timeline-container');
      if (timelineContainer) {
        requestAnimationFrame(() => {
          timelineContainer.scrollTop = this._scrollPosition;
        });
      }
    }
  }

  firstUpdated() {
    const timelineContainer = this.shadowRoot?.querySelector('.timeline-container');
    if (timelineContainer) {
      this._scrollPosition = timelineContainer.scrollTop;
    }
  }

  willUpdate(changedProperties) {
    if (changedProperties.has('timelineEvents')) {
      const timelineContainer = this.shadowRoot?.querySelector('.timeline-container');
      if (timelineContainer) {
        this._scrollPosition = timelineContainer.scrollTop;
      }
    }
  }

  initializePreviousState() {
    if (!this.hass || !this._config.error_message_sensor) return;
    
    const state = this.hass.states[this._config.error_message_sensor];
    if (state) {
      this.previousErrorMessage = state.state;
    }
  }

  async loadHistoricalEvents() {
    if (!this.hass || !this.hass.callWS || !this._config.error_message_sensor || !this._config.error_level_sensor) return;

    try {
      const endTime = new Date();
      const maxTimeAgo = this._config.max_time_ago;
      let startTime;
      
      if (maxTimeAgo && maxTimeAgo > 0) {
        startTime = new Date(endTime.getTime() - (maxTimeAgo * 60 * 60 * 1000));
      } else {
        startTime = new Date(endTime.getTime() - (365 * 24 * 60 * 60 * 1000));
      }

      const response = await this.hass.callWS({
        type: 'history/history_during_period',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        entity_ids: [this._config.error_message_sensor, this._config.error_level_sensor],
        minimal_response: false,
        no_attributes: false
      });

      if (response && typeof response === 'object') {
        this.processHistoricalData(response);
      }
    } catch (error) {
      console.error('SERVER MONITOR CARD: Error loading historical events:', error);
    }
  }

  processHistoricalData(historyStates) {
    if (!historyStates || typeof historyStates !== 'object') {
      return;
    }

    const messageHistory = historyStates[this._config.error_message_sensor] || [];
    const levelHistory = historyStates[this._config.error_level_sensor] || [];

    const events = [];
    let lastMessage = null;

    messageHistory.forEach(stateItem => {
      if (!stateItem) return;

      const message = stateItem.s || stateItem.state;
      const lastChanged = stateItem.lc || stateItem.lu || stateItem.last_changed;
      if (!lastChanged || !message) return;

      if (this.isNoneMessage(message)) return;

      if (message === lastMessage) return;
      lastMessage = message;

      const timestamp = typeof lastChanged === 'number' 
        ? new Date(lastChanged * 1000) 
        : new Date(lastChanged);

      const level = this.getLevelAtTime(timestamp, levelHistory);

      events.push({
        message: message,
        level: level,
        icon: this.getIconForLevel(level),
        color: this.getColorForLevel(level),
        timestamp: timestamp,
        formattedTime: this.formatTimestamp(timestamp)
      });
    });

    events.sort((a, b) => b.timestamp - a.timestamp);

    const maxEvents = this._config.max_events;
    if (maxEvents && events.length > maxEvents) {
      this.timelineEvents = events.slice(0, maxEvents);
    } else {
      this.timelineEvents = events;
    }
  }

  getLevelAtTime(timestamp, levelHistory) {
    if (!levelHistory || levelHistory.length === 0) {
      return this.getCurrentLevel();
    }

    for (let i = levelHistory.length - 1; i >= 0; i--) {
      const item = levelHistory[i];
      const itemTime = item.lc || item.lu || item.last_changed;
      const itemTimestamp = typeof itemTime === 'number' 
        ? new Date(itemTime * 1000) 
        : new Date(itemTime);
      
      if (itemTimestamp <= timestamp) {
        return (item.s || item.state || '').toUpperCase();
      }
    }
    
    return (levelHistory[0].s || levelHistory[0].state || '').toUpperCase();
  }

  getCurrentLevel() {
    if (!this.hass || !this._config.error_level_sensor) return 'ERROR';
    const state = this.hass.states[this._config.error_level_sensor];
    return state ? state.state.toUpperCase() : 'ERROR';
  }

  isNoneMessage(message) {
    if (!message) return true;
    const normalized = message.trim().toLowerCase();
    return normalized === 'none' || normalized === 'n/a' || normalized === 'na' || normalized === '' || normalized === 'unknown';
  }

  getIconForLevel(level) {
    if (level === 'CRITICAL') {
      return this._config.critical_icon || 'mdi:alert-octagon';
    } else if (level === 'ERROR') {
      return this._config.error_icon || 'mdi:alert';
    }
    return this._config.unknown_icon || 'mdi:help-circle';
  }

  getColorForLevel(level) {
    if (level === 'CRITICAL') {
      return this._config.critical_color || '#FF9999';
    } else if (level === 'ERROR') {
      return this._config.error_color || '#FFC2A2';
    }
    return this._config.unknown_color || '#FFEE99';
  }

  checkStateChanges() {
    if (!this.hass || !this._config.error_message_sensor) return;

    const state = this.hass.states[this._config.error_message_sensor];
    if (!state) return;

    const currentMessage = state.state;
    
    if (currentMessage !== this.previousErrorMessage && this.previousErrorMessage !== null && !this.isNoneMessage(currentMessage)) {
      const level = this.getCurrentLevel();
      
      const event = {
        message: currentMessage,
        level: level,
        icon: this.getIconForLevel(level),
        color: this.getColorForLevel(level),
        timestamp: new Date(),
        formattedTime: this.formatTimestamp(new Date())
      };

      this.timelineEvents = [event, ...this.timelineEvents];
      
      const maxEvents = this._config.max_events;
      if (maxEvents && this.timelineEvents.length > maxEvents) {
        this.timelineEvents = this.timelineEvents.slice(0, maxEvents);
      }
    }

    this.previousErrorMessage = currentMessage;
  }

  formatTimestamp(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const day = date.getDate();
    const month = date.getMonth() + 1;

    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;

    return `${displayHours}:${displayMinutes}${ampm} ${day}/${month}`;
  }

  getFilteredEvents() {
    let filtered = [...this.timelineEvents];
    
    const maxTimeAgo = this._config.max_time_ago;
    if (maxTimeAgo && maxTimeAgo > 0) {
      const now = new Date();
      const maxTimeAgoMs = maxTimeAgo * 60 * 60 * 1000;
      const cutoffTime = new Date(now.getTime() - maxTimeAgoMs);
      filtered = filtered.filter(event => event.timestamp >= cutoffTime);
    }
    
    return filtered;
  }

  collapseConsecutiveDuplicates(events) {
    if (events.length === 0) return events;
    
    const collapsed = [];
    let i = 0;
    
    while (i < events.length) {
      const currentMessage = events[i].message;
      let count = 1;
      
      while (i + count < events.length && events[i + count].message === currentMessage) {
        count++;
      }
      
      if (count > 2) {
        collapsed.push(events[i]);
        collapsed.push(events[i + 1]);
        collapsed.push({ isEllipsis: true, message: currentMessage });
        i += count;
      } else {
        for (let j = 0; j < count; j++) {
          collapsed.push(events[i + j]);
        }
        i += count;
      }
    }
    
    return collapsed;
  }

  render() {
    if (!this._config) {
      return nothing;
    }

    const filteredEvents = this.getFilteredEvents();
    let collapsedEvents = this.collapseConsecutiveDuplicates(filteredEvents);
    
    const maxEvents = this._config.max_events;
    if (maxEvents) {
      let eventCount = 0;
      const limitedEvents = [];
      for (const event of collapsedEvents) {
        if (event.isEllipsis) {
          limitedEvents.push(event);
        } else {
          if (eventCount < maxEvents) {
            limitedEvents.push(event);
            eventCount++;
          } else {
            break;
          }
        }
      }
      collapsedEvents = limitedEvents;
    }
    
    const hasEvents = collapsedEvents.length > 0;
    const title = this._config.title || 'Server Monitor';
    const accentColor = this._config.accent_color || this._config.error_color || '#FFC2A2';

    return html`
      <ha-card style="--scrollbar-color: ${accentColor};">
        <div class="card">
          ${title ? html`<div class="card-title">${title}</div>` : nothing}
          <div class="timeline-container">
            <div class="timeline">
              ${hasEvents 
                ? collapsedEvents.map(event => {
                    if (event.isEllipsis) {
                      return html`
                        <div class="timeline-event timeline-ellipsis">
                          <div class="event-content">
                            <div class="event-message">...</div>
                          </div>
                        </div>
                      `;
                    }
                    return html`
                      <div class="timeline-event">
                        <div class="timeline-icon">
                          <ha-icon .icon=${event.icon} style="color: ${event.color};"></ha-icon>
                        </div>
                        <div class="event-content">
                          <div class="event-message-wrapper">
                            <div class="event-message">${event.message}</div>
                            <span class="event-time">${event.formattedTime}</span>
                          </div>
                        </div>
                      </div>
                    `;
                  })
                : html`<div class="timeline-empty">No errors recorded</div>`
              }
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
    ha-card {
      background: var(--ha-card-background, rgba(0, 0, 0, 0.3));
      backdrop-filter: var(--ha-card-backdrop-filter, blur(20px));
      box-shadow: var(--ha-card-box-shadow, 0.5px 0.5px 1px 0px rgba(255, 255, 255, 0.40) inset, -0.5px -0.5px 1px 0px rgba(255, 255, 255, 0.10) inset, 0px 1px 2px 0px rgba(0, 0, 0, 0.10));
      border-radius: var(--ha-card-border-radius, 20px);
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .card {
      padding: 16px;
      font-family: var(--ha-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif);
      height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;
    }
    .card-title {
      font-size: 16px;
      font-weight: 500;
      color: var(--primary-text-color, #212121);
      margin-bottom: 12px;
    }
    .timeline-container {
      position: relative;
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 0;
    }
    .timeline-container::-webkit-scrollbar {
      width: 8px;
    }
    .timeline-container::-webkit-scrollbar-track {
      background: transparent;
      border-radius: 4px;
    }
    .timeline-container::-webkit-scrollbar-thumb {
      background: var(--scrollbar-color, var(--primary-color, #FFC2A2));
      border-radius: 4px;
    }
    .timeline-container::-webkit-scrollbar-thumb:hover {
      opacity: 0.8;
    }
    .timeline-container {
      scrollbar-width: thin;
      scrollbar-color: var(--scrollbar-color, var(--primary-color, #FFC2A2)) transparent;
    }
    .timeline {
      position: relative;
      padding-left: 32px;
    }
    .timeline-empty {
      text-align: center;
      padding: 32px;
      color: var(--secondary-text-color, #757575);
      font-size: 14px;
    }
    .timeline-event {
      position: relative;
      margin-bottom: 24px;
    }
    .timeline-event:last-child {
      margin-bottom: 0;
    }
    .timeline-icon {
      position: absolute;
      left: -32px;
      top: 0;
      width: 24px;
      height: 24px;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .timeline-icon ha-icon {
      width: 24px;
      height: 24px;
    }
    .event-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-left: 8px;
      min-width: 0;
      overflow: hidden;
    }
    .event-message-wrapper {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .event-message {
      flex: 1;
      min-width: 0;
      font-size: 15px;
      color: var(--primary-text-color, #212121);
      line-height: 1.5;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .event-time {
      font-size: 13px;
      color: #ffffff;
      margin-left: 0px;
      margin-right: 16px;
      white-space: nowrap;
    }
    .timeline-ellipsis {
      opacity: 0.6;
      margin-top: -16px;
      margin-bottom: 8px;
    }
    .timeline-ellipsis .event-message {
      font-style: italic;
    }
  `;
}

customElements.define('server-monitor-card', ServerMonitorCard);

// Editor
class ServerMonitorCardEditor extends LitElement {
  static properties = {
    hass: { type: Object, attribute: false },
    _config: { type: Object, state: true },
  };

  constructor() {
    super();
    this.hass = null;
    this._config = {};
  }

  setConfig(config) {
    this._config = config || {};
  }

  _valueChanged(field, value) {
    if (!this._config) {
      return;
    }
    if (value === '' || value === null || value === undefined) {
      delete this._config[field];
    } else {
      this._config[field] = value;
    }
    this._config = { ...this._config };
    this._fire('config-changed', { config: this._config });
  }

  _fire(type, detail) {
    const event = new Event(type, {
      bubbles: true,
      cancelable: false,
      composed: true,
    });
    event.detail = detail;
    this.dispatchEvent(event);
  }

  _getSensorOptions() {
    if (!this.hass) return [];
    return Object.keys(this.hass.states)
      .filter(entityId => entityId.startsWith('sensor.'))
      .sort();
  }

  render() {
    if (!this._config) {
      return nothing;
    }

    const sensorOptions = this._getSensorOptions();

    return html`
      <div class="card-config">
        <div class="config-section">
          <div class="section-title">Sensors</div>
          
          <div class="config-row">
            <label>Error Level Sensor</label>
            <input
              type="text"
              list="level-sensors"
              .value=${this._config.error_level_sensor || ''}
              placeholder="sensor.server_monitor_homeassistant_error_level"
              @input=${(e) => this._valueChanged('error_level_sensor', e.target.value.trim())}
            />
            <datalist id="level-sensors">
              ${sensorOptions.map(sensor => html`<option value="${sensor}">`)}
            </datalist>
            <div class="config-help">
              Sensor that provides the error level (ERROR or CRITICAL)
            </div>
          </div>
          
          <div class="config-row">
            <label>Error Message Sensor</label>
            <input
              type="text"
              list="message-sensors"
              .value=${this._config.error_message_sensor || ''}
              placeholder="sensor.server_monitor_homeassistant_last_error"
              @input=${(e) => this._valueChanged('error_message_sensor', e.target.value.trim())}
            />
            <datalist id="message-sensors">
              ${sensorOptions.map(sensor => html`<option value="${sensor}">`)}
            </datalist>
            <div class="config-help">
              Sensor that provides the error message to display
            </div>
          </div>
        </div>

        <div class="config-section">
          <div class="section-title">Display Options</div>
          
          <div class="config-row">
            <label>Card Title</label>
            <input
              type="text"
              .value=${this._config.title || ''}
              placeholder="Server Monitor"
              @input=${(e) => this._valueChanged('title', e.target.value.trim())}
            />
          </div>

          <div class="config-row">
            <label>Maximum Events</label>
            <input
              type="number"
              .value=${this._config.max_events !== undefined && this._config.max_events !== null ? String(this._config.max_events) : ''}
              min="1"
              max="100"
              placeholder="10"
              @input=${(e) => {
                const value = e.target.value.trim();
                this._valueChanged('max_events', value === '' ? null : parseInt(value) || null);
              }}
            />
            <div class="config-help">
              Maximum number of events to show. Leave empty for no limit.
            </div>
          </div>

          <div class="config-row">
            <label>Maximum Time Ago (hours)</label>
            <input
              type="number"
              .value=${this._config.max_time_ago || ''}
              min="1"
              step="0.5"
              placeholder="24"
              @input=${(e) => {
                const value = e.target.value.trim();
                this._valueChanged('max_time_ago', value === '' ? null : parseFloat(value) || null);
              }}
            />
            <div class="config-help">
              Only show events from the last X hours. Leave empty for no limit.
            </div>
          </div>
        </div>

        <div class="config-section">
          <div class="section-title">Colors</div>
          
          <div class="config-row color-row">
            <label>Accent Color (scrollbar, etc.)</label>
            <div class="color-input-group">
              <input
                type="color"
                .value=${this._config.accent_color || '#FFC2A2'}
                @input=${(e) => this._valueChanged('accent_color', e.target.value)}
              />
              <input
                type="text"
                .value=${this._config.accent_color || ''}
                placeholder="#FFC2A2 or var(--primary-color)"
                @input=${(e) => this._valueChanged('accent_color', e.target.value.trim())}
              />
            </div>
            <div class="config-help">
              Color for scrollbar and UI accents. Leave empty to use Error Color.
            </div>
          </div>

          <div class="config-row color-row">
            <label>Error Color</label>
            <div class="color-input-group">
              <input
                type="color"
                .value=${this._config.error_color || '#FFC2A2'}
                @input=${(e) => this._valueChanged('error_color', e.target.value)}
              />
              <input
                type="text"
                .value=${this._config.error_color || '#FFC2A2'}
                placeholder="#FFC2A2"
                @input=${(e) => this._valueChanged('error_color', e.target.value.trim())}
              />
            </div>
          </div>

          <div class="config-row color-row">
            <label>Critical Color</label>
            <div class="color-input-group">
              <input
                type="color"
                .value=${this._config.critical_color || '#FF9999'}
                @input=${(e) => this._valueChanged('critical_color', e.target.value)}
              />
              <input
                type="text"
                .value=${this._config.critical_color || '#FF9999'}
                placeholder="#FF9999"
                @input=${(e) => this._valueChanged('critical_color', e.target.value.trim())}
              />
            </div>
          </div>

          <div class="config-row color-row">
            <label>Unknown Color</label>
            <div class="color-input-group">
              <input
                type="color"
                .value=${this._config.unknown_color || '#FFEE99'}
                @input=${(e) => this._valueChanged('unknown_color', e.target.value)}
              />
              <input
                type="text"
                .value=${this._config.unknown_color || '#FFEE99'}
                placeholder="#FFEE99"
                @input=${(e) => this._valueChanged('unknown_color', e.target.value.trim())}
              />
            </div>
          </div>
        </div>

        <div class="config-section">
          <div class="section-title">Icons</div>
          
          <div class="config-row">
            <label>Error Icon</label>
            <input
              type="text"
              .value=${this._config.error_icon || ''}
              placeholder="mdi:alert"
              @input=${(e) => this._valueChanged('error_icon', e.target.value.trim())}
            />
          </div>

          <div class="config-row">
            <label>Critical Icon</label>
            <input
              type="text"
              .value=${this._config.critical_icon || ''}
              placeholder="mdi:alert-octagon"
              @input=${(e) => this._valueChanged('critical_icon', e.target.value.trim())}
            />
          </div>

          <div class="config-row">
            <label>Unknown Icon</label>
            <input
              type="text"
              .value=${this._config.unknown_icon || ''}
              placeholder="mdi:help-circle"
              @input=${(e) => this._valueChanged('unknown_icon', e.target.value.trim())}
            />
          </div>
        </div>
      </div>
    `;
  }

  static styles = css`
    .card-config {
      padding: 16px;
    }
    .config-section {
      margin-bottom: 24px;
    }
    .config-section:last-child {
      margin-bottom: 0;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--primary-text-color, #212121);
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .config-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
    }
    .config-row:last-child {
      margin-bottom: 0;
    }
    .config-row label {
      color: var(--primary-text-color, #212121);
      font-size: 14px;
      font-weight: 500;
    }
    .config-row input[type="text"],
    .config-row input[type="number"] {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
      background: var(--card-background-color, #ffffff);
      color: var(--primary-text-color, #212121);
      font-family: monospace;
    }
    .config-row input:focus {
      outline: none;
      border-color: var(--primary-color, #03a9f4);
    }
    .color-row .color-input-group {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .color-row input[type="color"] {
      width: 40px;
      height: 32px;
      padding: 0;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 4px;
      cursor: pointer;
    }
    .color-row input[type="text"] {
      flex: 1;
    }
    .config-help {
      font-size: 12px;
      color: var(--secondary-text-color, #757575);
      margin-top: 4px;
    }
  `;
}

customElements.define('server-monitor-card-editor', ServerMonitorCardEditor);

// Register custom card for card picker
if (window.registerCustomCard) {
  window.registerCustomCard({
    type: 'custom:server-monitor-card',
    name: 'Server Monitor',
    description: 'Display a timeline of server error messages with severity coloring',
  });
}
