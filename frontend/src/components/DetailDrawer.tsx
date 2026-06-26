import { useEffect, useState, useRef } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { X, Cpu, HardDrive, Terminal } from 'lucide-react';

export default function DetailDrawer() {
  const { selectedNodeId, nodes, metricsHistory, setSelectedNodeId, theme, codeChanges } = useGraphStore();
  const [logs, setLogs] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Find the selected node
  const node = nodes.find((n) => n.id === selectedNodeId) as any;

  // Match modified files to this node
  const getNodeChanges = () => {
    if (!node) return [];
    const idLower = node.id.toLowerCase();
    const labelLower = (node.data?.label || '').toLowerCase();
    
    return codeChanges.filter(change => {
      const pathLower = change.path.toLowerCase();
      
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

  // Auto-scroll terminal logs to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Generate mock logs based on node type
  useEffect(() => {
    if (!selectedNodeId || !node) {
      setLogs([]);
      return;
    }

    const nodeId = node.id;
    const nodeType = node.data?.type || 'app';
    let isSimulating = false;
    let simInterval: any = null;
    let fetchInterval: any = null;

    // Initial logs
    const initialLogs = [
      `[SYSTEM] Connecting to container: ${nodeId}...`,
      `[SYSTEM] Connection established. Streaming daemon logs...`,
    ];
    setLogs(initialLogs);

    const logTemplates: Record<string, string[]> = {
      gateway: [
        'GET /api/v1/products - 200 OK (12ms)',
        'GET /api/v1/cart - 200 OK (15ms)',
        'POST /api/v1/auth/login - 200 OK (45ms)',
        'GET /assets/index.js - 304 Not Modified (2ms)',
        'GET /api/v1/users/profile - 401 Unauthorized (8ms)',
        'POST /api/v1/checkout - 201 Created (120ms)',
        'GET /api/v1/promotions - 200 OK (20ms)',
      ],
      database: [
        'SELECT * FROM products WHERE active = true LIMIT 20; (3ms)',
        'SELECT val FROM sessions WHERE id = \'sess_94f27a\' LIMIT 1; (1ms)',
        'INSERT INTO cart_items (cart_id, product_id, qty) VALUES (12, 104, 1); (8ms)',
        'UPDATE users SET last_login = NOW() WHERE id = 42; (12ms)',
        'BEGIN; COMMIT; Transaction completed successfully. (15ms)',
        'SELECT COUNT(*) FROM access_logs; (45ms)',
      ],
      default: [
        'Dispatcher processing request from Gateway...',
        'AuthToken validated successfully for user: 42',
        'Fetching catalog items from memory store...',
        'Serialized JSON response: 24 items in catalog.',
        'Garbage collector sweep: freed 14.5MB heap.',
        'Redis cache hit for key: catalog_all',
        'Queue worker consumed task: send_welcome_email',
      ],
    };

    const templates = logTemplates[nodeType] || logTemplates.default;

    const startSimulation = (reason?: string) => {
      if (isSimulating) return;
      isSimulating = true;
      if (fetchInterval) clearInterval(fetchInterval);

      setLogs((prev) => [
        ...prev,
        `[SYSTEM] ${reason || 'Docker connection unavailable. Initializing telemetry simulation...'}`
      ]);

      simInterval = setInterval(() => {
        const randomMsg = templates[Math.floor(Math.random() * templates.length)];
        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => [...prev, `[${timestamp}] ${randomMsg}`]);
      }, 2000);
    };

    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/logs?nodeId=${encodeURIComponent(nodeId)}`);
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const data = await res.json();
        if (data.error) {
          startSimulation(data.error);
        } else if (data.logs) {
          const rawLines = data.logs.split('\n').map((line: string) => line.trim()).filter(Boolean);
          if (rawLines.length > 0) {
            setLogs(rawLines);
          } else {
            setLogs([
              `[SYSTEM] Connected to container ${nodeId}`,
              `[SYSTEM] No log output generated by container yet.`
            ]);
          }
        }
      } catch (err: any) {
        startSimulation(`Failed to fetch logs: ${err.message}`);
      }
    };

    fetchLogs();
    fetchInterval = setInterval(fetchLogs, 2500);

    return () => {
      if (fetchInterval) clearInterval(fetchInterval);
      if (simInterval) clearInterval(simInterval);
    };
  }, [selectedNodeId, node]);

  if (!node) return null;

  const metadata = node.data?.metadata || {};
  const isDark = theme === 'dark';

  // SVG Sparkline path builder helper
  const drawSparkline = (dataPoints: number[], strokeClr: string, fillId: string) => {
    if (!dataPoints || dataPoints.length < 2) return null;
    const W = 260;
    const H = 60;
    const N = dataPoints.length;

    // Create line path points
    const points = dataPoints.map((val, i) => {
      const x = (i / (N - 1)) * W;
      // Clamp values between 0 and 100
      const clampedVal = Math.max(0, Math.min(100, val));
      const y = H - (clampedVal / 100) * H;
      return `${x},${y}`;
    });

    const linePath = `M ${points.join(' L ')}`;
    const areaPath = `${linePath} L ${W},${H} L 0,${H} Z`;

    return (
      <svg width="100%" height="60" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeClr} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeClr} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* Glow behind line */}
        <path d={linePath} fill="none" stroke={strokeClr} strokeWidth="3" strokeLinecap="round" opacity="0.3" filter="blur(2px)" />
        {/* Area fill */}
        <path d={areaPath} fill={`url(#${fillId})`} />
        {/* Main Line */}
        <path d={linePath} fill="none" stroke={strokeClr} strokeWidth="2" strokeLinecap="round" />
        {/* Last point dot */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].split(',')[0]}
            cy={points[points.length - 1].split(',')[1]}
            r="4"
            fill={strokeClr}
            className="animate-pulse"
          />
        )}
      </svg>
    );
  };

  // Get metrics history for this node
  const nodeHistory = metricsHistory[node.id] || { cpu: [], ram: [], network: [] };
  const currentCPU = nodeHistory.cpu[nodeHistory.cpu.length - 1] || 0;
  const currentRAM = nodeHistory.ram[nodeHistory.ram.length - 1] || 0;

  return (
    <div
      className={`fixed top-20 right-4 w-[320px] h-[calc(100vh-100px)] border-2 rounded-2xl p-5 z-20 transition-all duration-300 transform select-none ${
        selectedNodeId ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
      } ${
        isDark
          ? 'bg-zinc-950/80 border-zinc-900 text-zinc-100 backdrop-blur-xl shadow-2xl shadow-cyan-950/10'
          : 'bg-white/90 border-slate-200 text-slate-900 shadow-xl shadow-slate-200 backdrop-blur-xl'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="flex items-center space-x-3">
          {node.data?.logoUrl ? (
            <div className={`w-8 h-8 rounded-lg p-1.2 flex items-center justify-center border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
              <img src={node.data.logoUrl} alt="" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <span className="text-xs font-bold text-cyan-400 font-mono">L</span>
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate leading-snug">{node.data?.label}</h3>
            {node.data?.type && (
              <span className="text-[9px] font-mono font-bold uppercase text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                {node.data.type}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          className={`p-1.5 border rounded-lg transition-all ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-200'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Node Metadata Details */}
      <div className="mt-4 space-y-2">
        <div>
          <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Node ID</span>
          <div className={`text-xs font-mono font-bold mt-0.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{node.id}</div>
        </div>
        {metadata.image && (
          <div>
            <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Docker Image</span>
            <div className={`text-[10px] font-mono font-bold mt-0.5 truncate ${isDark ? 'text-zinc-300' : 'text-slate-700'}`} title={metadata.image}>
              {metadata.image}
            </div>
          </div>
        )}
        {metadata.ports && (
          <div>
            <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Ports Mapping</span>
            <div className={`text-xs font-mono font-bold mt-0.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{metadata.ports}</div>
          </div>
        )}
      </div>

      {/* Agent Code Changes Section */}
      {nodeChanges.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-mono font-bold">
            <span className={isDark ? 'text-zinc-400' : 'text-slate-500'}>📝 Modified Files</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-green-500/10 border border-green-500/20 text-green-400 animate-pulse">
              Agent Activity
            </span>
          </div>
          <div className={`max-h-[100px] overflow-y-auto pr-1 space-y-1.5 border rounded-xl p-2.5 scrollbar-thin ${
            isDark ? 'bg-zinc-950/40 border-zinc-900/60' : 'bg-slate-50 border-slate-100'
          }`}>
            {nodeChanges.map((change, idx) => {
              const filename = change.path.split('/').pop() || change.path;
              return (
                <div key={idx} className="flex items-center justify-between text-[10px] font-mono leading-tight">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className={`font-bold truncate ${isDark ? 'text-zinc-300' : 'text-slate-700'}`} title={change.path}>
                      {filename}
                    </div>
                    <div className={`text-[8px] truncate ${isDark ? 'text-zinc-600' : 'text-slate-400'}`} title={change.path}>
                      {change.path}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className={`px-1 rounded text-[8px] font-bold uppercase ${
                      change.status === 'added' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                      change.status === 'deleted' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {change.status}
                    </span>
                    <span className="flex items-center space-x-0.5 text-[9px]">
                      {change.additions > 0 && <span className="text-green-500 font-bold">+{change.additions}</span>}
                      {change.deletions > 0 && <span className="text-red-500 font-bold">-{change.deletions}</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sparklines Area (Real-time charts) */}
      <div className="mt-5 space-y-4">
        {/* CPU Sparkline */}
        <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-950/60 border-zinc-900/60' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center justify-between mb-1.5 text-xs font-mono">
            <div className="flex items-center space-x-1.5 font-bold">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>CPU Utilization</span>
            </div>
            <span className={`font-bold ${currentCPU > 80 ? 'text-red-400 animate-pulse' : 'text-cyan-400'}`}>
              {Math.round(currentCPU)}%
            </span>
          </div>
          <div className="h-[60px] flex items-center justify-center">
            {nodeHistory.cpu.length > 1 ? (
              drawSparkline(nodeHistory.cpu, '#06b6d4', 'cpu-gradient')
            ) : (
              <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-600' : 'text-slate-300'}`}>Awaiting telemetry stats...</span>
            )}
          </div>
        </div>

        {/* RAM Sparkline */}
        <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-950/60 border-zinc-900/60' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center justify-between mb-1.5 text-xs font-mono">
            <div className="flex items-center space-x-1.5 font-bold">
              <HardDrive className="w-3.5 h-3.5 text-purple-400" />
              <span>RAM Consumption</span>
            </div>
            <span className={`font-bold ${currentRAM > 80 ? 'text-red-400 animate-pulse' : 'text-purple-400'}`}>
              {Math.round(currentRAM)}%
            </span>
          </div>
          <div className="h-[60px] flex items-center justify-center">
            {nodeHistory.ram.length > 1 ? (
              drawSparkline(nodeHistory.ram, '#a855f7', 'ram-gradient')
            ) : (
              <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-600' : 'text-slate-300'}`}>Awaiting telemetry stats...</span>
            )}
          </div>
        </div>
      </div>

      {/* Terminal Mock Log Stream */}
      <div className="mt-5 flex-1 flex flex-col min-h-[140px] max-h-[180px]">
        <div className="flex items-center space-x-1.5 mb-1.5 text-xs font-mono font-bold">
          <Terminal className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
          <span>Console Log Stream</span>
        </div>
        <div className="flex-1 bg-zinc-950/90 text-green-400 border border-zinc-900 rounded-xl p-3 font-mono text-[9px] overflow-y-auto space-y-1 scrollbar-thin select-text">
          {logs.map((log, index) => (
            <div key={index} className="leading-relaxed whitespace-pre-wrap word-break">
              {log}
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
