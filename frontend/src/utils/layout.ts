import dagre from 'dagre';
import { Position } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';

const nodeWidth = 240;
const nodeHeight = 72;
const groupPadding = 45; // Spacing margin for child nodes inside parents

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  // 1. Initialize Dagre with compound mode enabled
  const dagreGraph = new dagre.graphlib.Graph({ compound: true });
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  const groupNodes = nodes.filter((n) => n.type === 'group');
  const leafNodes = nodes.filter((n) => n.type !== 'group');

  // 2. Add group nodes as compound parents with margins
  groupNodes.forEach((group) => {
    dagreGraph.setNode(group.id, { 
      marginx: groupPadding, 
      marginy: groupPadding + 10 
    });
  });

  // 3. Add leaf nodes and set parent relations
  leafNodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    if (node.parentId) {
      dagreGraph.setParent(node.id, node.parentId);
    }
  });

  // 4. Add edges to Dagre (Dagre compound layout needs all edges)
  edges.forEach((edge) => {
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  // 5. Execute compound layout
  dagre.layout(dagreGraph);

  // 6. Extract computed positions and dimensions for group nodes
  const updatedGroupNodes = groupNodes.map((group) => {
    const groupPos = dagreGraph.node(group.id);
    
    // Dagre uses center point, convert to top-left for React Flow
    const width = groupPos.width || 320;
    const height = groupPos.height || 160;
    const x = groupPos.x - width / 2;
    const y = groupPos.y - height / 2;

    return {
      ...group,
      position: { x, y },
      style: { width, height },
    };
  });

  // 7. Extract computed positions for leaf nodes and translate to relative parent offsets
  const updatedLeafNodes = leafNodes.map((node) => {
    const targetPosition = isHorizontal ? Position.Left : Position.Top;
    const sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
    
    const leafPos = dagreGraph.node(node.id);
    if (!leafPos) {
      return {
        ...node,
        targetPosition,
        sourcePosition,
        position: { x: 0, y: 0 },
      };
    }

    // Leaf absolute top-left
    const absX = leafPos.x - nodeWidth / 2;
    const absY = leafPos.y - nodeHeight / 2;

    let finalX = absX;
    let finalY = absY;

    // Convert to parent-relative coordinate if nested
    if (node.parentId) {
      const parentGroup = updatedGroupNodes.find((g) => g.id === node.parentId);
      if (parentGroup) {
        finalX = absX - parentGroup.position.x;
        finalY = absY - parentGroup.position.y;
      }
    }

    return {
      ...node,
      targetPosition,
      sourcePosition,
      position: { x: finalX, y: finalY },
    };
  });

  // 8. Combine layouted nodes (groups first, then leaf nodes)
  const layoutedNodes = [...updatedGroupNodes, ...updatedLeafNodes];

  return { nodes: layoutedNodes, edges };
};
