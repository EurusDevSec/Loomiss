import { useEffect } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from './store/useGraphStore';
import { Activity, Radio, AlertTriangle, Play, RefreshCw } from 'lucide-react';

export default function App() {
  const {
    nodes,
    edges,
    direction,
    error,
    websocketStatus,
    setDirection,
    connectWebSocket,
    setActiveAgentNode,
    fetchGraph,
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
    <div className="w-screen h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Top Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md z-10">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              LOOMISS
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-tight">Dynamic Architecture Visualizer</p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-zinc-900/60 border border-zinc-800/80 px-3 py-1.5 rounded-full backdrop-blur-md">
            <span className={`h-2.5 w-2.5 rounded-full ${
              websocketStatus === 'connected'
                ? 'bg-green-500 animate-pulse'
                : websocketStatus === 'connecting'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-red-500'
            }`} />
            <span className="text-xs font-mono font-bold capitalize text-zinc-400">
              {websocketStatus === 'connected' ? 'daemon connected' : websocketStatus}
            </span>
          </div>

          <button
            onClick={() => connectWebSocket()}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-all"
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
            fitView
            minZoom={0.3}
            maxZoom={1.5}
            colorMode="dark"
          >
            <Background color="#27272a" gap={16} size={1} />
            <Controls position="bottom-right" />
          </ReactFlow>
        </div>

        {/* Control and Info Panel */}
        <aside className="absolute top-4 left-4 w-80 glass-panel p-5 flex flex-col space-y-4 z-10 select-none">
          <div>
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest font-mono">Control Panel</h2>
            <div className="h-px bg-gradient-to-r from-zinc-800 to-transparent my-2" />
          </div>

          {/* Sắp xếp hướng layout */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs text-zinc-500 font-mono">Auto Layout Direction</label>
            <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800/80">
              <button
                onClick={() => setDirection('TB')}
                className={`py-1.5 text-xs font-mono font-bold rounded-md transition-all ${
                  direction === 'TB'
                    ? 'bg-zinc-800 text-cyan-400 shadow-sm border border-zinc-700/50'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Vertical (T-B)
              </button>
              <button
                onClick={() => setDirection('LR')}
                className={`py-1.5 text-xs font-mono font-bold rounded-md transition-all ${
                  direction === 'LR'
                    ? 'bg-zinc-800 text-cyan-400 shadow-sm border border-zinc-700/50'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Horizontal (L-R)
              </button>
            </div>
          </div>

          {/* Nút giả lập AI Agent tương tác */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs text-zinc-500 font-mono">Test Integrations</label>
            <button
              onClick={triggerSimulation}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-gradient-to-r from-cyan-950/50 to-purple-950/50 hover:from-cyan-900/60 hover:to-purple-900/60 border border-cyan-800/40 hover:border-cyan-700/50 rounded-lg text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-all cursor-pointer shadow-md"
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

          {/* Thông tin mô tả */}
          <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-lg p-3 text-zinc-500 space-y-2">
            <div className="flex items-center space-x-1.5">
              <Radio className="h-3.5 w-3.5 text-zinc-600" />
              <span className="text-[10px] font-bold uppercase font-mono tracking-wider text-zinc-400">
                Aesthetics Specs
              </span>
            </div>
            <ul className="text-[10px] list-disc pl-4 space-y-1 font-sans">
              <li>Slate/Zinc dark canvas base</li>
              <li>Pulsing edges denote traffic flow</li>
              <li>Neon Cyan: Gateway / Proxies</li>
              <li>Neon Purple: Apps & Web Services</li>
              <li>Neon Amber: Databases & Caches</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
