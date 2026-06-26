import { Handle, Position } from '@xyflow/react';
import { Database, Server, Globe, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { useGraphStore } from '../store/useGraphStore';

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

export default function ArchitectureNode({ id, data, targetPosition, sourcePosition }: ArchitectureNodeProps & { id: string }) {
  const [imgError, setImgError] = useState(false);
  const theme = useGraphStore((state) => state.theme);
  const codeChanges = useGraphStore((state) => state.codeChanges);

  // Match modified files to this node
  const getNodeChanges = () => {
    return codeChanges.filter(change => {
      const pathLower = change.path.toLowerCase();
      const idLower = id.toLowerCase();
      const labelLower = (data.label || '').toLowerCase();
      
      if (idLower === 'nginx' || idLower.includes('gateway') || labelLower.includes('nginx')) {
        return pathLower.includes('frontend/') || pathLower.includes('package.json') || pathLower.endsWith('.tsx') || pathLower.endsWith('.ts') || pathLower.endsWith('.css');
      }
      if (idLower === 'app' || idLower.includes('backend') || idLower.includes('service') || labelLower.includes('go') || labelLower.includes('backend') || labelLower.includes('sneakers')) {
        return pathLower.includes('backend/') || pathLower.includes('go.mod') || pathLower.endsWith('.go');
      }
      if (idLower.includes('db') || idLower.includes('postgres') || idLower.includes('mysql') || idLower.includes('redis') || idLower.includes('mongo') || labelLower.includes('db') || labelLower.includes('database') || labelLower.includes('cache')) {
        return pathLower.includes('docker-compose') || pathLower.includes('.tf') || pathLower.includes('.env');
      }
      return pathLower.includes(idLower);
    });
  };

  const nodeChanges = getNodeChanges();
  const totalAdditions = nodeChanges.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = nodeChanges.reduce((sum, c) => sum + c.deletions, 0);

  // Chọn icon dự phòng dựa trên loại node
  const renderFallbackIcon = () => {
    switch (data.type) {
      case 'gateway':
        return <Globe className="h-5 w-5 text-cyan-500" />;
      case 'database':
        return <Database className="h-5 w-5 text-amber-500" />;
      case 'unknown_service':
        return <HelpCircle className="h-5 w-5 text-zinc-400" />;
      default:
        return <Server className="h-5 w-5 text-purple-500" />;
    }
  };

  const hasLogo = data.logoUrl && !imgError;
  const isGhost = data.type === 'unknown_service';

  // Theme settings
  const bgClr = theme === 'dark' ? 'rgba(9, 9, 11, 0.85)' : '#ffffff';
  const titleText = theme === 'dark' ? 'text-zinc-100' : 'text-slate-900';
  const detailText = theme === 'dark' ? 'text-zinc-400' : 'text-slate-500';
  const extraText = theme === 'dark' ? 'text-zinc-500' : 'text-slate-400';
  const logoBoxBg = theme === 'dark' ? 'bg-zinc-950 border-zinc-800/80' : 'bg-slate-50 border-slate-200/80';

  const isDiffAdd = (data as any).isDiffAdd;
  const isDiffDelete = (data as any).isDiffDelete;

  const cpuVal = (data as any).cpu || 0;
  const isCpuSpike = cpuVal > 80;

  let nodeBorderColor = data.borderClr;
  if (data.activeAgentNode) nodeBorderColor = '#22c55e';
  else if (isDiffAdd) nodeBorderColor = '#22c55e';
  else if (isDiffDelete) nodeBorderColor = '#ef4444';
  else if (isCpuSpike) nodeBorderColor = '#ef4444';

  let nodeBoxShadow = theme === 'dark' 
    ? `0 4px 20px rgba(0, 0, 0, 0.35), 0 0 12px ${data.borderClr}22` 
    : `0 8px 30px rgba(15, 23, 42, 0.05), 0 0 12px ${data.borderClr}12`;

  if (data.activeAgentNode) {
    nodeBoxShadow = '0 0 25px rgba(34, 197, 150, 0.6)';
  } else if (isDiffAdd) {
    nodeBoxShadow = '0 0 20px rgba(34, 197, 94, 0.5)';
  } else if (isDiffDelete) {
    nodeBoxShadow = '0 0 20px rgba(239, 68, 68, 0.4)';
  } else if (isCpuSpike) {
    nodeBoxShadow = '0 0 25px rgba(239, 68, 68, 0.6)';
  }

  const nodeOpacity = isDiffDelete ? 0.5 : 1;

  return (
    <div
      className={`p-3 rounded-xl border-2 w-[240px] text-left transition-all duration-300 select-none relative ${
        data.activeAgentNode ? 'animate-ripple' : ''
      } ${isGhost ? 'border-dashed' : ''} ${
        theme === 'dark' ? 'backdrop-blur-md' : 'shadow-md shadow-slate-100'
      }`}
      style={{
        borderColor: nodeBorderColor,
        boxShadow: nodeBoxShadow,
        background: bgClr,
        opacity: nodeOpacity,
      }}
    >
      {/* Target Connection point */}
      <Handle
        type="target"
        position={targetPosition || Position.Top}
        className="!bg-zinc-400 !w-2.5 !h-2.5 !border-zinc-950 hover:!bg-cyan-400 transition-colors"
      />

      {/* Code changes badge */}
      {nodeChanges.length > 0 && (
        <div 
          className="absolute -top-3 -right-2 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono border shadow-md flex items-center space-x-1 pointer-events-none select-none z-10"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.18)' : 'rgba(34, 197, 94, 0.1)',
            borderColor: 'rgba(34, 197, 94, 0.4)',
            color: '#22c55e',
          }}
          title={`${nodeChanges.length} files modified (+${totalAdditions} / -${totalDeletions})`}
        >
          <span>📝 {nodeChanges.length}</span>
          {(totalAdditions > 0 || totalDeletions > 0) && (
            <span className="text-[8px] opacity-90">
              (+{totalAdditions}/-{totalDeletions})
            </span>
          )}
        </div>
      )}

      <div className="flex items-center space-x-3">
        {/* Hộp Logo hình đại diện */}
        <div className={`flex-shrink-0 w-9 h-9 flex items-center justify-center border rounded-lg p-1.5 shadow-sm ${logoBoxBg}`}>
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
          <div className={`text-xs font-bold truncate ${titleText}`}>{data.label}</div>
          
          {data.metadata?.ports && (
            <div className={`text-[10px] font-mono mt-0.5 truncate ${detailText}`}>
              Port: {data.metadata.ports}
            </div>
          )}
          
          {data.metadata?.image && (
            <div
              className={`text-[9px] font-mono truncate max-w-[170px] mt-0.5 ${extraText}`}
              title={data.metadata.image}
            >
              {data.metadata.image}
            </div>
          )}

          {data.metadata?.resource_type && (
            <div
              className={`text-[9px] font-mono truncate max-w-[170px] mt-0.5 ${extraText}`}
              title={data.metadata.resource_type}
            >
              {data.metadata.resource_type}
            </div>
          )}

          {/* Live Metrics Overlay */}
          {((data as any).cpu !== undefined || (data as any).ram !== undefined) && (
            <div className="mt-2 pt-1.5 border-t border-zinc-200 dark:border-zinc-800/40 flex flex-col space-y-1">
              {(data as any).cpu !== undefined && (
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className={detailText}>CPU</span>
                  <div className="flex items-center space-x-1.5 w-2/3">
                    <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-800/80 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 shadow-[0_0_8px_#06b6d4]"
                        style={{ width: `${(data as any).cpu}%`, backgroundColor: (data as any).cpu > 80 ? '#ef4444' : '#06b6d4' }}
                      />
                    </div>
                    <span className={`w-8 text-right font-bold ${(data as any).cpu > 80 ? 'text-red-500 animate-pulse' : titleText}`}>
                      {Math.round((data as any).cpu)}%
                    </span>
                  </div>
                </div>
              )}
              {(data as any).ram !== undefined && (
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className={detailText}>RAM</span>
                  <div className="flex items-center space-x-1.5 w-2/3">
                    <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-800/80 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 shadow-[0_0_8px_#a855f7]"
                        style={{ width: `${(data as any).ram}%`, backgroundColor: (data as any).ram > 80 ? '#ef4444' : '#a855f7' }}
                      />
                    </div>
                    <span className={`w-8 text-right font-bold ${(data as any).ram > 80 ? 'text-red-500 animate-pulse' : titleText}`}>
                      {Math.round((data as any).ram)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Source Connection point */}
      <Handle
        type="source"
        position={sourcePosition || Position.Bottom}
        className="!bg-zinc-400 !w-2.5 !h-2.5 !border-zinc-950 hover:!bg-cyan-400 transition-colors"
      />
    </div>
  );
}
