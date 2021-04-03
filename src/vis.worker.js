// @TODO review
// required for now
// https://github.com/PAIR-code/umap-js/issues/37#issuecomment-614117618
// const window = self;

import { UMAP } from 'umap-js';
import { agnes } from 'ml-hclust';

export function normalise(v) {
  const n = Math.sqrt(v[0] ** 2 + v[1] ** 2);
  return [v[0] / n, v[1] / n];
}

export function findPrincipalComponents(m) {
  let mx = 0;
  let my = 0;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (let i = 0; i < m.length; i += 1) {
    mx += m[i][0];
    my += m[i][1];
  }
  mx /= m.length;
  my /= m.length;
  for (let i = 0; i < m.length; i += 1) {
    xx += (m[i][0] - mx) ** 2;
    yy += (m[i][1] - my) ** 2;
    xy += (m[i][0] - mx) * (m[i][1] - my);
  }

  // http://people.math.harvard.edu/~knill/teaching/math21b2004/exhibits/2dmatrices/index.html
  // matrix is [sum(xi^2)  sum(xi*yi)]
  //           [sum(xi*yi) sum(yi^2)]
  const t = (xx + yy) / 2;
  const d = xx * yy - xy ** 2;
  const k = Math.sqrt(t ** 2 - d);
  const l1 = t + k;
  const l2 = t - k;
  let e1; let
    e2;
  if (l1 > l2) {
    e1 = normalise([xy, l1 - xx]);
    e2 = normalise([xy, l2 - xx]);
  } else {
    e1 = normalise([xy, l2 - xx]);
    e2 = normalise([xy, l1 - xx]);
  }
  return { mean: [mx, my], evec1: e1, evec2: e2 };
}

export function kNNSkillsMatrixPruning(matrix, embedding, K) {
  const N = matrix.length;
  const D = embedding[0].length;

  const dist = new Array(N);
  for (let i = 0; i < N; i += 1) {
    dist[i] = new Float32Array(N);
  }

  for (let i = 0; i < N; i += 1) {
    for (let j = i; j < N; j += 1) {
      let d = 0;
      for (let k = 0; k < D; k += 1) {
        d += (embedding[i][k] - embedding[j][k]) ** 2;
      }
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }
  const map = (a, fn) => Array.prototype.map.call(a, fn);
  for (let i = 0; i < N; i += 1) {
    const sorted = map(dist[i], (val, ind) => [val, ind])
      .sort((a, b) => b[0] - a[0]);

    for (let j = 0; j < N - K; j += 1) {
      matrix[i][sorted[j][1]] = 0;
    }
  }
}

export function networkToSkillsMatrix(network, people) {
  const N = network.nodes.length;
  const uids = network.nodes.map((o) => o.id);

  const matrix = [];
  for (let i = 0; i < N; i += 1) {
    matrix[i] = new Float32Array(N);
    matrix[i][i] = people[i].skills.length;
  }

  network.links.forEach(
    (e) => {
      const i = uids.indexOf(e.source);
      const j = uids.indexOf(e.target);
      matrix[j][i] = e.value;
      matrix[i][j] = e.value;
    },
  );

  return matrix;
}

export function skillsClustersToGroups(matrix, network, groups) {
  const tree = agnes(matrix, { method: 'ward' });
  const clusters = tree.group(groups);

  clusters.children.forEach((g, i) => {
    g.traverse((gg) => {
      if (gg.isLeaf) {
        network.nodes[gg.index].group = i;
      }
    });
  });
}

export function matrixToNetwork(matrix, embedding, uids) {
  const nodes = [];
  const links = [];
  const N = matrix.length;
  for (let i = 0; i < N; i += 1) {
    nodes[i] = {
      id: uids[i],
      x: embedding[i][0],
      y: embedding[i][1],
      classes: `brainweb-${uids[i]}`,
    };
    for (let j = 0; j < N; j += 1) {
      if (i !== j && matrix[i][j] > 0) {
        links.push({ source: uids[i], target: uids[j], value: matrix[i][j] });
      }
    }
  }
  return { nodes, links };
}

export function buildNetwork(people) {
  const nodes = people.map((p) => ({
    id: p.uid,
    group: 1,
  }));

  const links = [];

  for (let i = 0; i < people.length - 1; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      const src = people[i];
      const trg = people[j];
      const srcSkills = src.skills;
      const trgSkills = trg.skills;
      const common = srcSkills.reduce((acc, cur) => (acc + trgSkills.includes(cur) ? 1 : 0), 0);
      if (common > 0) {
        links.push({ source: src.uid, target: trg.uid, value: common });
      }
    }
  }
  return { nodes, links };
}

