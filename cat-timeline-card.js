// This card uses Lit and must be loaded as a module
// Add type="module" to your resource definition in configuration.yaml:
//   - url: /local/cat-timeline-card.js
//     type: module
//
// Import Lit from CDN (standalone modules need full URLs)
import { html, css, LitElement, nothing } from 'https://cdn.jsdelivr.net/gh/lit/dist@2/core/lit-core.min.js';

class CatTimelineCard extends LitElement {
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
    this.maxEvents = 10;
    this.maxTimeAgo = null;
    this.sadieIconColour = null;
    this.otherCatIconColour = null;
    this.previousStates = {};
    this.lastFoodBowlEventTime = null;
    this._scrollPosition = 0;
  }

  static getConfigElement() {
    return document.createElement('cat-timeline-card-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:cat-timeline-card',
      max_events: 10,
      max_time_ago: null,
      sadie_icon_colour: null,
      other_cat_icon_colour: null,
    };
  }

  setConfig(config) {
    this._config = config || {};
    this.maxEvents = this._config.max_events !== undefined && this._config.max_events !== null && this._config.max_events !== '' 
      ? this._config.max_events 
      : null;
    this.maxTimeAgo = this._config.max_time_ago || null;
    this.sadieIconColour = this._config.sadie_icon_colour || null;
    this.otherCatIconColour = this._config.other_cat_icon_colour || null;
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    
    // Handle hass changes
    if (changedProperties.has('hass') && this.hass) {
      const wasFirstLoad = !changedProperties.get('hass');
      if (wasFirstLoad) {
        this.initializePreviousStates();
        this.loadHistoricalEvents();
      }
      this.checkStateChanges();
    }
    
    
    // Restore scroll position after render
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
    // Save scroll position before first render
    const timelineContainer = this.shadowRoot?.querySelector('.timeline-container');
    if (timelineContainer) {
      this._scrollPosition = timelineContainer.scrollTop;
    }
  }

  willUpdate(changedProperties) {
    // Save scroll position before update
    if (changedProperties.has('timelineEvents')) {
      const timelineContainer = this.shadowRoot?.querySelector('.timeline-container');
      if (timelineContainer) {
        this._scrollPosition = timelineContainer.scrollTop;
      }
    }
  }

  initializePreviousStates() {
    if (!this.hass || !this.hass.states) return;
    
    const entitiesToTrack = [
      'binary_sensor.sadies_cat_flap_state',
      'binary_sensor.sadies_food_bowl_state',
      'binary_sensor.plc_kattcam_cat_occupancy',
      'binary_sensor.plc_kattcam_2_cat_occupancy',
      'binary_sensor.plc_kattcam_cat_sound',
      'binary_sensor.plc_kattcam_caterwaul_sound',
      'binary_sensor.plc_kattcam_hiss_sound',
      'binary_sensor.plc_kattcam_meow_sound',
      'binary_sensor.plc_kattcam_2_cat_sound',
      'binary_sensor.plc_kattcam_2_caterwaul_sound',
      'binary_sensor.plc_kattcam_2_hiss_sound',
      'binary_sensor.plc_kattcam_2_meow_sound'
    ];

    entitiesToTrack.forEach(entityId => {
      if (this.hass.states[entityId]) {
        this.previousStates[entityId] = this.hass.states[entityId].state;
      }
    });
  }

  async loadHistoricalEvents() {
    if (!this.hass || !this.hass.callWS) return;

    const entitiesToTrack = [
      'binary_sensor.sadies_cat_flap_state',
      'binary_sensor.sadies_food_bowl_state',
      'binary_sensor.plc_kattcam_cat_occupancy',
      'binary_sensor.plc_kattcam_2_cat_occupancy',
      'binary_sensor.plc_kattcam_cat_sound',
      'binary_sensor.plc_kattcam_caterwaul_sound',
      'binary_sensor.plc_kattcam_hiss_sound',
      'binary_sensor.plc_kattcam_meow_sound',
      'binary_sensor.plc_kattcam_2_cat_sound',
      'binary_sensor.plc_kattcam_2_caterwaul_sound',
      'binary_sensor.plc_kattcam_2_hiss_sound',
      'binary_sensor.plc_kattcam_2_meow_sound',
      'sensor.plc_kattcam_cat_object_classification',
      'sensor.plc_kattcam_2_cat_object_classification'
    ];

    try {
      const endTime = new Date();
      const startTime = this.maxTimeAgo 
        ? new Date(endTime.getTime() - (this.maxTimeAgo * 60 * 60 * 1000))
        : new Date(endTime.getTime() - (24 * 60 * 60 * 1000));

      const response = await this.hass.callWS({
        type: 'history/history_during_period',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        entity_ids: entitiesToTrack,
        minimal_response: true,
        no_attributes: true
      });

      if (response && typeof response === 'object') {
        this.processHistoricalData(response);
      }
    } catch (error) {
      console.error('CAT TIMELINE CARD: Error loading historical events:', error);
    }
  }

  processHistoricalData(historyStates) {
    if (!historyStates || typeof historyStates !== 'object') {
      return;
    }

    const stateChanges = [];
    const classificationHistory = {};

    Object.keys(historyStates).forEach(entityId => {
      const states = historyStates[entityId];
      if (!Array.isArray(states)) return;

      states.forEach(stateItem => {
        if (!stateItem) return;

        const state = stateItem.s;
        const lastChanged = stateItem.lc || stateItem.lu;
        if (!lastChanged) return;

        const timestamp = new Date(lastChanged * 1000);

        if (entityId.includes('classification')) {
          if (!classificationHistory[entityId]) {
            classificationHistory[entityId] = [];
          }
          classificationHistory[entityId].push({ state, timestamp });
        } else {
          stateChanges.push({ entityId, state, timestamp });
        }
      });
    });

    stateChanges.sort((a, b) => a.timestamp - b.timestamp);

    let lastHistoricalFoodBowlTime = null;

    stateChanges.forEach((change, index) => {
      const { entityId, state, timestamp } = change;
      const prevChange = index > 0 ? stateChanges[index - 1] : null;
      
      const isStateChange = !prevChange || 
        prevChange.entityId !== entityId || 
        prevChange.state !== state;

      if (isStateChange) {
        if (entityId === 'binary_sensor.sadies_cat_flap_state' && state === 'on') {
          this.addTimelineEventFromHistory('Sadie used the cat flap', 'mdi:home-export-outline', timestamp);
        } else if (entityId === 'binary_sensor.sadies_food_bowl_state' && state === 'off') {
          const fiveMinutes = 5 * 60 * 1000;
          const shouldAdd = lastHistoricalFoodBowlTime === null || 
            (timestamp.getTime() - lastHistoricalFoodBowlTime.getTime() >= fiveMinutes);
          
          if (shouldAdd) {
            this.addTimelineEventFromHistory('Sadie ate from her food bowl', 'mdi:bowl', timestamp);
            lastHistoricalFoodBowlTime = timestamp;
          }
        } else if (entityId === 'binary_sensor.plc_kattcam_cat_occupancy' && state === 'on') {
          const classification = this.getClassificationAtTime('sensor.plc_kattcam_cat_object_classification', timestamp, classificationHistory);
          const message = classification === 'Sadie' 
            ? 'Sadie was seen by the hole under the fence'
            : 'A cat was seen by the hole under the fence';
          this.addTimelineEventFromHistory(message, 'mdi:camera', timestamp);
        } else if (entityId === 'binary_sensor.plc_kattcam_2_cat_occupancy' && state === 'on') {
          const classification = this.getClassificationAtTime('sensor.plc_kattcam_2_cat_object_classification', timestamp, classificationHistory);
          const message = classification === 'Sadie'
            ? 'Sadie was seen by the back corner'
            : 'A cat was seen by the back corner';
          this.addTimelineEventFromHistory(message, 'mdi:camera', timestamp);
        } else if (entityId.includes('plc_kattcam_cat') && entityId.includes('sound') && state === 'on') {
          this.addTimelineEventFromHistory('Cat noises were heard by the hole under the fence', 'mdi:cast-audio-variant', timestamp);
        } else if (entityId.includes('plc_kattcam_2') && entityId.includes('sound') && state === 'on') {
          this.addTimelineEventFromHistory('Cat noises were heard by the back corner', 'mdi:cast-audio-variant', timestamp);
        }
      }
    });

    this.timelineEvents = [...this.timelineEvents].sort((a, b) => b.timestamp - a.timestamp);
    if (this.maxEvents !== null && this.timelineEvents.length > this.maxEvents) {
      this.timelineEvents = this.timelineEvents.slice(0, this.maxEvents);
    }
  }

  getClassificationAtTime(entityId, timestamp, classificationHistory) {
    if (!classificationHistory[entityId] || classificationHistory[entityId].length === 0) {
      return null;
    }

    const history = classificationHistory[entityId];
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].timestamp <= timestamp) {
        return history[i].state;
      }
    }
    return history[0].state;
  }

  addTimelineEventFromHistory(message, icon, timestamp) {
    const event = {
      message: message,
      icon: icon,
      timestamp: timestamp,
      formattedTime: this.formatTimestamp(timestamp)
    };

    this.timelineEvents = [...this.timelineEvents, event];
  }

  checkStateChanges() {
    if (!this.hass || !this.hass.states) return;

    // Track cat flap
    this.checkEntityState(
      'binary_sensor.sadies_cat_flap_state',
      'on',
      'Sadie used the cat flap',
      'mdi:home-export-outline'
    );

    // Track food bowl (triggers when closed)
    this.checkEntityState(
      'binary_sensor.sadies_food_bowl_state',
      'off',
      'Sadie ate from her food bowl',
      'mdi:bowl'
    );

    // Track kattcam cat occupancy (hole under fence)
    this.checkEntityStateWithCondition(
      'binary_sensor.plc_kattcam_cat_occupancy',
      'on',
      'sensor.plc_kattcam_cat_object_classification',
      'Sadie',
      'Sadie was seen by the hole under the fence',
      'A cat was seen by the hole under the fence',
      'mdi:camera'
    );

    // Track kattcam_2 cat occupancy (back corner)
    this.checkEntityStateWithCondition(
      'binary_sensor.plc_kattcam_2_cat_occupancy',
      'on',
      'sensor.plc_kattcam_2_cat_object_classification',
      'Sadie',
      'Sadie was seen by the back corner',
      'A cat was seen by the back corner',
      'mdi:camera'
    );

    // Track kattcam sound sensors (hole under fence)
    const kattcamSoundSensors = [
      'binary_sensor.plc_kattcam_cat_sound',
      'binary_sensor.plc_kattcam_caterwaul_sound',
      'binary_sensor.plc_kattcam_hiss_sound',
      'binary_sensor.plc_kattcam_meow_sound'
    ];
    kattcamSoundSensors.forEach(sensor => {
      this.checkEntityState(
        sensor,
        'on',
        'Cat noises were heard by the hole under the fence',
        'mdi:cast-audio-variant'
      );
    });

    // Track kattcam_2 sound sensors (back corner)
    const kattcam2SoundSensors = [
      'binary_sensor.plc_kattcam_2_cat_sound',
      'binary_sensor.plc_kattcam_2_caterwaul_sound',
      'binary_sensor.plc_kattcam_2_hiss_sound',
      'binary_sensor.plc_kattcam_2_meow_sound'
    ];
    kattcam2SoundSensors.forEach(sensor => {
      this.checkEntityState(
        sensor,
        'on',
        'Cat noises were heard by the back corner',
        'mdi:cast-audio-variant'
      );
    });
  }

  checkEntityState(entityId, targetState, message, icon) {
    if (!this.hass || !this.hass.states[entityId]) return;

    const currentState = this.hass.states[entityId].state;
    const previousState = this.previousStates[entityId];

    if (currentState === targetState && previousState !== targetState) {
      this.addTimelineEvent(message, icon);
    }

    this.previousStates[entityId] = currentState;
  }

  checkEntityStateWithCondition(entityId, targetState, conditionEntityId, conditionValue, messageIfTrue, messageIfFalse, icon) {
    if (!this.hass || !this.hass.states[entityId]) return;

    const currentState = this.hass.states[entityId].state;
    const previousState = this.previousStates[entityId];

    if (currentState === targetState && previousState !== targetState) {
      const conditionState = this.hass.states[conditionEntityId];
      const conditionCurrent = conditionState ? conditionState.state : null;
      
      const message = conditionCurrent === conditionValue ? messageIfTrue : messageIfFalse;
      this.addTimelineEvent(message, icon);
    }

    this.previousStates[entityId] = currentState;
  }

  shouldAddFoodBowlEvent(timestamp) {
    if (this.lastFoodBowlEventTime === null) {
      return true;
    }
    const fiveMinutes = 5 * 60 * 1000;
    const timeSinceLastEvent = timestamp.getTime() - this.lastFoodBowlEventTime.getTime();
    return timeSinceLastEvent >= fiveMinutes;
  }

  addTimelineEvent(message, icon) {
    const now = new Date();
    
    if (message === 'Sadie ate from her food bowl') {
      if (!this.shouldAddFoodBowlEvent(now)) {
        return;
      }
      this.lastFoodBowlEventTime = now;
    }

    const event = {
      message: message,
      icon: icon,
      timestamp: now,
      formattedTime: this.formatTimestamp(now)
    };

    this.timelineEvents = [event, ...this.timelineEvents];
    
    if (this.maxEvents !== null && this.timelineEvents.length > this.maxEvents) {
      this.timelineEvents = this.timelineEvents.slice(0, this.maxEvents);
    }
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
    
    if (this.maxTimeAgo) {
      const now = new Date();
      const maxTimeAgoMs = this.maxTimeAgo * 60 * 60 * 1000;
      const cutoffTime = new Date(now.getTime() - maxTimeAgoMs);
      filtered = filtered.filter(event => event.timestamp >= cutoffTime);
    }
    
    // Don't apply max_events here - we'll apply it after collapsing
    // so that ellipsis markers don't count toward the limit
    
    return filtered;
  }

  getIconColorForEvent(event) {
    const message = event.message || '';
    const isSadieEvent = message.includes('Sadie');
    
    if (isSadieEvent) {
      return this.sadieIconColour || 'var(--primary-color, #03a9f4)';
    } else {
      // Other cat events: use other_cat_icon_colour if set, otherwise use sadie_icon_colour (primary)
      return this.otherCatIconColour || this.sadieIconColour || 'var(--primary-color, #03a9f4)';
    }
  }

  getTimelineLineStyle(events) {
    if (!events || events.length === 0) return '';
    const defaultColor = this.sadieIconColour || 'var(--primary-color, #03a9f4)';
    return `background: ${defaultColor};`;
  }

  collapseConsecutiveDuplicates(events) {
    if (events.length === 0) return events;
    
    const collapsed = [];
    let i = 0;
    
    while (i < events.length) {
      const currentMessage = events[i].message;
      let count = 1;
      
      // Count consecutive duplicates
      while (i + count < events.length && events[i + count].message === currentMessage) {
        count++;
      }
      
      if (count > 2) {
        // Add first two events
        collapsed.push(events[i]);
        collapsed.push(events[i + 1]);
        // Add ellipsis marker
        collapsed.push({ isEllipsis: true, message: currentMessage });
        // Skip to after the duplicates
        i += count;
      } else {
        // Add all events (1 or 2)
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
    
    // Apply max_events after collapsing, counting only actual events (not ellipsis)
    if (this.maxEvents !== null) {
      let eventCount = 0;
      const limitedEvents = [];
      for (const event of collapsedEvents) {
        if (event.isEllipsis) {
          limitedEvents.push(event);
        } else {
          if (eventCount < this.maxEvents) {
            limitedEvents.push(event);
            eventCount++;
          } else {
            break; // Stop once we've reached max_events actual events
          }
        }
      }
      collapsedEvents = limitedEvents;
    }
    
    const hasEvents = collapsedEvents.length > 0;
    const defaultIconColor = this.sadieIconColour || 'var(--primary-color, #03a9f4)';
    const scrollbarColor = this.sadieIconColour || 'var(--primary-color, #03a9f4)';
    const timelineLineStyle = hasEvents ? this.getTimelineLineStyle(filteredEvents) : '';


    return html`
      <ha-card style="--icon-color: ${defaultIconColor}; --scrollbar-color: ${scrollbarColor};">
        <div class="card">
          <div class="timeline-container">
            <div class="timeline">
              ${hasEvents 
                ? collapsedEvents.map(event => {
                    if (event.isEllipsis) {
                      return html`
                        <div class="timeline-event timeline-ellipsis">
                          <div class="event-content">
                            <div class="event-message-wrapper">
                              <div class="event-message">...</div>
                            </div>
                          </div>
                        </div>
                      `;
                    }
                    const eventIconColor = this.getIconColorForEvent(event);
                    const isBowlIcon = event.icon === 'mdi:bowl';
                    const isCameraEvent = event.icon === 'mdi:camera';
                    const isKattcam1 = isCameraEvent && (event.message.includes('hole under the fence'));
                    const isKattcam2 = isCameraEvent && (event.message.includes('back corner'));
                    
                    const handleCameraClick = () => {
                      if (!this.hass) return;
                      
                      let urlPath;
                      if (isKattcam1) {
                        urlPath = 'app%2Cmedia-source%3A%2F%2Ffrigate/video%2Cmedia-source%3A%2F%2Ffrigate%2Ffrigate%2Fevent-search%2Fclips%2F%2F%2F%2F%2F%2F/video%2Cmedia-source%3A%2F%2Ffrigate%2Ffrigate%2Fevent-search%2Fclips%2F.plc_kattcam%2F%2F%2Fplc_kattcam%2F%2F';
                      } else if (isKattcam2) {
                        urlPath = 'app%2Cmedia-source%3A%2F%2Ffrigate/video%2Cmedia-source%3A%2F%2Ffrigate%2Ffrigate%2Fevent-search%2Fclips%2F%2F%2F%2F%2F%2F/video%2Cmedia-source%3A%2F%2Ffrigate%2Ffrigate%2Fevent-search%2Fclips%2F.plc_kattcam_2%2F%2F%2Fplc_kattcam_2%2F%2F';
                      } else {
                        return;
                      }
                      
                      const url = this.hass.hassUrl(`/media-browser/browser/${urlPath}`);
                      window.open(url, '_blank');
                    };
                    
                    return html`
                    <div class="timeline-event ${isCameraEvent ? 'timeline-event-clickable' : ''}">
                      ${event.icon 
                        ? html`<div class="timeline-icon ${isBowlIcon ? 'timeline-icon-bowl' : ''}"><ha-icon .icon=${event.icon} style="color: ${eventIconColor};"></ha-icon></div>`
                        : html`<div class="timeline-icon"></div>`}
                      <div class="event-content" @click=${isCameraEvent ? handleCameraClick : nothing}>
                        <div class="event-message-wrapper">
                          <div class="event-message">${event.message}</div>
                        </div>
                        <div class="event-time">${event.formattedTime}</div>
                      </div>
                    </div>
                  `;
                  })
                : html`<div class="timeline-empty">No events</div>`
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
    }
    .card {
      padding: 16px;
      font-family: var(--ha-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif);
      height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }
    .timeline-container {
      position: relative;
      flex: 1;
      overflow-y: auto;
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
      background: var(--scrollbar-color, var(--primary-color, #03a9f4));
      border-radius: 4px;
    }
    .timeline-container::-webkit-scrollbar-thumb:hover {
      opacity: 0.8;
    }
    .timeline-container {
      scrollbar-width: thin;
      scrollbar-color: var(--scrollbar-color, var(--primary-color, #03a9f4)) transparent;
    }
    .timeline {
      position: relative;
      padding-left: 32px;
    }
    .timeline-line {
      position: absolute;
      left: 11px;
      top: 0;
      bottom: 0;
      width: 2px;
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
    .timeline-event-clickable .event-content {
      cursor: pointer;
    }
    .timeline-event-clickable .event-content:hover {
      opacity: 0.8;
    }
    .timeline-icon {
      position: absolute;
      left: -32px;
      top: 2px;
      width: 20px;
      height: 20px;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .timeline-icon-bowl {
      top: -4px;
    }
    .timeline-icon ha-icon {
      width: 20px;
      height: 20px;
    }
    .event-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-left: 8px;
    }
    .event-message-wrapper {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .event-message {
      flex: 1;
      font-size: 15px;
      color: var(--primary-text-color, #212121);
      line-height: 1.5;
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

customElements.define('cat-timeline-card', CatTimelineCard);

// Editor
class CatTimelineCardEditor extends LitElement {
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

  render() {
    if (!this._config) {
      return nothing;
    }

    return html`
      <div class="card-config">
        <div class="config-section">
          <div class="config-row">
            <label>Maximum events (leave empty for no limit)</label>
            <input
              type="number"
              .value=${this._config.max_events !== undefined && this._config.max_events !== null && this._config.max_events !== '' ? String(this._config.max_events) : ''}
              min="1"
              max="1000"
              placeholder="e.g. 10"
              @input=${(e) => {
                const value = e.target.value.trim();
                this._valueChanged('max_events', value === '' ? null : parseInt(value) || null);
              }}
            />
            <div class="config-help">
              Maximum number of events to show. Leave empty to show all events.
            </div>
          </div>
          <div class="config-row">
            <label>Maximum time ago (hours, leave empty for no limit)</label>
            <input
              type="number"
              .value=${this._config.max_time_ago || ''}
              min="1"
              step="0.5"
              placeholder="e.g. 24"
              @input=${(e) => {
                const value = e.target.value.trim();
                this._valueChanged('max_time_ago', value === '' ? null : parseFloat(value) || null);
              }}
            />
            <div class="config-help">
              Only show events from the last X hours. Leave empty to show all events.
            </div>
          </div>
          <div class="config-row">
            <label>Sadie icon colour (hex code or CSS variable)</label>
            <input
              type="text"
              .value=${this._config.sadie_icon_colour || ''}
              placeholder="e.g. #ff0000 or var(--accent-color)"
              @input=${(e) => {
                const value = e.target.value.trim();
                this._valueChanged('sadie_icon_colour', value === '' ? null : value);
              }}
            />
            <div class="config-help">
              Primary colour for timeline icons (Sadie events). This is also used as the default/fallback colour.
            </div>
            <label>Other cat icon colour (hex code or CSS variable)</label>
            <input
              type="text"
              .value=${this._config.other_cat_icon_colour || ''}
              placeholder="e.g. #00ff00 or var(--accent-color)"
              @input=${(e) => {
                const value = e.target.value.trim();
                this._valueChanged('other_cat_icon_colour', value === '' ? null : value);
              }}
            />
            <div class="config-help">
              Colour for timeline icons of other cat events. Leave empty to use Sadie colour (primary).
            </div>
          </div>
        </div>
        <div class="config-info">
          This card automatically monitors cat-related entities and displays timeline events.
        </div>
      </div>
    `;
  }

  static styles = css`
    .card-config {
      padding: 16px;
    }
    .config-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .config-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .config-row label {
      color: var(--primary-text-color, #212121);
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .config-row input {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
      background: var(--card-background-color, #ffffff);
      color: var(--primary-text-color, #212121);
    }
    .config-row input[type="text"] {
      font-family: monospace;
    }
    .config-row input:focus {
      outline: none;
      border-color: var(--primary-color, #03a9f4);
    }
    .config-help {
      font-size: 12px;
      color: var(--secondary-text-color, #757575);
      margin-top: 4px;
    }
    .config-info {
      margin-top: 16px;
      padding: 12px;
      background: transparent;
      border-radius: 4px;
      color: var(--primary-text-color, #212121);
      font-size: 13px;
    }
  `;
}

customElements.define('cat-timeline-card-editor', CatTimelineCardEditor);

// Register custom card for card picker
if (window.registerCustomCard) {
  window.registerCustomCard({
    type: 'custom:cat-timeline-card',
    name: 'Cat Timeline',
    description: 'Display a timeline of cat-related events',
  });
}
