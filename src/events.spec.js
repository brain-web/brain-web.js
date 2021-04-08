import { Dispatcher } from './events';

test('events', () => {
  const dispatcher = new Dispatcher();

  let called = 0;
  const callback = () => { called += 1; };

  dispatcher.on('burger', callback);

  dispatcher.dispatch('burger');
  dispatcher.dispatch('burger');
  dispatcher.dispatch('burger');
  dispatcher.dispatch('burger');

  expect(called).toEqual(4);
});

test('once events', () => {
  const dispatcher = new Dispatcher();

  let called = 0;
  const callback = () => { called += 1; };

  const anotherCallback = () => { called -= 2; };

  dispatcher.on('burger', callback, true);
  dispatcher.on('burger', callback);
  dispatcher.on('burger', anotherCallback, false);

  dispatcher.dispatch('burger');
  dispatcher.dispatch('burger');
  dispatcher.dispatch('burger');
  dispatcher.dispatch('burger');

  expect(called).toEqual(-3);
});

test('unregister event', () => {
  const dispatcher = new Dispatcher();

  let called = 0;
  const callback = () => { called += 1; };

  dispatcher.on('burger', callback);

  dispatcher.dispatch('burger');
  dispatcher.dispatch('burger');
  dispatcher.dispatch('burger');

  dispatcher.off('burger', callback);

  dispatcher.dispatch('burger');

  expect(called).toEqual(3);
});
