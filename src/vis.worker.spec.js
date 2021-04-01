import * as vis from './vis.worker';

it('test embeddings', () => {
  expect(vis.normalise([0, 1])).toEqual([0, 1]);
});
