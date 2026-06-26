import dagre from 'dagre';
import { Position } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';

const nodeWidth = 240;
const nodeHeight = 72;
const groupPadding = 45; // Spacing margin for child nodes inside parents
const rowHeight = 130;
const colWidth = 280;

const getRowIndex = (node: Node): number => {
  const idLower = node.id.toLowerCase();
  const labelLower = ((node.data as any)?.label as string || '').toLowerCase();
  const typeLower = ((node.data as any)?.type as string || '').toLowerCase();
  const imageLower = ((node.data as any)?.metadata?.image as string || '').toLowerCase();

  // Row 3: Databases & Caches
  if (
    typeLower === 'database' ||
    idLower.includes('postgres') || idLower.includes('mysql') || idLower.includes('sqlite') ||
    idLower.includes('redis') || idLower.includes('mongo') || idLower.includes('db') || idLower.includes('database') ||
    imageLower.includes('postgres') || imageLower.includes('redis') || imageLower.includes('mysql') || imageLower.includes('mongo')
  ) {
    return 3;
  }

  // Row 0: Gateways & Frontends
  if (
    typeLower === 'gateway' ||
    idLower.includes('nginx') || idLower.includes('gateway') || idLower.includes('proxy') || idLower.includes('caddy') || idLower.includes('traefik') ||
    idLower.includes('frontend') || labelLower.includes('frontend') || idLower.includes('next') || labelLower.includes('next')
  ) {
    return 0;
  }

  // Row 2: Supporting/Asynchronous Services (Workers, Queues, WebSockets)
  if (
    idLower.includes('worker') || labelLower.includes('worker') ||
    idLower.includes('queue') || labelLower.includes('queue') ||
    idLower.includes('soketi') || labelLower.includes('soketi') ||
    idLower.includes('websocket') || labelLower.includes('websocket') ||
    idLower.includes('pusher') || labelLower.includes('pusher')
  ) {
    return 2;
  }

  // Row 1: Core Application Services
  return 1;
};

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  
  const groupNodes = nodes.filter((n) => n.type === 'group');
  const leafNodes = nodes.filter((n) => n.type !== 'group');

  // 1. Calculate custom layered layout for nested nodes inside each group
  const groupDimensions: Record<string, { width: number; height: number }> = {};
  const childRelativePositions: Record<string, { x: number; y: number }> = {};

  groupNodes.forEach((group) => {
    const children = leafNodes.filter((n) => n.parentId === group.id);
    if (children.length === 0) {
      groupDimensions[group.id] = { width: 320, height: 160 };
      return;
    }

    // Group children by row
    const rows: Record<number, Node[]> = { 0: [], 1: [], 2: [], 3: [] };
    children.forEach((child) => {
      const r = getRowIndex(child);
      rows[r].push(child);
    });

    // Compute absolute center-based coordinates
    const coords: Record<string, { x: number; y: number }> = {};
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let r = 0; r < 4; r++) {
      const rowNodes = rows[r];
      const M = rowNodes.length;
      if (M === 0) continue;

      rowNodes.forEach((child, i) => {
        const finalX = (i - (M - 1) / 2) * colWidth;
        const finalY = r * rowHeight;
        coords[child.id] = { x: finalX, y: finalY };

        if (finalX < minX) minX = finalX;
        if (finalX > maxX) maxX = finalX;
        if (finalY < minY) minY = finalY;
        if (finalY > maxY) maxY = finalY;
      });
    }

    // Translate to top-left relative coordinates and set dimensions
    const width = (maxX - minX) + nodeWidth + groupPadding * 2;
    const height = (maxY - minY) + nodeHeight + groupPadding * 2 + 15;
    groupDimensions[group.id] = { width, height };

    children.forEach((child) => {
      const coord = coords[child.id];
      const childX = coord.x - minX + groupPadding;
      const childY = coord.y - minY + groupPadding + 15;
      childRelativePositions[child.id] = { x: childX, y: childY };
    });
  });

  // 2. Initialize Dagre to layout groups and non-nested leaf nodes
  const dagreGraph = new dagre.graphlib.Graph({ compound: false });
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 100,
    ranksep: 100
  });

  // Add group nodes to Dagre with calculated custom dimensions
  groupNodes.forEach((group) => {
    const dim = groupDimensions[group.id];
    dagreGraph.setNode(group.id, { width: dim.width, height: dim.height });
  });

  // Add standalone leaf nodes to Dagre
  const standaloneLeafs = leafNodes.filter((n) => !n.parentId);
  standaloneLeafs.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // Add edges to Dagre between top-level components (groups or standalone nodes)
  edges.forEach((edge) => {
    let src = edge.source;
    let tgt = edge.target;

    // Route edges via their parent groups in Dagre
    const srcNode = leafNodes.find((n) => n.id === src);
    const tgtNode = leafNodes.find((n) => n.id === tgt);
    if (srcNode && srcNode.parentId) src = srcNode.parentId;
    if (tgtNode && tgtNode.parentId) tgt = tgtNode.parentId;

    if (src !== tgt && dagreGraph.hasNode(src) && dagreGraph.hasNode(tgt)) {
      dagreGraph.setEdge(src, tgt);
    }
  });

  // Run Dagre to position the groups and standalone elements
  dagre.layout(dagreGraph);

  // 3. Compute final layout coordinates
  const updatedGroupNodes = groupNodes.map((group) => {
    const groupPos = dagreGraph.node(group.id);
    const dim = groupDimensions[group.id];
    const x = groupPos.x - dim.width / 2;
    const y = groupPos.y - dim.height / 2;

    return {
      ...group,
      position: { x, y },
      style: { width: dim.width, height: dim.height },
    };
  });

  const updatedLeafNodes = leafNodes.map((node) => {
    const targetPosition = isHorizontal ? Position.Left : Position.Top;
    const sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    if (node.parentId) {
      const relPos = childRelativePositions[node.id];
      return {
        ...node,
        targetPosition,
        sourcePosition,
        position: { x: relPos.x, y: relPos.y },
      };
    }

    const leafPos = dagreGraph.node(node.id);
    if (!leafPos) {
      return {
        ...node,
        targetPosition,
        sourcePosition,
        position: { x: 0, y: 0 },
      };
    }

    return {
      ...node,
      targetPosition,
      sourcePosition,
      position: { x: leafPos.x - nodeWidth / 2, y: leafPos.y - nodeHeight / 2 },
    };
  });

  const layoutedNodes = [...updatedGroupNodes, ...updatedLeafNodes];
  return { nodes: layoutedNodes, edges };
};
