import { Handle, Position } from '@xyflow/react';
import { Database, Server, Globe, HelpCircle } from 'lucide-react';
import { useState } from 'react';

interface ArchitectureNodeProps {
  data: {
    label: string;
    type: string;
    status: string;
    metadata?: {
      ports?: string;
      image?: string;
      provider?: string;
      resource_type?: string;
    };
    borderClr: string;
    shadowClr: string;
    logoUrl?: string | null;
    activeAgentNode?: boolean;
  };
  targetPosition?: Position;
  sourcePosition?: Position;
}

export default function ArchitectureNode({ data, targetPosition, sourcePosition }: ArchitectureNodeProps) {
  const [imgError, setImgError] = useState(false);

  // Chọn icon dự phòng dựa trên loại node
  const renderFallbackIcon = () => {
    switch (data.type) {
      case 'gateway':
        return <Globe className="h-5 w-5 text-cyan-400" />;
      case 'database':
        return <Database className="h-5 w-5 text-amber-500" />;
      case 'unknown_service':
        return <HelpCircle className="h-5 w-5 text-zinc-400" />;
      default:
        return <Server className="h-5 w-5 text-purple-400" />;
    }
  };

  const hasLogo = data.logoUrl && !imgError;
  const isGhost = data.type === 'unknown_service';

  return (
    <div
      className={`glass-panel p-3 rounded-xl border-2 w-[240px] text-left transition-all duration-300 select-none ${
        data.activeAgentNode ? 'animate-ripple' : ''
      } ${isGhost ? 'border-dashed' : ''}`}
      style={{
        borderColor: data.activeAgentNode ? '#22c55e' : data.borderClr,
        boxShadow: data.activeAgentNode ? '0 0 25px rgba(34, 197, 150, 0.6)' : `0 0 15px ${data.shadowClr}`,
        background: 'rgba(9, 9, 11, 0.85)',
      }}
    >
      {/* Target Connection point */}
      <Handle
        type="target"
        position={targetPosition || Position.Top}
        className="!bg-zinc-700 !w-2.5 !h-2.5 !border-zinc-950 hover:!bg-cyan-400 transition-colors"
      />

      <div className="flex items-center space-x-3">
        {/* Hộp Logo hình đại diện */}
        <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-zinc-950 border border-zinc-800/80 rounded-lg p-1.5 shadow-inner">
          {hasLogo ? (
            <img
              src={data.logoUrl!}
              alt=""
              className="w-full h-full object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            renderFallbackIcon()
          )}
        </div>

        {/* Nội dung chi tiết Service */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-zinc-100 truncate">{data.label}</div>
          
          {data.metadata?.ports && (
            <div className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">
              Port: {data.metadata.ports}
            </div>
          )}
          
          {data.metadata?.image && (
            <div
              className="text-[9px] text-zinc-500 font-mono truncate max-w-[170px] mt-0.5"
              title={data.metadata.image}
            >
              {data.metadata.image}
            </div>
          )}

          {data.metadata?.resource_type && (
            <div
              className="text-[9px] text-zinc-500 font-mono truncate max-w-[170px] mt-0.5"
              title={data.metadata.resource_type}
            >
              {data.metadata.resource_type}
            </div>
          )}
        </div>
      </div>

      {/* Source Connection point */}
      <Handle
        type="source"
        position={sourcePosition || Position.Bottom}
        className="!bg-zinc-700 !w-2.5 !h-2.5 !border-zinc-950 hover:!bg-cyan-400 transition-colors"
      />
    </div>
  );
}
