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
  fetchGraph: () => Promise<void>;
}

// Hàm chuẩn hóa dữ liệu đồ thị thô từ Backend thành các styled Nodes/Edges của React Flow
const formatGraphData = (rawNodes: any[], rawEdges: any[]): { nodes: Node[]; edges: Edge[] } => {
  const formattedNodes: Node[] = rawNodes.map((node) => {
    const isNginx = node.id === 'nginx' || node.type === 'gateway';
    const isApp = node.type === 'app';
    const borderClr = isNginx ? '#06b6d4' : isApp ? '#a855f7' : '#f59e0b';
    const shadowClr = isNginx ? 'rgba(6, 182, 212, 0.3)' : isApp ? 'rgba(168, 85, 247, 0.3)' : 'rgba(245, 158, 11, 0.3)';
    
    // Thêm icon tùy thuộc vào loại node
    let label = node.label || node.id;
    if (!label.includes('🌐') && !label.includes('⚙️') && !label.includes('🐳') && !label.includes('🗄️') && !label.includes('☁️')) {
      if (isNginx) label = '🌐 ' + label;
      else if (isApp) label = '⚙️ ' + label;
      else label = '🗄️ ' + label;
    }

    // Gắn thêm nhãn cổng nếu có trong metadata
    const ports = node.metadata?.ports;
    const displayLabel = ports ? `${label} (${ports})` : label;

    return {
      id: node.id,
      type: 'default',
      data: { label: displayLabel },
      position: { x: 0, y: 0 },
      style: {
        background: 'rgba(9, 9, 11, 0.8)',
        color: '#e4e4e7',
        border: `2px solid ${borderClr}`,
        borderRadius: '8px',
        padding: '10px',
        boxShadow: `0 0 15px ${shadowClr}`,
        fontWeight: 'bold',
        width: 220,
      },
    };
  });

  const formattedEdges: Edge[] = rawEdges.map((edge) => {
    const isNginx = edge.source === 'nginx';
    const strokeClr = isNginx ? '#06b6d4' : '#a855f7';
    
    return {
      id: edge.id || `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label || '',
      animated: true,
      style: { stroke: strokeClr, strokeWidth: 2 },
      labelStyle: { fill: '#a1a1aa', fontSize: 10, fontWeight: 'bold' },
      labelBgStyle: { fill: '#18181b', fillOpacity: 0.8 },
    };
  });

  return { nodes: formattedNodes, edges: formattedEdges };
};

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
