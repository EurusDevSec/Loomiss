import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import { getLayoutedElements } from '../utils/layout';

interface GraphState {
  nodes: Node[];
  edges: Edge[];
  direction: 'TB' | 'LR';
  error: string | null;
  activeAgentNode: string | null;
  websocketStatus: 'connecting' | 'connected' | 'disconnected';
  
  theme: 'light' | 'dark';
  
  // Actions
  setElements: (nodes: Node[], edges: Edge[]) => void;
  setDirection: (dir: 'TB' | 'LR') => void;
  setError: (err: string | null) => void;
  setActiveAgentNode: (nodeId: string | null) => void;
  connectWebSocket: (url?: string) => void;
  fetchGraph: () => Promise<void>;
  setTheme: (theme: 'light' | 'dark') => void;
}

// Hỗ trợ map ID, nhãn (label) và hình ảnh sang slug logo tương ứng của Simple Icons
const getLogoSlug = (nodeId: string, type: string, label: string, image?: string, metadata?: any): string | null => {
  // 1. Gather all raw strings to analyze
  const rawStrings = [
    label,
    nodeId,
    type,
    image || '',
    metadata?.image || '',
    metadata?.provider || '',
    metadata?.resource_type || ''
  ].filter(Boolean).map(s => s.toLowerCase());

  // 2. Clean helper: removes emojis, parentheses content, and version tags
  const cleanTerm = (term: string): string => {
    let s = term.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{2600}-\u{26FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{2B50}]/gu, '');
    s = s.replace(/🐳|🐘|🐬|💾|📡|❤️|⚛️|🐹|🎼|🔴|☸️|🛡️|⚡|💚|🧡|🅰️|🍃|🧪|💎|🦭|👁️|🔍|🐇|🫘|🦆|🚦|🦍|⚖️|☁️|🌐|🛡️|🧓|🐙|🔥|📊/g, '');
    s = s.replace(/\([^)]*\)/g, '');
    s = s.replace(/[:@][\d.]+/g, '');
    if (s.includes('/')) {
      const parts = s.split('/');
      s = parts[parts.length - 1];
    }
    return s.trim();
  };

  const cleanedTerms = rawStrings.map(cleanTerm).filter(Boolean);

  // 3. Official Brand Mapping (Synonyms that don't match simple slugification)
  const techMap: Record<string, string> = {
    'next.js': 'nextdotjs',
    'nextjs': 'nextdotjs',
    'react': 'react',
    'vue': 'vuedotjs',
    'vue.js': 'vuedotjs',
    'angular': 'angular',
    'svelte': 'svelte',
    'golang': 'go',
    'go': 'go',
    'php': 'php',
    'laravel': 'laravel',
    'symfony': 'symfony',
    'node': 'nodedotjs',
    'node.js': 'nodedotjs',
    'nodejs': 'nodedotjs',
    'express': 'express',
    'nestjs': 'nestjs',
    'nest': 'nestjs',
    'soketi': 'socketdotio',
    'socket.io': 'socketdotio',
    'socketio': 'socketdotio',
    'nginx': 'nginx',
    'caddy': 'caddy',
    'traefik': 'traefik',
    'postgres': 'postgresql',
    'postgresql': 'postgresql',
    'pgsql': 'postgresql',
    'mysql': 'mysql',
    'sqlite': 'sqlite',
    'redis': 'redis',
    'cassandra': 'cassandra',
    'mongodb': 'mongodb',
    'mongo': 'mongodb',
    'mariadb': 'mariadb',
    'rabbitmq': 'rabbitmq',
    'kafka': 'apachekafka',
    'elasticsearch': 'elasticsearch',
    'elastic': 'elasticsearch',
    'prometheus': 'prometheus',
    'grafana': 'grafana',
    'jenkins': 'jenkins',
    'githubactions': 'githubactions',
    'github-actions': 'githubactions',
    'docker': 'docker',
    'kubernetes': 'kubernetes',
    'k8s': 'kubernetes',
    'terraform': 'terraform',
    'route53': 'amazonroute53',
    'route-53': 'amazonroute53',
    'route 53': 'amazonroute53',
    'dns': 'amazonroute53',
    'alb': 'amazonelasticloadbalancing',
    'elb': 'amazonelasticloadbalancing',
    'waf': 'amazonwaf',
    'aws-waf': 'amazonwaf',
    'aws': 'amazonwebservices',
    'gcp': 'googlecloud',
    'google-cloud': 'googlecloud',
    'azure': 'microsoftazure',
    'cloudflare': 'cloudflare',
    'digitalocean': 'digitalocean',
    'github': 'github'
  };

  // 4. Try matching with synonyms first
  for (const term of cleanedTerms) {
    if (techMap[term]) {
      return techMap[term];
    }
    for (const [key, slug] of Object.entries(techMap)) {
      if (term.includes(key)) {
        return slug;
      }
    }
  }

  // 5. General fallback: dynamic slugification for anything else
  for (const term of cleanedTerms) {
    let slug = term.toLowerCase();
    if (slug.endsWith('.js')) {
      slug = slug.substring(0, slug.length - 3) + 'dotjs';
    }
    slug = slug.replace(/[^a-z0-9]/g, '');
    if (slug && slug.length > 1) {
      return slug;
    }
  }

  return null;
};;

