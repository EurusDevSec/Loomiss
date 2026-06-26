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
  
  // Actions
  setElements: (nodes: Node[], edges: Edge[]) => void;
  setDirection: (dir: 'TB' | 'LR') => void;
  setError: (err: string | null) => void;
  setActiveAgentNode: (nodeId: string | null) => void;
  connectWebSocket: (url?: string) => void;
}

// Dữ liệu mock ban đầu cho DoD của Phase 1
const mockNodes: Node[] = [
  {
    id: 'nginx',
    type: 'default',
    data: { label: '🌐 Nginx Gateway (Port 80)' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(9, 9, 11, 0.8)',
      color: '#e4e4e7',
      border: '2px solid #06b6d4',
      borderRadius: '8px',
      padding: '10px',
      boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)',
      fontWeight: 'bold',
      width: 220,
    },
  },
  {
    id: 'app',
    type: 'default',
    data: { label: '⚙️ Sneakers App (Port 8080)' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(9, 9, 11, 0.8)',
      color: '#e4e4e7',
      border: '2px solid #a855f7',
      borderRadius: '8px',
      padding: '10px',
      boxShadow: '0 0 15px rgba(168, 85, 247, 0.3)',
      fontWeight: 'bold',
      width: 220,
    },
  },
  {
    id: 'db',
    type: 'default',
    data: { label: '🗄️ Postgres DB (Port 5432)' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(9, 9, 11, 0.8)',
      color: '#e4e4e7',
      border: '2px solid #f59e0b',
      borderRadius: '8px',
      padding: '10px',
      boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)',
      fontWeight: 'bold',
      width: 220,
    },
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
const initialLayout = getLayoutedElements(mockNodes, mockEdges, 'TB');

export const useGraphStore = create<GraphState>((set, get) => {
  let ws: WebSocket | null = null;
  
  return {
    nodes: initialLayout.nodes,
    edges: initialLayout.edges,
    direction: 'TB',
    error: null,
    activeAgentNode: null,
    websocketStatus: 'disconnected',

    setElements: (nodes, edges) => {
      const { direction } = get();
      const layouted = getLayoutedElements(nodes, edges, direction);
      set({ nodes: layouted.nodes, edges: layouted.edges });
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
          const isNginx = node.id === 'nginx';
          const isApp = node.id === 'app' || node.id.includes('app') || node.id.includes('service');
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
                get().setElements(data.nodes || [], data.edges || []);
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
