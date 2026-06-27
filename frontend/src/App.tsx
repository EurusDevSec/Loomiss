import { useEffect, useState } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from './store/useGraphStore';
import { Activity, Radio, AlertTriangle, Play, RefreshCw, Sun, Moon, Brain, Send, ShieldAlert, X } from 'lucide-react';
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
  } = useGraphStore();

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditHistory, setAuditHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditInput, setAuditInput] = useState('');

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

        // Try gemini-3.5-flash first
        let response = await fetchWithRetry('gemini-3.5-flash');
        
        // Fallback to gemini-2.5-flash if 503 or 429 occurs
        if (!response.ok && (response.status === 503 || response.status === 429)) {
          console.warn(`Gemini 3.5 Flash failed with ${response.status}. Falling back to stable gemini-2.5-flash...`);
          response = await fetchWithRetry('gemini-2.5-flash');
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
        if (parsed.vulnerable_nodes) {
          setVulnerabilities(parsed.vulnerable_nodes);
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
        <DetailDrawer />
      </div>

      {/* Global AI Audit Overlay Modal */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
          <div className={`w-full max-w-2xl h-[80vh] border rounded-2xl flex flex-col overflow-hidden shadow-2xl transition-all ${
            theme === 'dark'
              ? 'bg-zinc-950/95 border-zinc-900 text-zinc-100'
              : 'bg-white/95 border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800/80 shrink-0">
              <div className="flex items-center space-x-2.5">
                <ShieldAlert className="h-5 w-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold font-mono">Loomiss AI Architect Audit</h3>
                  <p className={`text-[10px] ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>Global Security & System Design Audit Report</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
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
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className={`p-1.5 border rounded-lg transition-all ${
                    theme === 'dark'
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Conversation / Report Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin select-text">
              {auditHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col space-y-1.5 ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-550' : 'text-slate-400'}`}>
                    {msg.role === 'user' ? 'You' : 'AI Architect Advisor'}
                  </span>
                  <div
                    className={`p-4 rounded-2xl max-w-[90%] text-xs border leading-relaxed ${
                      msg.role === 'user'
                        ? (theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-800')
                        : (theme === 'dark' ? 'bg-purple-950/15 border-purple-900/25 text-zinc-150' : 'bg-purple-50/40 border-purple-100 text-slate-850')
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
                <div className="flex flex-col items-start space-y-1.5">
                  <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-600' : 'text-slate-400'}`}>
                    AI Architect Advisor
                  </span>
                  <div className={`p-4 rounded-2xl border flex items-center space-x-2 ${
                    theme === 'dark' ? 'bg-purple-950/15 border-purple-900/25 text-zinc-100' : 'bg-purple-50/40 border-purple-100 text-slate-850'
                  }`}>
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Input Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center space-x-2 shrink-0 select-none">
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
                className={`flex-1 px-3 py-2 text-xs font-sans border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 transition-all ${
                  theme === 'dark'
                    ? 'bg-zinc-950 border-zinc-900 text-zinc-100'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
              <button
                onClick={() => {
                  if (auditInput.trim() && !auditLoading) {
                    runGlobalAudit(auditInput.trim());
                  }
                }}
                disabled={!auditInput.trim() || auditLoading}
                className={`p-2 border rounded-lg transition-all ${
                  auditInput.trim() && !auditLoading
                    ? 'bg-purple-500 hover:bg-purple-600 border-purple-400 text-white cursor-pointer shadow-sm shadow-purple-500/10'
                    : (theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-600' : 'bg-slate-100 border-slate-200 text-slate-300')
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
