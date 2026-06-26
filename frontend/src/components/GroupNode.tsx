import { useGraphStore } from '../store/useGraphStore';
import { Layers, Folder, Cpu } from 'lucide-react';

interface GroupNodeProps {
  id: string;
  data: {
    label: string;
    borderClr?: string;
    bgClr?: string;
  };
}

export default function GroupNode({ id, data }: GroupNodeProps) {
  const theme = useGraphStore((state) => state.theme);
  const childCount = useGraphStore((state) => state.nodes.filter((n) => n.parentId === id).length);

  const borderClr = data.borderClr || '#3b82f6';
  
  // Clean emoji from label
  const cleanLabel = data.label
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{2600}-\u{26FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{2B50}]/gu, '')
    .trim();

  const labelLower = cleanLabel.toLowerCase();

  // Choose icon and dynamic pluralized category text
  let groupIcon = <Layers className="h-3.5 w-3.5" style={{ color: borderClr }} />;
  let categoryUnit = 'Nodes';

  if (labelLower.includes('docker')) {
    groupIcon = <Cpu className="h-3.5 w-3.5 text-cyan-500" />;
    categoryUnit = childCount === 1 ? 'Container' : 'Containers';
  } else if (labelLower.includes('local') || labelLower.includes('workspace') || labelLower.includes('app')) {
    groupIcon = <Folder className="h-3.5 w-3.5 text-purple-500" />;
    categoryUnit = childCount === 1 ? 'App' : 'Apps';
  } else if (labelLower.includes('devops') || labelLower.includes('monitoring')) {
    groupIcon = <Layers className="h-3.5 w-3.5 text-emerald-500" />;
    categoryUnit = childCount === 1 ? 'Service' : 'Services';
  }

  // Theme settings
  const containerBg = theme === 'dark'
    ? `linear-gradient(135deg, ${borderClr}0a 0%, rgba(9, 9, 11, 0.4) 100%)`
    : `linear-gradient(135deg, ${borderClr}06 0%, rgba(255, 255, 255, 0.5) 100%)`;

  const headerBg = theme === 'dark' ? 'rgba(24, 24, 27, 0.9)' : '#ffffff';
  const headerText = theme === 'dark' ? 'text-zinc-300' : 'text-slate-850';
  const headerBorder = theme === 'dark' ? 'border-zinc-850' : 'border-slate-200';
  const shadowColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(15, 23, 42, 0.04)';

  return (
    <div
      className="rounded-3xl border-2 h-full w-full relative transition-all duration-300 pointer-events-none"
      style={{
        borderColor: theme === 'dark' ? `${borderClr}25` : `${borderClr}45`, // Increased visibility for light theme
        borderLeftColor: borderClr,
        borderLeftWidth: '6px', // Premium vertical accent sidebar
        background: containerBg,
        boxShadow: `0 20px 40px -10px ${shadowColor}, inset 0 0 24px ${borderClr}08`,
      }}
    >
      {/* Decorative vertical grid lines inside the tier */}
      <div 
        className="absolute inset-0 rounded-3xl opacity-10 pointer-events-none"
        style={{
          backgroundImage: theme === 'dark' 
            ? `radial-gradient(circle, ${borderClr}44 1px, transparent 1px)` 
            : `radial-gradient(circle, ${borderClr}55 1.5px, transparent 1.5px)`,
          backgroundSize: '16px 16px',
        }}
      />

      {/* Title tab in top-left */}
      <div
        className={`absolute -top-4 left-6 px-3.5 py-1.5 rounded-xl text-[11px] font-sans ${headerText} border ${headerBorder} flex items-center space-x-2.5 pointer-events-auto select-none shadow-md backdrop-blur-md transition-all duration-300`}
        style={{
          backgroundColor: headerBg,
        }}
      >
        <div className="flex items-center justify-center">
          {groupIcon}
        </div>
        <span className="font-bold tracking-wide">{cleanLabel}</span>
        
        {childCount > 0 && (
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold ${
            theme === 'dark' 
              ? 'bg-zinc-800/80 text-zinc-450 border border-zinc-700/50' 
              : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}>
            {childCount} {categoryUnit}
          </span>
        )}
        
        {/* Pulsing indicator dot */}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: borderClr }}></span>
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: borderClr }}></span>
        </span>
      </div>
    </div>
  );
}