export function findNullEntriesInMatrix(m) {
  const lut = [];
  let j = 0;
  for (let i = 0; i < m.length; i += 1) {
    const sum = m[i].reduce((a, b) => a + b);
    if (sum > 0) {
      lut[j] = i;
      j += 1;
    }
  }
  return lut;
}

export function removeNullEntriesInMatrix(m, lut) {
  const res = new Array(lut.length);
  for (let i = 0; i < lut.length; i += 1) {
    res[i] = new Float32Array(m[lut[i]]);
  }
  return res;
}

export function buildEmbeddingNetwork(
  people,
  {
    clustering = true,
    clusters = null,
    clusterEmbeddingComponents = 5,
    clusterNearestNeighbours = 8,
  },
) {
  // TODO review map to list conversion
  people = Object.keys(people).map((uid) => ({
    uid,
    username: people[uid].username,
    skills: people[uid].skills || [],
  }));

  const uids = people.map((o) => o.uid);
  const fullNetwork = buildNetwork(people);
  const matrix = networkToSkillsMatrix(fullNetwork, people);

  // remove null entries from matrix
  const lut = findNullEntriesInMatrix(matrix);
  const notNullMatrix = removeNullEntriesInMatrix(matrix, lut);

  // 2d embedding for display
  const umap2 = new UMAP({ nComponents: 2 });
  const embedding = umap2.fit(notNullMatrix);

  // align embedding axes
  const axes = findPrincipalComponents(embedding);
  const { mean, evec1, evec2 } = axes;

  for (let i = 0; i < embedding.length; i += 1) {
    let [x, y] = embedding[i];
    x -= mean[0];
    y -= mean[1];
    embedding[i][0] = x * evec1[0] + y * evec1[1];
    embedding[i][1] = x * evec2[0] + y * evec2[1];
  }

  // 5d embedding for clustering
  const umap5 = new UMAP({ nComponents: clusterEmbeddingComponents });
  const embedding5 = umap5.fit(notNullMatrix);

  kNNSkillsMatrixPruning(notNullMatrix, embedding5, clusterNearestNeighbours);

  // add null entries back
  const finalMatrix = JSON.parse(JSON.stringify(matrix));
  const finalEmbedding = [];
  let notNull = 0;
  for (let i = 0; i < matrix.length; i += 1) {
    if (lut.indexOf(i) < 0) {
      const theta = (2 * Math.PI) * (notNull / (matrix.length - lut.length));
      finalEmbedding[i] = [Math.cos(theta), Math.sin(theta)];
      notNull += 1;
    }
    for (let j = 0; j < matrix.length; j += 1) {
      finalMatrix[i][j] = 0;
    }
  }
  for (let i = 0; i < lut.length; i += 1) {
    finalEmbedding[lut[i]] = embedding[i];
    for (let j = 0; j < lut.length; j += 1) {
      finalMatrix[lut[i]][lut[j]] = notNullMatrix[i][j];
    }
  }

  // build network
  const network = matrixToNetwork(finalMatrix, finalEmbedding, uids);

  // cluster groups
  if (clusters === null) {
    const N = finalMatrix.length;
    clusters = ~~(N ** 1 / 2);
  }
  skillsClustersToGroups(matrix, network, clusters);

  return network;
}

export function onmessage(message) {
  if (message.data.method === 'buildEmbeddingNetwork') {
    const { id, param } = message.data;
    const {
      people,
      params,
    } = param;
    try {
      const result = buildEmbeddingNetwork(people, params);
      postMessage({ id, result });
    } catch (error) {
      postMessage({ id, error });
    }
  }
}

// eslint-disable-next-line no-restricted-globals
self.onmessage = onmessage;

export default class Worker {
  constructor() {
    this.onmessage = onmessage;
  }

  postMessage(msg) {
    this.onmessage(msg);
  }
}
