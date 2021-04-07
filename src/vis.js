import * as d3lib from 'd3';
import forceBoundary from 'd3-force-boundary';
import VisWorker from './vis.worker';

const d3 = {
  ...d3lib,
  distances: {
    euclidean: (zoom) => ({
        source: { x: x1, y: y1 },
        target: { x: x2, y: y2 },
    }) => (((x1 * zoom - x2 * zoom) ** 2 + (y1 * zoom - y2 * zoom) ** 2))
  },
  forceBoundary,
};

export { d3 };

function drag(simulation) {
  function dragstarted(e, d) {
    e.sourceEvent.preventDefault();
    if (!e.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(e, d) {
    e.sourceEvent.preventDefault();
    d.fx = e.x;
    d.fy = e.y;
  }
  function dragended(e, d) {
    e.sourceEvent.preventDefault();
    if (!e.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

export function defaultSimulation(nodes, links, origin) {
  const { x, y, zoom } = origin;
  return d3.forceSimulation(nodes)
    .velocityDecay(0.1 * zoom)
    .force('link', d3.forceLink(links).id((d) => d.id).strength(0.1 * zoom).distance(d3.distances.euclidean(zoom)))
    .force('collision', d3.forceCollide(5 * zoom).iterations(10).strength(0.8 * zoom))
    .force('charge', d3.forceManyBody().strength(-0.3 * zoom))
    .force('y', d3.forceY().strength(0.003 * zoom))
    .force('boundaries', d3.forceBoundary(-x, -y, x, y).hardBoundary(true).strength(0.0001 * zoom));
}

export function buildSVG(
  people,
  network,
  {
    width, height, radius, zoom = 1,
    simulation, scale, onClick,
    circles = true, edges = true, names = true,
  },
) {
  const { nodes, links } = network;
  const [halfW, halfH] = [width / 2, height / 2];

  const origin = { x: halfW, y: halfH, zoom };
  if (simulation) {
    simulation = simulation(nodes, links, origin);
  } else {
    simulation = defaultSimulation(nodes, links, origin);
  }

  const svg = d3.create('svg')
    .attr('viewBox', [0, 0, width, height]);

  const link = edges && svg
    .append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'link')
    .attr('value', (d) => d.value * zoom)
    .attr('stroke-width', (d) => d.value ** 1 / 4);

  const node = svg.append('g')
    .selectAll('.node')
    .data(nodes)
    .join('g')
    .attr('class', 'node')
    .attr('x', (d) => d.x * zoom)
    .attr('y', (d) => d.y * zoom)
    .call(drag(simulation));

  if (circles) {
    if (!scale) {
      scale = d3.scaleOrdinal(d3.schemePaired);
    }

    const circle = node.append('circle')
      .attr('class', (d) => d.classes || '')
      .attr('r', radius)
      .attr('fill', (d) => scale(d.group));

    if (onClick) {
      circle
        .on('click', (e, d) => {
          const { id } = d;
          onClick(e, { id, ...people[id] });
        });
    }
  }

  if (names) {
    node.append('text')
      .attr('class', (d) => `${d.classes || ''} name`)
      .text((d) => people[d.id].displayname)
      .attr('x', 6)
      .attr('y', 3);
  }

  simulation.on('tick', () => {
    if (edges) {
      link
        .attr('x1', (d) => d.source.x + halfW)
        .attr('y1', (d) => d.source.y + halfH)
        .attr('x2', (d) => d.target.x + halfW)
        .attr('y2', (d) => d.target.y + halfH);
    }
    if (circles || names) {
      node
        .attr('transform', (d) => `translate(${d.x + halfW}, ${d.y + halfH})`);
    }
  });

  return svg.node();
}

const worker = new VisWorker();

export function invokeWorker(method, param) {
  return new Promise((resolve, reject) => {
    const uuid = `${crypto.getRandomValues(new Uint32Array(1))}`;

    const handleMessage = (ev) => {
      if (ev.data.id === uuid) {
        worker.removeEventListener('message', handleMessage);
        const { result, error } = ev.data;
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    };
    worker.addEventListener('message', handleMessage);

    worker.postMessage({
      id: uuid,
      method,
      param,
    });
  });
}

export async function buildEmbeddingNetwork(people, params = {}) {
  return invokeWorker(
    'buildEmbeddingNetwork',
    {
      people,
      params,
    },
  );
}

export async function buildNetwork(people, {
  graph, embedding,
}) {
  const prunedNetwork = await buildEmbeddingNetwork(
    people,
    embedding,
  );

  return buildSVG(
    people,
    prunedNetwork,
    graph,
  );
}

export default {
  buildSVG,
  invokeWorker,
  buildEmbeddingNetwork,
  buildNetwork,
};
