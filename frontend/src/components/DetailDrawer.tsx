import { useEffect, useState, useRef } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { X, Cpu, HardDrive, Terminal, Brain, Sparkles, Key, Send, Activity } from 'lucide-react';

export default function DetailDrawer() {
  const { selectedNodeId, nodes, metricsHistory, setSelectedNodeId, theme, codeChanges, geminiApiKey, setGeminiApiKey, vulnerabilities, setVulnerabilities } = useGraphStore();
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'telemetry' | 'ai'>('telemetry');
  const [aiHistory, setAiHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
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

  // Reset AI state when selectedNodeId changes
  useEffect(() => {
    setAiHistory([]);
    setAiInput('');
    setAiLoading(false);
  }, [selectedNodeId]);

  const runAiDiagnostics = async (customQuestion?: string) => {
    if (!geminiApiKey || !node) return;

    setAiLoading(true);
    const questionText = customQuestion || `Perform a diagnostic analysis on the container/node "${node.id}".`;
    const newUserMessage = { role: 'user' as const, text: questionText };
    const updatedHistory = [...aiHistory, newUserMessage];
    setAiHistory(updatedHistory);
    setAiInput('');

    try {
      const nodeInfo = {
        id: node.id,
        label: node.data?.label || node.id,
        type: node.data?.type || 'unknown',
        metadata: node.data?.metadata || {},
        metrics: {
          cpuHistory,
          ramHistory,
          currentCpu: currentCPU,
          currentRam: currentRAM,
        },
        recentLogs: logs.slice(-15),
      };

      const systemInstructions = `You are the Loomiss AI Architect, a senior software architect, infrastructure developer, and DevOps engineer. 
Analyze the component diagnostics details below for the container/node "${node.id}".
Provide a concise, practical analysis. Identify any issues (e.g., ports exposed incorrectly, missing environment variables, abnormal CPU/RAM levels, or warning/error signatures in logs). 
Keep formatting clean using bold (*bold*), inline code (\`code\`), and lists. Keep it short and readable in a small details drawer sidebar.`;

      const contextString = `
Context Information for Node "${node.id}":
- Label: ${nodeInfo.label}
- Type: ${nodeInfo.type}
- Image: ${nodeInfo.metadata.image || 'N/A'}
- Ports: ${nodeInfo.metadata.ports || 'N/A'}
- Live CPU: ${nodeInfo.metrics.currentCpu}% (history: [${nodeInfo.metrics.cpuHistory.join(', ')}])
- Live RAM: ${nodeInfo.metrics.currentRam}% (history: [${nodeInfo.metrics.ramHistory.join(', ')}])
- Recent Container Logs:
${nodeInfo.recentLogs.map(l => `  ${l}`).join('\n')}

User prompt / follow-up:
"${questionText}"
`;

      const contents = [];
      if (updatedHistory.length === 1) {
        contents.push({
          role: 'user',
          parts: [{ text: `${systemInstructions}\n\nHere is the component diagnostic details:\n${contextString}` }]
        });
      } else {
        updatedHistory.forEach((msg, idx) => {
          let textVal = msg.text;
          if (idx === 0) {
            textVal = `${systemInstructions}\n\nHere is the component diagnostic details:\n${contextString}`;
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
            description: "Concise diagnostic analysis and troubleshooting report in markdown style for the container." 
          },
          is_vulnerable: { 
            type: "BOOLEAN", 
            description: "True if this container has security, architecture, or container configuration/log errors." 
          },
          severity: { 
            type: "STRING", 
            enum: ["HIGH", "MEDIUM", "LOW"],
            description: "Severity of the issue (required if is_vulnerable is true)."
          },
          reason: { 
            type: "STRING", 
            description: "Short description of the diagnostic issue (required if is_vulnerable is true)." 
          }
        },
        required: ["summary", "is_vulnerable"]
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
        throw new Error(`API call failed: status ${response.status}`);
      }

      const resData = await response.json();
      const modelJsonStr = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      let summaryText = modelJsonStr;
      try {
        const parsed = JSON.parse(modelJsonStr);
        summaryText = parsed.summary || 'No summary returned from Gemini.';
        if (parsed.is_vulnerable) {
          const otherVulns = Array.isArray(vulnerabilities) ? vulnerabilities.filter(v => v.nodeId !== node.id) : [];
          const newVuln = {
            nodeId: node.id,
            severity: parsed.severity || 'MEDIUM',
            reason: parsed.reason || 'Component diagnostics warning.'
          };
          setVulnerabilities([...otherVulns, newVuln]);
        } else {
          setVulnerabilities(Array.isArray(vulnerabilities) ? vulnerabilities.filter(v => v.nodeId !== node.id) : []);
        }
      } catch (jsonErr) {
        console.warn('Gemini response is not a valid JSON structure:', jsonErr);
        summaryText = modelJsonStr;
      }
      
      setAiHistory(prev => [...prev, { role: 'model', text: summaryText }]);
    } catch (err: any) {
      console.error('Error running AI diagnostics:', err);
      setAiHistory(prev => [
        ...prev,
        { role: 'model', text: `⚠️ **Diagnostic Error**: Failed to fetch advice from Gemini. ${err.message}` }
      ]);
    } finally {
      setAiLoading(false);
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
            <pre key={`code-${index}`} className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 font-mono text-[10px] text-zinc-350 overflow-x-auto my-1.5 select-text">
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
            return <strong key={pIdx} className="font-bold text-zinc-150 dark:text-white">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={pIdx} className="px-1.5 py-0.5 rounded bg-zinc-900 font-mono text-[10px] border border-zinc-800 text-purple-300">{part.slice(1, -1)}</code>;
          }
          return part;
        });
      };

      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        renderedElements.push(
          <h1 key={index} className="text-sm font-bold text-white mt-4 mb-2 border-b border-zinc-800/60 pb-1">
            {processInline(trimmed.substring(2))}
          </h1>
        );
      } else if (trimmed.startsWith('## ')) {
        renderedElements.push(
          <h2 key={index} className="text-xs font-bold text-zinc-200 mt-3 mb-1.5">
            {processInline(trimmed.substring(3))}
          </h2>
        );
      } else if (trimmed.startsWith('### ')) {
        renderedElements.push(
          <h3 key={index} className="text-[11px] font-semibold text-zinc-300 mt-2 mb-1">
            {processInline(trimmed.substring(4))}
          </h3>
        );
      } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const content = trimmed.substring(2);
        renderedElements.push(
          <li key={index} className="list-disc list-inside ml-2.5 my-0.5 leading-relaxed text-[10px] text-zinc-400">
            {processInline(content)}
          </li>
        );
      } else if (trimmed) {
        renderedElements.push(
          <p key={index} className="my-1.5 leading-relaxed text-[10px] text-zinc-350">
            {processInline(line)}
          </p>
        );
      }
    });

    return <div className="space-y-0.5">{renderedElements}</div>;
  };

  // Get metrics history for this node
  const nodeHistory = metricsHistory?.[node.id] || { cpu: [], ram: [], network: [] };
  const cpuHistory = nodeHistory.cpu || [];
  const ramHistory = nodeHistory.ram || [];
  const currentCPU = cpuHistory.length > 0 ? cpuHistory[cpuHistory.length - 1] : 0;
  const currentRAM = ramHistory.length > 0 ? ramHistory[ramHistory.length - 1] : 0;

  return (
    <div
      className={`fixed top-20 right-4 w-[320px] h-[calc(100vh-100px)] border-2 rounded-2xl p-5 z-20 transition-all duration-300 transform select-none flex flex-col ${
        selectedNodeId ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
      } ${
        isDark
          ? 'bg-zinc-950/80 border-zinc-900 text-zinc-100 backdrop-blur-xl shadow-2xl shadow-cyan-950/10'
          : 'bg-white/90 border-slate-200 text-slate-900 shadow-xl shadow-slate-200 backdrop-blur-xl'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800/80 shrink-0">
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

      {/* Tab Switcher */}
      <div className={`flex border-b mt-3.5 text-[11px] font-mono select-none shrink-0 ${isDark ? 'border-zinc-900' : 'border-slate-200'}`}>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex-1 pb-2 flex items-center justify-center space-x-1.5 border-b-2 font-bold transition-all cursor-pointer ${
            activeTab === 'telemetry'
              ? 'border-cyan-400 text-cyan-400'
              : (isDark ? 'border-transparent text-zinc-500 hover:text-zinc-300' : 'border-transparent text-slate-400 hover:text-slate-600')
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Telemetry & Logs</span>
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 pb-2 flex items-center justify-center space-x-1.5 border-b-2 font-bold transition-all cursor-pointer ${
            activeTab === 'ai'
              ? 'border-purple-400 text-purple-400'
              : (isDark ? 'border-transparent text-zinc-500 hover:text-zinc-300' : 'border-transparent text-slate-400 hover:text-slate-600')
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>AI Diagnostics</span>
        </button>
      </div>

      {/* Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-4 scrollbar-thin select-none min-h-0 flex flex-col">
        {activeTab === 'telemetry' ? (
          <>
            {/* Node Metadata Details */}
            <div className="space-y-2 shrink-0">
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
              <div className="space-y-2 shrink-0">
                <div className="flex items-center space-x-1.5 text-xs font-mono font-bold">
                  <span className={isDark ? 'text-zinc-400' : 'text-slate-500'}>📝 Modified Files</span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold font-mono bg-green-500/10 border border-green-500/20 text-green-400 animate-pulse">
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
                          <div className={`text-[8px] truncate ${isDark ? 'text-zinc-650' : 'text-slate-400'}`} title={change.path}>
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

            {/* Sparklines Area */}
            <div className="space-y-4 shrink-0">
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
                  {cpuHistory.length > 1 ? (
                    drawSparkline(cpuHistory, '#06b6d4', 'cpu-gradient')
                  ) : (
                    <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-600' : 'text-slate-300'}`}>Awaiting telemetry stats...</span>
                  )}
                </div>
              </div>

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
                  {ramHistory.length > 1 ? (
                    drawSparkline(ramHistory, '#a855f7', 'ram-gradient')
                  ) : (
                    <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-600' : 'text-slate-300'}`}>Awaiting telemetry stats...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Terminal Log Stream */}
            <div className="flex-1 flex flex-col min-h-[140px] max-h-[180px]">
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
          </>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {!geminiApiKey ? (
              <div className="space-y-4 py-2 select-none">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto">
                    <Brain className="h-6 w-6 text-purple-400" />
                  </div>
                  <h4 className="text-xs font-bold font-mono">Gemini AI Diagnostics</h4>
                  <p className={`text-[10px] leading-relaxed ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                    Enter your Gemini API Key to enable real-time container log troubleshooting and design analysis. Keys are stored safely in local browser storage.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold font-mono uppercase tracking-wider flex items-center space-x-1.5">
                    <Key className="w-3 h-3 text-purple-400" />
                    <span>Gemini API Key</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      id="gemini-key-input"
                      className={`w-full px-3 py-2 text-xs font-mono border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 transition-all ${
                        isDark 
                          ? 'bg-zinc-950 border-zinc-900 text-zinc-100' 
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    const input = document.getElementById('gemini-key-input') as HTMLInputElement;
                    if (input && input.value.trim()) {
                      setGeminiApiKey(input.value.trim());
                    }
                  }}
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 transition-all shadow-md shadow-purple-500/10 cursor-pointer"
                >
                  Save API Key
                </button>
                <div className="text-center">
                  <a
                    href="https://aistudio.google.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9px] font-mono text-purple-400 hover:underline"
                  >
                    Get a Free Gemini Key at AI Studio ↗
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 select-none">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-3 scrollbar-thin select-text min-h-[220px]">
                  {aiHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-8 select-none">
                      <Sparkles className="h-8 w-8 text-purple-400 animate-pulse" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold font-mono">Component Diagnostic Engine</h4>
                        <p className={`text-[10px] max-w-[200px] leading-relaxed ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                          Click below to audit this component's ports, config, and console logs.
                        </p>
                      </div>
                      <button
                        onClick={() => runAiDiagnostics()}
                        className="py-1.5 px-4 rounded-full text-[10px] font-bold text-white bg-purple-500 hover:bg-purple-600 transition-all shadow-md shadow-purple-500/10 cursor-pointer"
                      >
                        Run AI Diagnostics
                      </button>
                    </div>
                  ) : (
                    aiHistory.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col space-y-1 ${
                          msg.role === 'user' ? 'items-end' : 'items-start'
                        }`}
                      >
                        <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>
                          {msg.role === 'user' ? 'You' : 'Gemini Architect'}
                        </span>
                        <div
                          className={`p-3 rounded-2xl max-w-[90%] text-xs border ${
                            msg.role === 'user'
                              ? (isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-800')
                              : (isDark ? 'bg-purple-950/20 border-purple-900/30 text-zinc-150' : 'bg-purple-50/50 border-purple-100 text-slate-850')
                          }`}
                        >
                          {msg.role === 'user' ? (
                            <p className="whitespace-pre-wrap select-text text-[10px] font-sans">{msg.text}</p>
                          ) : (
                            formatMarkdown(msg.text)
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {aiLoading && (
                    <div className="flex flex-col items-start space-y-1">
                      <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${isDark ? 'text-zinc-650' : 'text-slate-400'}`}>
                        Gemini Architect
                      </span>
                      <div className={`p-3 rounded-2xl border flex items-center space-x-2 ${
                        isDark ? 'bg-purple-950/20 border-purple-900/30 text-zinc-100' : 'bg-purple-50/50 border-purple-100 text-slate-850'
                      }`}>
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2 select-none shrink-0">
                  <div className="flex items-center justify-between text-[8px] font-mono">
                    <span className={isDark ? 'text-zinc-650' : 'text-slate-400'}>Gemini API Active</span>
                    <button
                      onClick={() => setGeminiApiKey(null)}
                      className="text-red-400 hover:underline cursor-pointer"
                    >
                      Clear API Key
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Ask the architect..."
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && aiInput.trim() && !aiLoading) {
                          runAiDiagnostics(aiInput.trim());
                        }
                      }}
                      className={`flex-1 px-3 py-1.5 text-[10px] font-sans border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 transition-all ${
                        isDark 
                          ? 'bg-zinc-950 border-zinc-900 text-zinc-100' 
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                    <button
                      onClick={() => {
                        if (aiInput.trim() && !aiLoading) {
                          runAiDiagnostics(aiInput.trim());
                        }
                      }}
                      disabled={!aiInput.trim() || aiLoading}
                      className={`p-1.5 border rounded-lg transition-all ${
                        aiInput.trim() && !aiLoading
                          ? 'bg-purple-500 hover:bg-purple-600 border-purple-400 text-white cursor-pointer'
                          : (isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-650' : 'bg-slate-100 border-slate-200 text-slate-300')
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
