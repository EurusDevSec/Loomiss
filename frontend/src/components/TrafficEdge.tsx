import { useState } from 'react';
import { BaseEdge, getSmoothStepPath, EdgeLabelRenderer, useNodes } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { getSmartEdge } from '@jalez/react-flow-smart-edge';
import { useGraphStore } from '../store/useGraphStore';

export default function TrafficEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  data,
  source,
  target
}: EdgeProps) {
  const nodes = useNodes();
  const [isHovered, setIsHovered] = useState(false);
  const selectedNodeId = useGraphStore(state => state.selectedNodeId);
  const performanceMode = useGraphStore(state => state.performanceMode);

  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  // Normalize relative coordinates to absolute canvas values and filter out group nodes so pathfinder doesn't block internal paths
  const absoluteNodes = nodes
    .filter(node => node.type !== 'group')
    .map(node => {
      if (node.parentId) {
        let offsetX = 0;
        let offsetY = 0;
        let parent = nodes.find(n => n.id === node.parentId);
        while (parent) {
          offsetX += parent.position.x;
          offsetY += parent.position.y;
          const pId = parent.parentId;
          parent = pId ? nodes.find(n => n.id === pId) : undefined;
        }
        return {
          ...node,
          position: {
            x: node.position.x + offsetX,
            y: node.position.y + offsetY
          }
        };
      }
      return node;
    });

  // Bypass smart routing if performanceMode is enabled
  const smartEdgeResult = performanceMode ? null : getSmartEdge({
    sourcePosition,
    targetPosition,
    sourceX,
    sourceY,
    targetX,
    targetY,
    nodes: absoluteNodes,
    options: {
      nodePadding: 16,
      gridRatio: 25 // Optimized gridRatio for faster pathfinding calculations
    }
  });

  if (smartEdgeResult && !(smartEdgeResult instanceof Error)) {
    edgePath = smartEdgeResult.svgPathString;
    labelX = smartEdgeResult.edgeCenterX;
    labelY = smartEdgeResult.edgeCenterY;
  } else {
    const [fallbackPath, fallbackX, fallbackY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    edgePath = fallbackPath;
    labelX = fallbackX;
    labelY = fallbackY;
  }

  const isDependsOn = typeof label === 'string' && (label.includes('Depends On') || label.includes('depends_on'));

  // Calculate speed of particles based on simulated network traffic (bytes/sec)
  const network = data?.network as number | undefined;
  let dur = '1.8s';
  let showParticle = !performanceMode; // Disable particles animation in performanceMode to reduce rendering overhead

  if (isDependsOn) {
    showParticle = false;
  } else if (network !== undefined && showParticle) {
    if (network === 0) {
      showParticle = false;
    } else if (network > 50000) {
      dur = '0.6s'; // Fast
    } else if (network > 20000) {
      dur = '1.0s';
    } else if (network > 5000) {
      dur = '1.8s'; // Normal
    } else {
      dur = '3.0s'; // Slow
    }
  }

  const isRelated = selectedNodeId ? (source === selectedNodeId || target === selectedNodeId) : false;
  const baseOpacity = selectedNodeId ? (isRelated ? 1.0 : 0.15) : 1.0;
  const currentOpacity = isHovered ? 1.0 : baseOpacity;

  const activeColor = isHovered ? '#06b6d4' : (style.stroke || '#a855f7');
  const particleColor = activeColor;
  const particleRadius = isHovered ? 5.5 : 3.5;

  const isDashed = isDependsOn || 
    (typeof label === 'string' && (
      label.toLowerCase().includes('policy') || 
      label.toLowerCase().includes('role') || 
      label.toLowerCase().includes('vpc_id') || 
      label.toLowerCase().includes('subnet_id') || 
      label.toLowerCase().includes('security_group') || 
      label.toLowerCase().includes('association') ||
      label.toLowerCase().includes('route_table') ||
      label.toLowerCase().includes('cluster') ||
      label.toLowerCase().includes('task_definition') ||
      label.toLowerCase().includes('rest_api_id')
    ));

  const currentStyle = {
    ...style,
    strokeWidth: isHovered ? 4.5 : (style.strokeWidth || 2),
    stroke: activeColor,
    opacity: currentOpacity,
    strokeDasharray: isDashed ? '5,5' : undefined,
    transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
  };

  // Format label string (add custom metrics inside the label if present)
  let displayLabel = label;
  if (network && typeof network === 'number' && !isDependsOn) {
    const kbSec = (network / 1024).toFixed(1);
    displayLabel = label ? `${label} (${kbSec} KB/s)` : `${kbSec} KB/s`;
  }

  return (
    <>
      <defs>
        <filter id="traffic-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: 'pointer' }}
      >
        <BaseEdge path={edgePath} markerEnd={markerEnd} style={currentStyle} />
        
        {showParticle && (
          <circle r={particleRadius} fill={particleColor} filter="url(#traffic-glow)" opacity={currentOpacity}>
            <animateMotion dur={dur} repeatCount="indefinite" path={edgePath} />
          </circle>
        )}
      </g>

      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
               position: 'absolute',
               transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
               background: (labelBgStyle?.fill as string) || '#18181b',
               padding: '2px 6px',
               borderRadius: '4px',
               fontSize: '10px',
               fontWeight: 'bold',
               color: (labelStyle?.fill as string) || '#a1a1aa',
               border: '1px solid rgba(63, 63, 70, 0.4)',
               pointerEvents: 'all',
               userSelect: 'none',
               opacity: currentOpacity,
               transition: 'opacity 0.2s',
            }}
            className="nodrag nopan"
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
