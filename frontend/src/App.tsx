import { useEffect, useState } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from './store/useGraphStore';
import { Activity, Radio, AlertTriangle, Play, RefreshCw, Sun, Moon, Brain, Send, ShieldAlert, X, Plus, ArrowLeft } from 'lucide-react';
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
    geminiApiKey,
    setGeminiApiKey,
    setVulnerabilities,
    selectedNodeId,
    performanceMode,
    setPerformanceMode,
    historicMode,
    historicCommit,
    setHistoricMode,
    routingTrace,
    setRoutingTrace,
  } = useGraphStore();

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditHistory, setAuditHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditInput, setAuditInput] = useState('');

  const [commits, setCommits] = useState<{ hash: string; message: string }[]>([]);
  const [selectedCommitIndex, setSelectedCommitIndex] = useState(0);

  // Khởi động kết nối WebSocket và tải sơ đồ thực tế khi Component Mount
  useEffect(() => {
    fetchGraph();
    connectWebSocket();
  }, [fetchGraph, connectWebSocket]);

  // Tải lịch sử Git commits để Time Travel
  useEffect(() => {
    const fetchCommits = async () => {
      try {
        const response = await fetch('/api/git/commits');
        if (response.ok) {
          const data = await response.json();
          setCommits(data || []);
        }
      } catch (err) {
        console.warn('Failed to load commits history:', err);
      }
    };
    fetchCommits();
  }, []);

  const handleCommitChange = async (index: number) => {
    setSelectedCommitIndex(index);
    if (index === 0) {
      setHistoricMode(false, 'active');
      await fetchGraph('active');
    } else {
      const commit = commits[index - 1];
      setHistoricMode(true, commit.hash);
      await fetchGraph(commit.hash);
    }
  };

  // Hàm mô phỏng kích hoạt hiệu ứng AI Agent đang sửa database
  const triggerSimulation = () => {
    setActiveAgentNode('db');
    setTimeout(() => {
      setActiveAgentNode(null);
    }, 4000);
  };

  // Hàm mô phỏng gói tin chạy định tuyến Sandbox (Phase 6)
  const startRouteSimulation = () => {
    // Tìm các cạnh nginx -> app -> db
    const trace = ['nginx-app', 'app-db', 'nginx-ghost-8080'];
    setRoutingTrace(trace);

    // Active nhấp nháy từng node theo thứ tự gói tin đi qua
    setActiveAgentNode('nginx');
    setTimeout(() => {
      setActiveAgentNode('app');
    }, 1500);
    setTimeout(() => {
      setActiveAgentNode('db');
    }, 3000);

    // Kết thúc reset trạng thái
    setTimeout(() => {
      setActiveAgentNode(null);
      setRoutingTrace([]);
    }, 4500);
  };

  const buildArchitectureSummary = () => {
    const nodesSummary = nodes.map(n => ({
      id: n.id,
      label: n.data?.label || n.id,
      type: n.data?.type || 'unknown',
      parentId: n.parentId || 'none',
      image: (n.data as any)?.metadata?.image || 'unknown',
      ports: (n.data as any)?.metadata?.ports || 'none',
    }));

    const edgesSummary = edges.map(e => ({
      source: e.source,
      target: e.target,
      label: e.label || 'connects to',
    }));

    return JSON.stringify({ nodes: nodesSummary, connections: edgesSummary }, null, 2);
  };

  const runGlobalAudit = async (customPrompt?: string) => {
    if (!geminiApiKey) return;
    setIsAuditModalOpen(true);
    setAuditLoading(true);

    const question = customPrompt || "Perform a comprehensive security and design patterns audit on the current architecture.";
    const newUserMsg = { role: 'user' as const, text: question };
    const updatedHistory = [...auditHistory, newUserMsg];
    setAuditHistory(updatedHistory);
    setAuditInput('');

    try {
      const archSummary = buildArchitectureSummary();
      const systemInstructions = `You are the Loomiss AI Architect, a senior software architect, infrastructure developer, and cybersecurity auditor.
Analyze the system architecture representation (nodes and connection edges) provided.
Verify for security issues, such as:
1. Database exposed directly on host ports without a private network subnet.
2. Insecure routing, reverse proxies (e.g. Nginx proxy_pass), or lack of TLS configuration.
3. Over-privileged configurations or containers.
4. General architectural recommendations (redundancy, scaling, bottlenecks).

Return a highly professional, well-structured markdown audit report. Be thorough. Present findings clearly using lists, bold text, and subheaders. Use emojis (⚠️, ✅, 🛡️) to make it visually engaging and readable.`;

      const promptContext = `
Current Architecture Topology JSON:
\`\`\`json
${archSummary}
\`\`\`

User prompt / query:
"${question}"
`;

      const contents = [];
      if (updatedHistory.length === 1) {
        contents.push({
          role: 'user',
          parts: [{ text: `${systemInstructions}\n\nHere is the architecture data:\n${promptContext}` }]
        });
      } else {
        updatedHistory.forEach((msg, idx) => {
          let textVal = msg.text;
          if (idx === 0) {
            textVal = `${systemInstructions}\n\nHere is the architecture data:\n${promptContext}`;
          }
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: textVal }]
          });
        });
      }

      const jsonSchema = {
        type: "OBJECT",
        properties: {
          summary: { 
            type: "STRING", 
            description: "Detailed system architecture security and design audit report, styled nicely with markdown headers, lists, emojis, etc." 
          },
          vulnerable_nodes: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                node_id: { type: "STRING", description: "Node ID of the vulnerable component (e.g. 'db', 'nginx', 'app'). Must match exactly an active node ID." },
                severity: { type: "STRING", enum: ["HIGH", "MEDIUM", "LOW"] },
                reason: { type: "STRING", description: "Brief reason why this component has a vulnerability." }
              },
              required: ["node_id", "severity", "reason"]
            }
          }
        },
        required: ["summary", "vulnerable_nodes"]
      };

      const payload = {
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: jsonSchema
        }
      };

      const callGeminiAPI = async (apiKey: string): Promise<Response> => {
        const fetchWithRetry = async (model: string, retries = 3, delay = 1000): Promise<Response> => {
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              }
            );
            if ((res.status === 503 || res.status === 429) && retries > 0) {
              console.warn(`Gemini API returned status ${res.status} for model ${model}. Retrying in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
              return fetchWithRetry(model, retries - 1, delay * 2);
            }
            return res;
          } catch (err) {
            if (retries > 0) {
              console.warn(`Gemini API fetch error for model ${model}. Retrying in ${delay}ms...`, err);
              await new Promise(r => setTimeout(r, delay));
              return fetchWithRetry(model, retries - 1, delay * 2);
            }
            throw err;
          }
        };

        // Try stable and fast gemini-2.5-flash first
        let response = await fetchWithRetry('gemini-2.5-flash');
        
        // Fallback to gemini-3.5-flash if 503 or 429 occurs
        if (!response.ok && (response.status === 503 || response.status === 429)) {
          console.warn(`Gemini 2.5 Flash failed with ${response.status}. Falling back to gemini-3.5-flash...`);
          response = await fetchWithRetry('gemini-3.5-flash');
        }
        
        return response;
      };

      const response = await callGeminiAPI(geminiApiKey);

      if (!response.ok) {
        throw new Error(`API call failed with status ${response.status}`);
      }

      const data = await response.json();
      const modelJsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      let summaryText = modelJsonStr;
      try {
        const parsed = JSON.parse(modelJsonStr);
        summaryText = parsed.summary || 'No summary returned from Gemini.';
        if (parsed.vulnerable_nodes && Array.isArray(parsed.vulnerable_nodes)) {
          setVulnerabilities(parsed.vulnerable_nodes);
        } else {
          setVulnerabilities([]);
        }
      } catch (jsonErr) {
        console.warn('Gemini response is not a valid JSON structure:', jsonErr);
        summaryText = modelJsonStr;
      }

      setAuditHistory(prev => [...prev, { role: 'model', text: summaryText }]);
    } catch (err: any) {
      console.error('Global Audit failed:', err);
      setAuditHistory(prev => [
        ...prev,
        { role: 'model', text: `⚠️ **Audit Error**: Failed to query Gemini. ${err.message}` }
      ]);
    } finally {
      setAuditLoading(false);
    }
  };

  const formatMarkdown = (text: string) => {
    const lines = text.split('\n');
    const renderedElements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];

    lines.forEach((line, index) => {
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          renderedElements.push(
            <pre key={`code-${index}`} className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 font-mono text-[11px] text-zinc-300 overflow-x-auto my-2 select-text">
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          );
          codeBlockLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        return;
      }

      const processInline = (str: string): React.ReactNode[] => {
        const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
        return parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pIdx} className="font-bold text-zinc-100 dark:text-white">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={pIdx} className="px-1.5 py-0.5 rounded bg-zinc-900 font-mono text-[11px] border border-zinc-800 text-purple-300">{part.slice(1, -1)}</code>;
          }
          return part;
        });
      };

      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        renderedElements.push(
          <h1 key={index} className="text-lg font-bold text-white mt-5 mb-2.5 border-b border-zinc-800/60 pb-1.5">
            {processInline(trimmed.substring(2))}
          </h1>
        );
      } else if (trimmed.startsWith('## ')) {
        renderedElements.push(
          <h2 key={index} className="text-base font-bold text-zinc-200 mt-4 mb-2">
            {processInline(trimmed.substring(3))}
          </h2>
        );
      } else if (trimmed.startsWith('### ')) {
        renderedElements.push(
          <h3 key={index} className="text-sm font-semibold text-zinc-300 mt-3 mb-1.5">
            {processInline(trimmed.substring(4))}
          </h3>
        );
      } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const content = trimmed.substring(2);
        renderedElements.push(
          <li key={index} className="list-disc list-inside ml-3 my-1 leading-relaxed text-xs text-zinc-400">
            {processInline(content)}
          </li>
        );
      } else if (trimmed) {
        renderedElements.push(
          <p key={index} className="my-2 leading-relaxed text-xs text-zinc-350">
            {processInline(line)}
          </p>
        );
      }
    });

    return <div className="space-y-0.5">{renderedElements}</div>;
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
        <div className="flex-1 h-full relative">
          {historicMode && (
            <div 
              onClick={() => handleCommitChange(0)}
              className={`absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-xl border shadow-lg flex items-center space-x-2.5 z-10 cursor-pointer animate-pulse select-none transition-all text-xs font-mono ${
                theme === 'dark'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
                  : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 shadow-sm'
              }`}
            >
              <span>⚠️ Viewing History at commit <strong>{historicCommit}</strong>. Click to return.</span>
            </div>
          )}

          {routingTrace.length > 0 && (
            <div 
              className={`absolute ${historicMode ? 'top-16' : 'top-4'} left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-xl border shadow-lg flex items-center space-x-2.5 z-10 pointer-events-none select-none transition-all text-xs font-mono animate-pulse ${
                theme === 'dark'
                  ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-700 shadow-sm'
              }`}
            >
              <span>⚡ Sandbox Simulation Active: Packet tracing route...</span>
            </div>
          )}

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

          {/* Git Time Travel Slider */}
          {commits.length > 0 && (
            <div className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-2xl border shadow-2xl flex flex-col space-y-2 z-10 w-[450px] backdrop-blur-md transition-all select-none ${
              theme === 'dark'
                ? 'bg-zinc-950/90 border-zinc-800 text-zinc-100'
                : 'bg-white/90 border-slate-200 text-slate-800'
            }`}>
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-1.5">
                  <Activity className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
                  <span className="font-bold">Time Travel (Git Timeline)</span>
                </div>
                {selectedCommitIndex === 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500/10 border border-green-500/20 text-green-400">
                    🟢 Active Workspace
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/15 border border-purple-500/30 text-purple-400 font-mono">
                    📜 {commits[selectedCommitIndex - 1].hash}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-[10px] text-zinc-500 font-bold font-mono">Now</span>
                <input
                  type="range"
                  min="0"
                  max={commits.length}
                  value={selectedCommitIndex}
                  onChange={(e) => handleCommitChange(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <span className="text-[10px] text-zinc-500 font-bold font-mono">-{commits.length} commits</span>
              </div>

              <div className="text-[10px] truncate italic leading-tight text-center text-zinc-400 dark:text-zinc-500">
                {selectedCommitIndex === 0 
                  ? "Hiển thị cấu hình đang được chỉnh sửa trực tiếp" 
                  : `Commit: "${commits[selectedCommitIndex - 1].message}"`}
              </div>
            </div>
          )}
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

          {/* Performance Optimization Mode */}
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              <label className={`text-xs font-mono ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>Performance Mode</label>
              {nodes.length > 15 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold animate-pulse">
                  Auto-Lag-Free
                </span>
              )}
            </div>
            <div className={`grid grid-cols-2 gap-2 p-1 rounded-lg border transition-all ${
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800/80' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => setPerformanceMode(false)}
                className={`py-1.5 text-xs font-mono font-bold rounded-md flex items-center justify-center space-x-1.5 transition-all ${
                  !performanceMode
                    ? (theme === 'dark' ? 'bg-zinc-800 text-cyan-400 border border-zinc-700/50' : 'bg-white text-cyan-600 border border-slate-200 shadow-sm')
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span>Rich Visuals</span>
              </button>
              <button
                onClick={() => setPerformanceMode(true)}
                className={`py-1.5 text-xs font-mono font-bold rounded-md flex items-center justify-center space-x-1.5 transition-all ${
                  performanceMode
                    ? (theme === 'dark' ? 'bg-zinc-800 text-cyan-400 border border-zinc-700/50' : 'bg-white text-cyan-600 border border-slate-200 shadow-sm')
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>Lag-Free</span>
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
            <button
              onClick={startRouteSimulation}
              className={`w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-purple-950/50 to-cyan-950/50 hover:from-purple-900/60 hover:to-cyan-900/60 border border-purple-805/45 text-purple-300 hover:text-purple-200'
                  : 'bg-gradient-to-r from-purple-50 to-cyan-50 hover:from-purple-100/80 hover:to-purple-100/80 border border-purple-200 hover:border-purple-300 text-purple-700 hover:text-purple-800'
              }`}
            >
              <Activity className="h-3.5 w-3.5 animate-pulse" />
              <span>Simulate Route Trace</span>
            </button>
          </div>

          {/* AI Architect Copilot */}
          <div className="flex flex-col space-y-2">
            <label className={`text-xs font-mono ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>AI Architect Copilot</label>
            {!geminiApiKey ? (
              <div className={`p-2.5 rounded-lg border text-center space-y-2 ${
                theme === 'dark' ? 'bg-zinc-950/40 border-zinc-900' : 'bg-slate-50 border-slate-200'
              }`}>
                <p className={`text-[10px] leading-relaxed ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>
                  Enter Gemini API key to enable global security & design audits.
                </p>
                <div className="flex space-x-1.5">
                  <input
                    type="password"
                    placeholder="Gemini API Key..."
                    id="sidebar-gemini-key"
                    className={`flex-1 px-2.5 py-1 text-[10px] font-mono border rounded focus:outline-none focus:ring-1 focus:ring-purple-400 transition-all ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('sidebar-gemini-key') as HTMLInputElement;
                      if (input && input.value.trim()) {
                        setGeminiApiKey(input.value.trim());
                      }
                    }}
                    className="px-2.5 py-1 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 rounded transition-all cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setIsAuditModalOpen(true);
                    if (auditHistory.length === 0 && !auditLoading) {
                      runGlobalAudit();
                    }
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md ${
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-purple-900/40 to-cyan-900/40 hover:from-purple-800/50 hover:to-cyan-800/50 border border-purple-700/40 text-purple-200'
                      : 'bg-gradient-to-r from-purple-50 to-cyan-50 hover:from-purple-100/85 hover:to-cyan-100/85 border border-purple-300 text-purple-700 shadow-purple-500/5'
                  }`}
                >
                  <Brain className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
                  <span>Run AI Audit</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm("Clear Gemini API Key?")) {
                      setGeminiApiKey(null);
                    }
                  }}
                  className={`px-2 border rounded-lg transition-all ${
                    theme === 'dark' 
                      ? 'bg-zinc-900 border-zinc-800 text-red-400 hover:bg-red-950/20' 
                      : 'bg-white border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200'
                  }`}
                  title="Clear API Key"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
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
        {selectedNodeId && <DetailDrawer />}
      </div>

      {/* Global AI Audit Full Screen Workspace */}
      {isAuditModalOpen && (
        <div className={`fixed inset-0 z-50 flex transition-colors duration-300 select-none ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-slate-900 via-zinc-900 to-indigo-950 text-zinc-100'
            : 'bg-gradient-to-br from-slate-50 via-white to-purple-50 text-slate-900'
        }`}>
          {/* Left Navigation Sidebar (Amazon Q style) */}
          <aside className={`w-64 border-r flex flex-col justify-between p-4 shrink-0 transition-all select-none ${
            theme === 'dark'
              ? 'bg-slate-900/70 border-white/5 backdrop-blur-sm'
              : 'bg-white/80 border-slate-200 shadow-sm backdrop-blur-sm'
          }`}>
            <div className="flex flex-col space-y-4 min-h-0 flex-1">
              {/* Header Info */}
              <div className="flex items-center space-x-2.5 px-1 shrink-0">
                <ShieldAlert className="h-5 w-5 text-purple-400 animate-pulse" />
                <div>
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider">Loomiss Q</h3>
                  <p className={`text-[9px] font-mono ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`}>AI Architect Console</p>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  setAuditHistory([]);
                  setVulnerabilities([]); // clear old visual highlights
                  runGlobalAudit();
                }}
                className={`w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-[10px] font-bold border transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer shrink-0 ${
                  theme === 'dark'
                    ? 'bg-purple-950/20 border-purple-800/40 text-purple-300 hover:bg-purple-900/30'
                    : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                }`}
                title="Reset conversation and run a fresh audit"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Audit Chat</span>
              </button>

              <div className="h-px bg-zinc-200 dark:bg-zinc-855 shrink-0" />

              {/* Menu Options & Settings */}
              <div className="flex-1 overflow-y-auto space-y-5 pr-1 scrollbar-none">
                {/* Active Tab */}
                <div className="space-y-1">
                  <div className={`px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center space-x-2 select-none border transition-all ${
                    theme === 'dark'
                      ? 'bg-purple-950/20 border-purple-900/30 text-purple-300'
                      : 'bg-purple-50/50 border-purple-100 text-purple-700 shadow-sm'
                  }`}>
                    <Brain className="w-3.5 h-3.5" />
                    <span>🛡️ Global Security Audit</span>
                  </div>
                  <div className={`px-2.5 py-1 text-[9px] leading-normal font-sans ${
                    theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'
                  }`}>
                    💡 Pro tip: Close this console and click any component on the visualizer canvas to inspect localized logs and metrics.
                  </div>
                </div>

                <div className="h-px bg-zinc-200 dark:bg-zinc-855" />

                {/* Visual Settings Controls (moved to sidebar) */}
                <div className="space-y-4">
                  {/* Auto Layout Direction */}
                  <div className="flex flex-col space-y-1.5">
                    <label className={`text-[9px] font-bold uppercase font-mono tracking-wider ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>Auto Layout Direction</label>
                    <div className={`grid grid-cols-2 gap-1 p-0.5 rounded-lg border transition-all ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-900' : 'bg-slate-100 border-slate-200'
                    }`}>
                      <button
                        onClick={() => setDirection('TB')}
                        className={`py-1 text-[9px] font-mono font-bold rounded transition-all cursor-pointer ${
                          direction === 'TB'
                            ? (theme === 'dark' ? 'bg-zinc-800 text-cyan-400 border border-zinc-700/50' : 'bg-white text-cyan-600 border border-slate-200 shadow-sm')
                            : (theme === 'dark' ? 'text-zinc-600 hover:text-zinc-400' : 'text-slate-500 hover:text-slate-700')
                        }`}
                      >
                        Vertical
                      </button>
                      <button
                        onClick={() => setDirection('LR')}
                        className={`py-1 text-[9px] font-mono font-bold rounded transition-all cursor-pointer ${
                          direction === 'LR'
                            ? (theme === 'dark' ? 'bg-zinc-800 text-cyan-400 border border-zinc-700/50' : 'bg-white text-cyan-600 border border-slate-200 shadow-sm')
                            : (theme === 'dark' ? 'text-zinc-600 hover:text-zinc-400' : 'text-slate-500 hover:text-slate-700')
                        }`}
                      >
                        Horizontal
                      </button>
                    </div>
                  </div>

                  {/* Theme toggler */}
                  <div className="flex flex-col space-y-1.5">
                    <label className={`text-[9px] font-bold uppercase font-mono tracking-wider ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>Visual Theme</label>
                    <div className={`grid grid-cols-2 gap-1 p-0.5 rounded-lg border transition-all ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-900' : 'bg-slate-100 border-slate-200'
                    }`}>
                      <button
                        onClick={() => setTheme('light')}
                        className={`py-1 text-[9px] font-mono font-bold rounded flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                          theme === 'light'
                            ? 'bg-white text-cyan-600 border border-slate-200 shadow-sm'
                            : 'text-zinc-650 hover:text-zinc-400'
                        }`}
                      >
                        <Sun className="h-3 w-3" />
                        <span>Light</span>
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`py-1 text-[9px] font-mono font-bold rounded flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-zinc-800 text-cyan-400 border border-zinc-700/50'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Moon className="h-3 w-3" />
                        <span>Dark</span>
                      </button>
                    </div>
                  </div>

                  {/* Simulate Edit Button */}
                  <div className="flex flex-col space-y-1.5">
                    <label className={`text-[9px] font-bold uppercase font-mono tracking-wider ${theme === 'dark' ? 'text-zinc-550' : 'text-slate-500'}`}>Simulate Edit</label>
                    <button
                      onClick={triggerSimulation}
                      className={`w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-[9px] font-semibold border transition-all hover:scale-[1.01] cursor-pointer shadow-sm ${
                        theme === 'dark'
                          ? 'bg-zinc-950 border-zinc-900 text-cyan-300 hover:bg-zinc-800'
                          : 'bg-white border-slate-200 text-cyan-700 hover:bg-slate-50'
                      }`}
                    >
                      <Play className="h-3 w-3" />
                      <span>Simulate Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions & API Key controls */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-850 space-y-3 shrink-0">
              <div className="flex items-center justify-between text-[9px] font-mono">
                <span className={theme === 'dark' ? 'text-zinc-655' : 'text-slate-400'}>Gemini Q Active</span>
                <button
                  onClick={() => setGeminiApiKey(null)}
                  className="text-red-400 hover:underline cursor-pointer font-bold"
                >
                  Clear key
                </button>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className={`w-full flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-[10px] font-bold border transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750 hover:text-white'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Visualizer</span>
              </button>
            </div>
          </aside>

          {/* Right Main Audit Chat Workspace */}
          <main className="flex-1 flex flex-col min-h-0 bg-transparent">
            {/* Header Status Bar */}
            <div className={`flex items-center justify-between p-4 border-b shrink-0 ${
              theme === 'dark'
                ? 'bg-slate-900/60 border-white/5 text-zinc-100 backdrop-blur-sm'
                : 'bg-white/70 border-slate-200 text-slate-900 shadow-sm backdrop-blur-sm'
            }`}>
              <div className="flex items-center space-x-2.5">
                <ShieldAlert className="h-5 w-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold font-mono">Loomiss AI Security & Design Audit</h3>
                  <p className={`text-[10px] ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>Global Security & System Design Audit Report</p>
                </div>
              </div>
              {auditHistory.length > 0 && !auditLoading && (
                <button
                  onClick={() => {
                    setAuditHistory([]);
                    setVulnerabilities([]); // clear old visual highlights
                    runGlobalAudit();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center space-x-1 hover:scale-[1.02] cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-zinc-900 border-zinc-800 text-purple-300 hover:bg-zinc-800'
                      : 'bg-slate-100 border-slate-200 text-purple-600 hover:bg-slate-200'
                  }`}
                  title="Run a fresh new global audit"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Re-run Audit</span>
                </button>
              )}
            </div>

            {/* Modal Conversation / Report Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin select-text">
              {/* Context Status Indicator */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between text-[10px] font-mono select-none ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/10 text-zinc-400 backdrop-blur-sm'
                  : 'bg-white/70 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center space-x-1.5">
                  <Radio className="h-3 w-3 text-purple-400 animate-pulse" />
                  <span>Context:</span>
                </div>
                <div className="flex space-x-1.5 font-bold">
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">📦 Configs</span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400">📊 Telemetry</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">📝 Code</span>
                </div>
              </div>

              {auditHistory.length === 0 && !auditLoading && (
                <div className="space-y-5 py-6">
                  <div className="text-center space-y-2 select-none">
                    <Brain className="h-9 w-9 text-purple-400 mx-auto animate-pulse" />
                    <h4 className="text-sm font-bold font-mono">Global Architecture Diagnostic Engine</h4>
                    <p className={`text-[10px] max-w-[340px] mx-auto leading-relaxed ${theme === 'dark' ? 'text-zinc-555' : 'text-slate-500'}`}>
                      Select an architecture component diagnostic quick action below or ask a custom prompt in the input.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
                    {[
                      { text: '🛡️ Audit database port exposure', prompt: 'Perform a deep security audit specifically on the database and public port mappings. Suggest detailed mitigation steps.' },
                      { text: '🔒 Verify TLS reverse proxy config', prompt: 'Check reverse proxy TLS and gateway settings. How can we configure TLS for Nginx?' },
                      { text: '🐳 Check Docker Compose design', prompt: 'Analyze docker-compose.yml design. What container orchestration best practices can be applied?' },
                      { text: '📈 Inspect metrics telemetry anomalies', prompt: 'Review recent CPU/RAM telemetry metrics. Explain potential latency or utilization anomalies.' }
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => runGlobalAudit(chip.prompt)}
                        className={`text-left p-3.5 rounded-xl border text-[11px] font-medium leading-normal transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-purple-700 hover:border-purple-200'
                        }`}
                      >
                        {chip.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {auditHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col space-y-1.5 ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  } max-w-4xl mx-auto`}
                >
                  <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-555' : 'text-slate-400'}`}>
                    {msg.role === 'user' ? 'You' : 'AI Architect Advisor'}
                  </span>
                  <div
                    className={`p-5 rounded-2xl max-w-[90%] text-xs border leading-relaxed ${
                      msg.role === 'user'
                        ? (theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-800')
                        : (theme === 'dark' ? 'bg-purple-950/15 border-purple-900/25 text-zinc-200' : 'bg-purple-50/45 border-purple-100 text-slate-800')
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap select-text text-[11px] font-sans">{msg.text}</p>
                    ) : (
                      formatMarkdown(msg.text)
                    )}
                  </div>
                </div>
              ))}

              {auditLoading && (
                <div className="flex flex-col items-start space-y-1.5 max-w-4xl mx-auto">
                  <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-600' : 'text-slate-400'}`}>
                    AI Architect Advisor
                  </span>
                  <div className={`p-4 rounded-2xl border flex items-center space-x-2 ${
                    theme === 'dark' ? 'bg-purple-950/15 border-purple-900/25 text-zinc-100' : 'bg-purple-50/45 border-purple-100 text-slate-800'
                  }`}>
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              {/* Follow-up Quick Action Chips */}
              {auditHistory.length > 0 && !auditLoading && (
                <div className="pt-2 space-y-1.5 select-none max-w-4xl mx-auto">
                  <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-550' : 'text-slate-400'}`}>
                    Suggested follow-up questions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { text: '🛡️ Mitigate Exposed Ports', prompt: 'Provide a step-by-step mitigation plan to resolve the exposed database port 8888 and Nginx reverse proxy ports.' },
                      { text: '🔒 Configure Nginx TLS/SSL', prompt: 'Generate the exact SSL configuration snippet and certbot integration instructions for our Nginx reverse proxy.' },
                      { text: '🐳 Setup Docker Private Network', prompt: 'Show me the updated docker-compose.yml configuration with a private network driver mapping database and backend services privately.' }
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => runGlobalAudit(chip.prompt)}
                        className={`px-3 py-1.5 rounded-full border text-[10px] font-semibold transition-all hover:scale-[1.02] cursor-pointer shadow-sm ${
                          theme === 'dark'
                            ? 'bg-zinc-900 border-zinc-800 text-purple-300 hover:bg-zinc-800 hover:text-white'
                            : 'bg-purple-50/50 border-purple-100 text-purple-700 hover:bg-purple-100 hover:border-purple-300'
                        }`}
                      >
                        {chip.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Input Footer */}
            <div className={`p-4 border-t flex items-center justify-center shrink-0 select-none backdrop-blur-md ${
              theme === 'dark'
                ? 'border-white/10 bg-slate-900/50'
                : 'border-slate-200 bg-white/60'
            }`}>
              <div className="flex items-center space-x-2 w-full max-w-4xl">
                <input
                  type="text"
                  placeholder="Ask the AI Architect about design modifications, scaling, or vulnerabilities..."
                  value={auditInput}
                  onChange={(e) => setAuditInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && auditInput.trim() && !auditLoading) {
                      runGlobalAudit(auditInput.trim());
                    }
                  }}
                  className={`flex-1 px-4 py-2.5 text-xs font-sans border rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-400/60 transition-all placeholder:text-zinc-600 dark:placeholder:text-zinc-600 ${
                    theme === 'dark'
                      ? 'bg-white/8 border-white/10 text-zinc-100 backdrop-blur-sm'
                      : 'bg-white/80 border-slate-200 text-slate-900'
                  }`}
                />
                <button
                  onClick={() => {
                    if (auditInput.trim() && !auditLoading) {
                      runGlobalAudit(auditInput.trim());
                    }
                  }}
                  disabled={!auditInput.trim() || auditLoading}
                  className={`p-2.5 border rounded-xl transition-all ${
                    auditInput.trim() && !auditLoading
                      ? 'bg-purple-500 hover:bg-purple-600 border-purple-400 text-white cursor-pointer shadow-lg shadow-purple-500/20'
                      : (theme === 'dark' ? 'bg-white/5 border-white/10 text-zinc-600' : 'bg-slate-100 border-slate-200 text-slate-300')
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
