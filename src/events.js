// eslint-disable-next-line max-classes-per-file
export class DispatcherEvent {
  constructor(eventName) {
    this.eventName = eventName;
    this.callbacks = [];
  }

  registerCallback(callback, once = false) {
    this.callbacks.push({ callback, once });
  }

  unregisterCallback(callback) {
    const index = this.callbacks.findIndex(
      ({ callback: cb }) => cb === callback,
    );
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  fire(data) {
    this.callbacks = this.callbacks.filter(
      ({ callback, once }) => {
        callback(data);
        return !once;
      },
    );
  }
}

// eslint-disable-next-line max-classes-per-file
export class Dispatcher {
  constructor() {
    this.events = {};
  }

  dispatch(eventName, data) {
    const event = this.events[eventName];
    if (event) {
      event.fire(data);
    }
  }

  on(eventName, callback, once = false) {
    let event = this.events[eventName];
    if (!event) {
      event = new DispatcherEvent(eventName);
      this.events[eventName] = event;
    }
    event.registerCallback(callback, once);
  }

  off(eventName, callback) {
    const event = this.events[eventName];
    if (event) {
      event.unregisterCallback(callback);
      if (event.callbacks.length === 0) {
        delete this.events[eventName];
      }
    }
  }
}
