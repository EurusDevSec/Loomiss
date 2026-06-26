import { useEffect } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from './store/useGraphStore';
import { Activity, Radio, AlertTriangle, Play, RefreshCw, Sun, Moon } from 'lucide-react';
import ArchitectureNode from './components/ArchitectureNode';
import GroupNode from './components/GroupNode';
import TrafficEdge from './components/TrafficEdge';
import DetailDrawer from './components/DetailDrawer';

const nodeTypes = {
  architectureNode: ArchitectureNode,
  group: GroupNode,
};

const edgeTypes = {
  traffic: TrafficEdge,
};

export default function App() {
  const {
    nodes,
    edges,
    direction,
    error,
    websocketStatus,
    theme,
    setDirection,
    connectWebSocket,
    setActiveAgentNode,
    fetchGraph,
    setTheme,
    setSelectedNodeId,
    codeChanges,
  } = useGraphStore();

  // Khởi động kết nối WebSocket và tải sơ đồ thực tế khi Component Mount
  useEffect(() => {
    fetchGraph();
    connectWebSocket();
  }, [fetchGraph, connectWebSocket]);

  // Hàm mô phỏng kích hoạt hiệu ứng AI Agent đang sửa database
  const triggerSimulation = () => {
    setActiveAgentNode('db');
    setTimeout(() => {
      setActiveAgentNode(null);
    }, 4000);
  };

  return (
    <div className={`w-screen h-screen flex flex-col transition-colors duration-300 ${theme === 'dark' ? 'bg-zinc-950 text-zinc-100 dark' : 'bg-slate-50 text-slate-900 light'}`}>
      {/* Top Header */}
      <header className={`h-16 flex items-center justify-between px-6 border-b z-10 transition-all ${
        theme === 'dark' 
          ? 'border-zinc-900 bg-zinc-950/80 text-zinc-100' 
          : 'border-slate-200 bg-white/80 text-slate-900 shadow-sm'
      } backdrop-blur-md`}>
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              LOOMISS
            </h1>
            <p className={`text-[10px] font-mono tracking-tight ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`}>Dynamic Architecture Visualizer</p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all ${
            theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-slate-100 border-slate-200'
          }`}>
            <span className={`h-2.5 w-2.5 rounded-full ${
              websocketStatus === 'connected'
                ? 'bg-green-500 animate-pulse'
                : websocketStatus === 'connecting'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-red-500'
            }`} />
            <span className={`text-xs font-mono font-bold capitalize ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
              {websocketStatus === 'connected' ? 'daemon connected' : websocketStatus}
            </span>
          </div>

          <button
            onClick={() => connectWebSocket()}
            className={`p-2 border rounded-lg transition-all ${
              theme === 'dark' 
                ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-zinc-200' 
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 shadow-sm'
            }`}
            title="Reconnect Daemon"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Board Container */}
      <div className="flex-1 relative flex">
        {/* React Flow Board */}
        <div className="flex-1 h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={(_event, node) => {
              if (node.type === 'architectureNode') {
                setSelectedNodeId(node.id);
              } else {
                setSelectedNodeId(null);
              }
            }}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
            minZoom={0.3}
            maxZoom={1.5}
            colorMode={theme}
          >
            <Background color={theme === 'dark' ? '#27272a' : '#cbd5e1'} gap={16} size={1} />
            <Controls position="bottom-right" />
          </ReactFlow>
        </div>

        {/* Control and Info Panel */}
        <aside className={`absolute top-4 left-4 w-80 p-5 flex flex-col space-y-4 z-10 select-none transition-all ${
          theme === 'dark'
            ? 'glass-panel border-zinc-800/80 bg-zinc-950/70 text-zinc-100'
            : 'bg-white/90 border border-slate-200/80 text-slate-800 shadow-lg rounded-2xl backdrop-blur-md'
        }`}>
          <div>
            <h2 className={`text-sm font-bold uppercase tracking-widest font-mono ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>Control Panel</h2>
            <div className={`h-px my-2 ${theme === 'dark' ? 'bg-gradient-to-r from-zinc-800 to-transparent' : 'bg-gradient-to-r from-slate-200 to-transparent'}`} />
          </div>

          {/* Sắp xếp hướng layout */}
          <div className="flex flex-col space-y-2">
            <label className={`text-xs font-mono ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>Auto Layout Direction</label>
            <div className={`grid grid-cols-2 gap-2 p-1 rounded-lg border transition-all ${
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800/80' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => setDirection('TB')}
                className={`py-1.5 text-xs font-mono font-bold rounded-md transition-all ${
                  direction === 'TB'
                    ? (theme === 'dark' ? 'bg-zinc-800 text-cyan-400 border border-zinc-700/50' : 'bg-white text-cyan-600 border border-slate-200 shadow-sm')
                    : (theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-500 hover:text-slate-700')
                }`}
              >
                Vertical (T-B)
              </button>
              <button
                onClick={() => setDirection('LR')}
                className={`py-1.5 text-xs font-mono font-bold rounded-md transition-all ${
                  direction === 'LR'
                    ? (theme === 'dark' ? 'bg-zinc-800 text-cyan-400 border border-zinc-700/50' : 'bg-white text-cyan-600 border border-slate-200 shadow-sm')
                    : (theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-500 hover:text-slate-700')
                }`}
              >
                Horizontal (L-R)
              </button>
            </div>
          </div>

          {/* Theme Selector */}
          <div className="flex flex-col space-y-2">
            <label className={`text-xs font-mono ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>Visual Theme</label>
            <div className={`grid grid-cols-2 gap-2 p-1 rounded-lg border transition-all ${
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800/80' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => setTheme('light')}
                className={`py-1.5 text-xs font-mono font-bold rounded-md flex items-center justify-center space-x-1.5 transition-all ${
                  theme === 'light'
                    ? 'bg-white text-cyan-600 border border-slate-200 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
                <span>Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`py-1.5 text-xs font-mono font-bold rounded-md flex items-center justify-center space-x-1.5 transition-all ${
                  theme === 'dark'
                    ? 'bg-zinc-800 text-cyan-400 border border-zinc-700/50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* Nút giả lập AI Agent tương tác */}
          <div className="flex flex-col space-y-2">
            <label className={`text-xs font-mono ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>Test Integrations</label>
            <button
              onClick={triggerSimulation}
              className={`w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-cyan-950/50 to-purple-950/50 hover:from-cyan-900/60 hover:to-purple-900/60 border border-cyan-800/40 hover:border-cyan-700/50 text-cyan-300 hover:text-cyan-200'
                  : 'bg-gradient-to-r from-cyan-50 to-purple-50 hover:from-cyan-100/80 hover:to-purple-100/80 border border-cyan-200 hover:border-cyan-300 text-cyan-700 hover:text-cyan-800'
              }`}
            >
              <Play className="h-3.5 w-3.5" />
              <span>Simulate AI Edit Node (DB)</span>
            </button>
          </div>

          {/* Banner Hiển thị Lỗi (LKG Mode indicator) */}
          {error && (
            <div className="bg-red-950/30 border border-red-800/50 p-3 rounded-lg flex items-start space-x-3 text-red-300 animate-pulse-slow">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 flex flex-col space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-red-500">
                  LKG Safe mode active
                </span>
                <p className="text-xs text-red-400/90 leading-snug">{error}</p>
              </div>
            </div>
          )}

          {/* Workspace File Changes Tracker */}
          {codeChanges.length > 0 && (
            <div className={`rounded-xl p-3 border space-y-2 transition-all ${
              theme === 'dark'
                ? 'bg-zinc-950/50 border-zinc-900/60'
                : 'bg-slate-50 border-slate-200/60'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className={`text-[10px] font-bold uppercase font-mono tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Active Changes
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold font-mono bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  {codeChanges.length} Files
                </span>
              </div>
              <div className="max-h-[80px] overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                {codeChanges.map((change, idx) => {
                  const filename = change.path.split('/').pop() || change.path;
                  return (
                    <div key={idx} className="flex items-center justify-between text-[9px] font-mono leading-tight">
                      <span className={`truncate flex-1 pr-2 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`} title={change.path}>
                        {filename}
                      </span>
                      <span className="flex items-center space-x-1 shrink-0">
                        {change.additions > 0 && <span className="text-green-500 font-bold">+{change.additions}</span>}
                        {change.deletions > 0 && <span className="text-red-500 font-bold">-{change.deletions}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Thông tin mô tả */}
          <div className={`rounded-lg p-3 space-y-2 border transition-all ${
            theme === 'dark'
              ? 'bg-zinc-950/80 border-zinc-800/50 text-zinc-500'
              : 'bg-slate-50 border-slate-200/80 text-slate-500'
          }`}>
            <div className="flex items-center space-x-1.5">
              <Radio className={`h-3.5 w-3.5 ${theme === 'dark' ? 'text-zinc-600' : 'text-slate-400'}`} />
              <span className={`text-[10px] font-bold uppercase font-mono tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
                Aesthetics Specs
              </span>
            </div>
            <ul className="text-[10px] list-disc pl-4 space-y-1 font-sans">
              <li>Slate/Zinc background grid base</li>
              <li>Pulsing edges denote traffic flow</li>
              <li>Neon Cyan: Gateway / Proxies</li>
              <li>Neon Purple: Apps & Web Services</li>
              <li>Neon Amber: Databases & Caches</li>
            </ul>
          </div>
        </aside>
        
        {/* Node detail sliding drawer */}
        <DetailDrawer />
      </div>
    </div>
  );
}
