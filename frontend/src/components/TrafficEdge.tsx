import { BaseEdge, getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

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
  data
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Calculate speed of particles based on simulated network traffic (bytes/sec)
  const network = data?.network as number | undefined;
  let dur = '1.8s';
  let showParticle = true;

  if (network !== undefined) {
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

  const particleColor = style.stroke || '#a855f7';

  // Format label string (add custom metrics inside the label if present)
  let displayLabel = label;
  if (network && typeof network === 'number') {
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

      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      
      {showParticle && (
        <circle r="3.5" fill={particleColor} filter="url(#traffic-glow)">
          <animateMotion dur={dur} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

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
