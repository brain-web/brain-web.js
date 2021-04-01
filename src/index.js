import * as firebase from './firebase';
import { Dispatcher } from './events';
import * as vis from './vis';

export class BrainWeb {
  constructor() {
    this.events = new Dispatcher();
    this.vis = vis;
  }

  init() {
    this.firebase = firebase.init(this.events);
  }

  on(eventName, callback) {
    this.events.on(eventName, callback);
  }

  off(eventName, callback) {
    this.events.off(eventName, callback);
  }
}

const instance =  new BrainWeb();
export default instance;