// Hàm chuẩn hóa dữ liệu đồ thị thô từ Backend thành các styled Nodes/Edges của React Flow
const formatGraphData = (rawNodes: any[], rawEdges: any[]): { nodes: Node[]; edges: Edge[] } => {
  const formattedNodes: Node[] = rawNodes.map((node) => {
    if (node.type === 'group') {
      const idLower = node.id.toLowerCase();
      let borderClr = '#27272a';
      let bgClr = 'rgba(39, 39, 42, 0.03)';
      
      if (idLower.includes('docker')) {
        borderClr = '#06b6d4';
        bgClr = 'rgba(6, 182, 212, 0.03)';
      } else if (idLower.includes('terraform')) {
        borderClr = '#3b82f6';
        bgClr = 'rgba(59, 130, 246, 0.03)';
      } else if (idLower.includes('gateway')) {
        borderClr = '#14b8a6'; // teal
        bgClr = 'rgba(20, 184, 166, 0.03)';
      } else if (idLower.includes('app') || idLower.includes('workspace')) {
        borderClr = '#a855f7';
        bgClr = 'rgba(168, 85, 247, 0.03)';
      } else if (idLower.includes('devops') || idLower.includes('monitoring')) {
        borderClr = '#10b981'; // emerald
        bgClr = 'rgba(16, 185, 129, 0.03)';
      }

      return {
        id: node.id,
        type: 'group',
        data: {
          label: node.label || node.id,
          borderClr,
          bgClr,
        },
        position: { x: 0, y: 0 },
      };
    }

    const isNginx = node.id === 'nginx' || node.type === 'gateway' || node.id.includes('nginx') || node.id.includes('gateway');
    const isApp = node.type === 'app';
    const borderClr = isNginx ? '#06b6d4' : isApp ? '#a855f7' : '#f59e0b';
    const shadowClr = isNginx ? 'rgba(6, 182, 212, 0.3)' : isApp ? 'rgba(168, 85, 247, 0.3)' : 'rgba(245, 158, 11, 0.3)';
    
    // Làm sạch label khỏi các emoji và ký tự biểu cảm lộn xộn để có giao diện phẳng chuyên nghiệp
    let cleanLabel = node.label || node.id;
    // Bỏ tất cả emoji phổ biến và cụ thể
    cleanLabel = cleanLabel.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{2600}-\u{26FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{2B50}]/gu, '').trim();
    cleanLabel = cleanLabel.replace(/🐘|🐬|💾|📡|⚡|❤️|🐳|🌐|⚙️|🗄️|☁️|🐙|🧓|🔥|📊/g, '').trim();

    const logoSlug = getLogoSlug(node.id, node.type, cleanLabel, node.metadata?.image, node.metadata);
    const logoUrl = logoSlug ? `https://cdn.simpleicons.org/${logoSlug}` : null;

    return {
      id: node.id,
      type: 'architectureNode',
      parentId: node.parentId,
      data: {
        label: cleanLabel,
        type: node.type,
        status: node.status,
        metadata: node.metadata,
        borderClr,
        shadowClr,
        logoUrl,
        activeAgentNode: false,
      },
      position: { x: 0, y: 0 },
    };
  });

  const formattedEdges: Edge[] = rawEdges.map((edge) => {
    const isNginx = edge.source === 'nginx' || edge.source.includes('nginx') || edge.source.includes('gateway');
    const strokeClr = isNginx ? '#06b6d4' : '#a855f7';
    
    return {
      id: edge.id || `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label || '',
      type: 'traffic',
      animated: true,
      style: { stroke: strokeClr, strokeWidth: 2 },
      labelStyle: { fill: '#a1a1aa', fontSize: 10, fontWeight: 'bold' },
      labelBgStyle: { fill: '#18181b', fillOpacity: 0.8 },
      data: { network: 0 }
    };
  });

  return { nodes: formattedNodes, edges: formattedEdges };
};

// Dữ liệu mock ban đầu cho DoD của Phase 1 (được định dạng tương ứng dữ liệu thô)
const mockRawNodes = [
  {
    id: 'nginx',
    label: 'Nginx Gateway',
    type: 'gateway',
    status: 'active',
    metadata: { ports: '80:80', image: 'nginx:alpine' },
  },
  {
    id: 'app',
    label: 'Sneakers App',
    type: 'app',
    status: 'active',
    metadata: { ports: '8080:8080', image: 'golang:1.22' },
  },
  {
    id: 'db',
    label: 'Postgres DB',
    type: 'database',
    status: 'active',
    metadata: { ports: '5432:5432', image: 'postgres:15' },
  },
];

const mockEdges: Edge[] = [
  {
    id: 'nginx-app',
    source: 'nginx',
    target: 'app',
    label: 'Proxy Pass (80 -> 8080)',
    animated: true,
    style: { stroke: '#06b6d4', strokeWidth: 2 },
    labelStyle: { fill: '#a1a1aa', fontSize: 10, fontWeight: 'bold' },
    labelBgStyle: { fill: '#18181b', fillOpacity: 0.8 },
  },
  {
    id: 'app-db',
    source: 'app',
    target: 'db',
    label: 'SQL Connect (5432)',
    animated: true,
    style: { stroke: '#a855f7', strokeWidth: 2 },
    labelStyle: { fill: '#a1a1aa', fontSize: 10, fontWeight: 'bold' },
    labelBgStyle: { fill: '#18181b', fillOpacity: 0.8 },
  },
];

// Áp dụng layout tự động cho dữ liệu mock
const formattedMock = formatGraphData(mockRawNodes, mockEdges);
const initialLayout = getLayoutedElements(formattedMock.nodes, formattedMock.edges, 'TB');

export const useGraphStore = create<GraphState>((set, get) => {
  let ws: WebSocket | null = null;
  let diffTimeout: any = null;
  
  return {
    nodes: initialLayout.nodes,
    edges: initialLayout.edges,
    direction: 'TB',
    error: null,
    activeAgentNode: null,
    theme: 'light',
    websocketStatus: 'disconnected',
    setTheme: (theme) => set({ theme }),

    setElements: (nodes, edges) => {
      const { direction, nodes: currentNodes, edges: currentEdges } = get();
      
      // Chỉ tính toán Diff nếu có đồ thị cũ thực tế (không phải lúc khởi chạy hoặc mock)
      const isInitialOrMock = currentNodes.length <= 4 && currentNodes.some(n => n.id === 'nginx' && n.parentId === undefined);
      
      if (isInitialOrMock || currentNodes.length === 0) {
        const layouted = getLayoutedElements(nodes, edges, direction);
        set({ nodes: layouted.nodes, edges: layouted.edges });
        return;
      }

      // 1. Phân tách các phần tử bị Xóa hoặc Thêm mới
      const deletedNodes = currentNodes.filter(cn => cn.type !== 'group' && !nodes.some(n => n.id === cn.id));
      const addedNodes = nodes.filter(n => n.type !== 'group' && !currentNodes.some(cn => cn.id === n.id));
      
      const deletedEdges = currentEdges.filter(ce => !edges.some(e => e.id === ce.id));
      const addedEdges = edges.filter(e => !currentEdges.some(ce => ce.id === e.id));

      // Nếu không có thay đổi nào về số lượng hay cấu trúc liên kết, chạy thường
      if (deletedNodes.length === 0 && addedNodes.length === 0 && deletedEdges.length === 0 && addedEdges.length === 0) {
        const layouted = getLayoutedElements(nodes, edges, direction);
        set({ nodes: layouted.nodes, edges: layouted.edges });
        return;
      }

      // Hủy Timeout dọn dẹp trước đó nếu có để tránh đè hoạt ảnh
      if (diffTimeout) {
        clearTimeout(diffTimeout);
        diffTimeout = null;
      }

      // 2. Gom nhóm toàn bộ phần tử để Dagre tính toán layout đồng bộ
      const combinedNodesForLayout = [...nodes];
      deletedNodes.forEach(dn => {
        if (!combinedNodesForLayout.some(n => n.id === dn.id)) {
          combinedNodesForLayout.push(dn);
        }
      });

      const combinedEdgesForLayout = [...edges];
      deletedEdges.forEach(de => {
        if (!combinedEdgesForLayout.some(e => e.id === de.id)) {
          combinedEdgesForLayout.push(de);
        }
      });

      const layouted = getLayoutedElements(combinedNodesForLayout, combinedEdgesForLayout, direction);

      // 3. Đánh dấu class chuyển tiếp và thuộc tính style cho từng loại node/edge
      const animatedNodes = layouted.nodes.map(n => {
        const isAdded = addedNodes.some(added => added.id === n.id);
        const isDeleted = deletedNodes.some(deleted => deleted.id === n.id);

        if (isAdded) {
          return {
            ...n,
            className: 'animate-diff-add',
            data: { ...n.data, isDiffAdd: true }
          };
        }
        if (isDeleted) {
          return {
            ...n,
            className: 'animate-diff-delete',
            data: { ...n.data, isDiffDelete: true }
          };
        }
        return n;
      });

      const animatedEdges = layouted.edges.map(e => {
        const isAdded = addedEdges.some(added => added.id === e.id);
        const isDeleted = deletedEdges.some(deleted => deleted.id === e.id);

        if (isAdded) {
          return { ...e, className: 'diff-edge-add' };
        }
        if (isDeleted) {
          return { ...e, className: 'diff-edge-delete' };
        }
        return e;
      });

      // Render đồ thị chuyển tiếp
      set({ nodes: animatedNodes, edges: animatedEdges });

      // 4. Thiết lập Timeout 3 giây dọn dẹp và khôi phục đồ thị mới nguyên bản
      diffTimeout = setTimeout(() => {
        const cleanLayouted = getLayoutedElements(nodes, edges, direction);
        set({ nodes: cleanLayouted.nodes, edges: cleanLayouted.edges });
        diffTimeout = null;
      }, 3000);
    },

    setDirection: (direction) => {
      const { nodes, edges } = get();
      const layouted = getLayoutedElements(nodes, edges, direction);
      set({ direction, nodes: layouted.nodes, edges: layouted.edges });
    },

    setError: (error) => set({ error }),
    
    setActiveAgentNode: (nodeId) => {
      // Cập nhật hiệu ứng ripple cho node đang có AI Agent tương tác
      const { nodes } = get();
      const updatedNodes = nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            className: 'animate-ripple',
            style: {
              ...node.style,
              borderColor: '#22c55e',
              boxShadow: '0 0 25px rgba(34, 197, 150, 0.6)',
            }
          };
        } else {
          // Khôi phục viền gốc dựa trên loại node
          const isNginx = node.id === 'nginx' || node.id.includes('nginx');
          const isApp = node.id === 'app' || node.id.includes('app') || node.id.includes('service') || node.id.includes('aws_instance') || node.id.includes('web');
          const borderClr = isNginx ? '#06b6d4' : isApp ? '#a855f7' : '#f59e0b';
          const shadowClr = isNginx ? 'rgba(6, 182, 212, 0.3)' : isApp ? 'rgba(168, 85, 247, 0.3)' : 'rgba(245, 158, 11, 0.3)';
          
          return {
            ...node,
            className: '',
            style: {
              ...node.style,
              borderColor: borderClr,
              boxShadow: `0 0 15px ${shadowClr}`,
            }
          };
        }
      });
      set({ activeAgentNode: nodeId, nodes: updatedNodes });
    },

    fetchGraph: async () => {
      try {
        const response = await fetch('/api/graph');
        if (!response.ok) throw new Error('Không thể tải dữ liệu từ daemon server');
        const data = await response.json();
        
        if (data.nodes && data.nodes.length > 0) {
          const { nodes, edges } = formatGraphData(data.nodes, data.edges || []);
          get().setElements(nodes, edges);
        }
      } catch (err) {
        console.warn('[Loomiss] Không có kết nối tới API Daemon, sử dụng Mock Graph fallback:', err);
      }
    },

    connectWebSocket: (url) => {
      const wsUrl = url || `ws://${window.location.host}/ws`;
      set({ websocketStatus: 'connecting' });

      if (ws) {
        ws.close();
      }

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          set({ websocketStatus: 'connected' });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Xử lý các loại tin nhắn từ Go daemon
            switch (data.type) {
              case 'UPDATE_GRAPH':
                set({ error: null });
                if (data.nodes) {
                  const { nodes, edges } = formatGraphData(data.nodes, data.edges || []);
                  get().setElements(nodes, edges);
                }
                break;
              case 'PARSE_ERROR':
                set({ error: data.message });
                // Vẫn giữ lại Graph cũ (LKG - Last Known Good)
                break;
              case 'AGENT_ACTIVITY':
                // Báo hiệu AI đang chỉnh sửa node
                get().setActiveAgentNode(data.nodeId);
                setTimeout(() => {
                  get().setActiveAgentNode(null);
                }, 4000); // Tắt hiệu ứng sau 4s
                break;
              case 'METRICS_UPDATE': {
                const metrics = data.metrics as Record<string, { cpu: number; ram: number; network: number }>;
                set((state) => {
                  const updatedNodes = state.nodes.map(node => {
                    if (metrics[node.id]) {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          cpu: metrics[node.id].cpu,
                          ram: metrics[node.id].ram,
                        }
                      };
                    }
                    return node;
                  });

                  const updatedEdges = state.edges.map(edge => {
                    const sourceMetrics = metrics[edge.source];
                    const targetMetrics = metrics[edge.target];
                    const networkVal = sourceMetrics?.network || targetMetrics?.network || 0;
                    return {
                      ...edge,
                      data: {
                        ...edge.data,
                        network: networkVal
                      }
                    };
                  });

                  return { nodes: updatedNodes, edges: updatedEdges };
                });
                break;
              }
            }
          } catch (e) {
            console.error('Lỗi phân tích WebSocket payload:', e);
          }
        };

        ws.onclose = () => {
          set({ websocketStatus: 'disconnected' });
          // Thử kết nối lại sau 3s
          setTimeout(() => get().connectWebSocket(wsUrl), 3000);
        };

        ws.onerror = () => {
          set({ websocketStatus: 'disconnected' });
        };
      } catch (err) {
        console.error('Không thể tạo kết nối WebSocket:', err);
        set({ websocketStatus: 'disconnected' });
      }
    },
  };
});
