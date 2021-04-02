import * as d3 from 'd3';
import VisWorker from './vis.worker';

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

export function buildSVG(
  people,
  network,
  {
    width, height, radius, simulation, scale,
    onClick,
    circles = true, edges = true, names = true
  },
) {

  const { nodes, links } = network;

  if (simulation) {
    simulation = simulation(nodes, links);
  } else {
    const euclidean = ({
      source: { x: x1, y: y1 },
      target: { x: x2, y: y2 },
    }) => ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 1 / 2;

    simulation = d3.forceSimulation(nodes)
      .velocityDecay(0.1)
      .force(
        'link',
        d3.forceLink(links)
          .id((d) => d.id)
          .distance(euclidean),
      )
      .force('collision', d3.forceCollide(5));
  }

  const svg = d3.create('svg')
    .attr('viewBox', [0, 0, width, height]);

  const link = edges && svg
    .append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'link')
    .attr('stroke-width', (d) => d.value ** 1 / 4);

  function mouseover() {
    d3.select(this).transition()
      .duration(50)
      .attr('r', radius * 2);
  }

  function mouseout() {
    d3.select(this).transition()
      .duration(50)
      .attr('r', radius);
  }

  const node = svg.append('g')
    .selectAll('.node')
    .data(nodes)
    .join('g')
    .attr('class', 'node')
    .call(drag(simulation));

  if (circles) {
    if (!scale) {
      scale = d3.scaleOrdinal(d3.schemePaired);
    }

    const circle = node.append('circle')
      .attr('class', (d) => d.classes || '')
      .attr('r', radius)
      .attr('fill', (d) => scale(d.group))
      .on('mouseover', mouseover)
      .on('mouseout', mouseout);

    if (onClick) {
      circle
        .on('click', (d) => {
          const { id } = d;
          onClick(network.nodes.find((n) => n.id === id));
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

  const [halfW, halfH] = [width / 2, height / 2];

  simulation.on('tick', () => {
    edges && link
      .attr('x1', (d) => d.source.x * 4 + halfW)
      .attr('y1', (d) => d.source.y * 4 + halfH)
      .attr('x2', (d) => d.target.x * 4 + halfW)
      .attr('y2', (d) => d.target.y * 4 + halfH);

    (circles || names) && node
      .attr('transform', (d) => `translate(${d.x * 4 + halfW}, ${d.y * 4 + halfH})`);
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

export async function buildEmbeddingNetwork(people, {
  clusterEmbeddingComponents,
  width,
  height,
  Z,
} = {}) {
  return invokeWorker(
    'buildEmbeddingNetwork',
    {
      people,
      params: {
        clusterEmbeddingComponents,
        width,
        height,
        Z,
      },
    },
  );
}

export async function buildNetwork(people, {
  width, height, radius, Z, simulation, scale,
  onClick, circles, edges, names,
  clusterEmbeddingComponents,
}) {
  const prunedNetwork = await buildEmbeddingNetwork(
    people,
    {
      clusterEmbeddingComponents,
    },
  );
  return buildSVG(
    people,
    prunedNetwork,
    {
      width, height, radius,
      simulation, scale, onClick,
      circles, edges, names,
    },
  );
}

export default {
  buildSVG,
  invokeWorker,
  buildEmbeddingNetwork,
  buildNetwork,
};
