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

function degree(node, nodei) {
  return Array.prototype.reduce.call(
    node,
    (acc, cur, curi) => acc + (cur > 0 && curi !== nodei ? 1 : 0), 0,
  );
}

export function kNNSkillsMatrixPruning(matrix, knn, preventIsolated) {
  const N = matrix.length;
  const nns = knn.knnIndices;
  const d = matrix.map(degree);
  for (let i = 0; i < N; i += 1) {
    matrix[i][i] = 0;
    if (preventIsolated && d[i] < knn) {
      continue; // eslint-disable-line no-continue
    }
    for (let j = i + 1; j < N; j += 1) {
      const keepDegree = preventIsolated && d[i] <= 1 && d[j] <= 1;
      if (!nns[i].includes(j) && matrix[i][j] !== 0 && !keepDegree) {
        matrix[i][j] = 0;
        matrix[j][i] = 0;
        d[i] -= 1;
        d[j] -= 1;
      }
    }
  }
}

export function thresholdSkillsMatrixPruning(matrix, threshold) {
  const N = matrix.length;
  const max = Math.max(...matrix.map((m) => Math.max(...m)));
  const boundary = max * threshold;
  for (let i = 0; i < N; i += 1) {
    for (let j = i; j < N; j += 1) {
      if (matrix[i][j] < boundary) {
        matrix[i][j] = 0;
        matrix[j][i] = 0;
      }
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

export function skillsClustersToGroups(matrix, groups) {
  const tree = agnes(matrix, { method: 'ward' });
  const clusters = tree.group(groups);

  const assignments = new Float32Array(matrix.length);
  clusters.children.forEach((g, i) => {
    g.traverse((gg) => {
      if (gg.isLeaf) {
        assignments.set([i], gg.index);
      }
    });
  });
  return assignments;
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
      classes: `bw-${uids[i]}`,
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
      const common = srcSkills.reduce((acc, cur) => (acc + (trgSkills.includes(cur) ? 1 : 0)), 0);
      if (common > 0) {
        links.push({ source: src.uid, target: trg.uid, value: common });
      }
    }
  }
  return { nodes, links };
}

export function buildSkillsMatrix(people) {
  const uids = Object.keys(people);
  const N = uids.length;

  const matrix = [];
  for (let i = 0; i < N; i += 1) {
    matrix[i] = new Float32Array(N);
    matrix[i][i] = people[uids[i]].skills.length;
  }

  for (let i = 0; i < N - 1; i += 1) {
    for (let j = i + 1; j < N; j += 1) {
      const src = people[uids[i]].skills;
      const trg = people[uids[j]].skills;
      const common = src.reduce((acc, cur) => (acc + (trg.includes(cur) ? 1 : 0)), 0);
      if (common > 0) {
        matrix[i][j] = common;
        matrix[j][i] = common;
      }
    }
  }
  return matrix;
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

export function removeNullEntries(m, uids, lut) {
  const res = new Array(lut.length);
  for (let i = 0; i < lut.length; i += 1) {
    res[i] = m[lut[i]].filter((_, j) => lut.includes(j));
  }
  return [res, uids.filter((_, i) => lut.includes(i))];
}

export function buildEmbeddingNetwork(
  people,
  {
    clustering = true,
    clusters = null,
    clusterEmbedding = true,
    clusterEmbeddingComponents = 5,
    clusterNearestNeighbours = 8,
    clusterPreventIsolated = true,
  },
) {
  // TODO review map to list conversion
  people = Object.keys(people).map((uid) => ({
    uid,
    username: people[uid].username,
    skills: people[uid].skills || [],
  }));

  let uids = people.map((o) => o.uid);
  const matrix = buildSkillsMatrix(people);

  // remove null entries from matrix
  const lut = findNullEntriesInMatrix(matrix);
  const [notNullMatrix, notNullUids] = removeNullEntries(matrix, uids, lut);

  // 2d embedding for display
  const umap2 = new UMAP({ nComponents: 2 });
  const embedding = umap2.fit(notNullMatrix);

  if (clustering) {
    // 5d embedding for clustering
    const umap5 = new UMAP({
      nComponents: clusterEmbeddingComponents,
      nNeighbors: clusterNearestNeighbours,
    });
    let nns;
    if (clusterEmbedding) {
      const embedding5 = umap5.fit(notNullMatrix);
      nns = umap5.nearestNeighbors(embedding5);
    } else {
      nns = umap5.nearestNeighbors(notNullMatrix);
    }
    kNNSkillsMatrixPruning(notNullMatrix, nns, clusterPreventIsolated);
  } else {
    thresholdSkillsMatrixPruning(notNullMatrix, 0.1);
  }

  // add null entries back
  let finalMatrix;
  let finalEmbedding;
  if (!clusterPreventIsolated) {
    finalMatrix = matrix.map((f) => Array.from(f));
    finalEmbedding = [];
    let nulled = 0;
    for (let i = 0; i < matrix.length; i += 1) {
      if (lut.indexOf(i) === -1) {
        const theta = (2 * Math.PI) * (nulled / (matrix.length - lut.length));
        finalEmbedding[i] = [Math.cos(theta), Math.sin(theta)];
        nulled += 1;
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
  } else {
    finalEmbedding = embedding;
    finalMatrix = notNullMatrix;
    uids = notNullUids;
  }

  // build network
  const network = matrixToNetwork(finalMatrix, finalEmbedding, uids);

  // cluster groups
  if (clusters === null) {
    const N = finalMatrix.length;
    clusters = ~~(N ** 1 / 2);
  }
  const assignments = skillsClustersToGroups(finalMatrix, clusters);
  network.nodes.forEach((n, i) => {
    n.group = assignments[i];
  });

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
