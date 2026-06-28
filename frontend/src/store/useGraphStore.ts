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
  selectedNodeId: string | null;
  metricsHistory: Record<string, { cpu: number[]; ram: number[]; network: number[] }>;
  codeChanges: { path: string; status: string; additions: number; deletions: number; }[];
  geminiApiKey: string | null;
  vulnerabilities: { nodeId: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string; }[];
  
  // Phase 6 Digital Twin States
  historicMode: boolean;
  historicCommit: string;
  nodeStatuses: Record<string, 'ONLINE' | 'OFFLINE'>;
  routingTrace: string[];
  
  // Performance Optimization Mode
  performanceMode: boolean;
  
  // Actions
  setElements: (nodes: Node[], edges: Edge[]) => void;
  setDirection: (dir: 'TB' | 'LR') => void;
  setError: (err: string | null) => void;
  setActiveAgentNode: (nodeId: string | null) => void;
  connectWebSocket: (url?: string) => void;
  fetchGraph: (commit?: string) => Promise<void>;
  setTheme: (theme: 'light' | 'dark') => void;
  setSelectedNodeId: (id: string | null) => void;
  setGeminiApiKey: (key: string | null) => void;
  setVulnerabilities: (vulns: { nodeId: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string; }[]) => void;
  setPerformanceMode: (mode: boolean) => void;
  
  // Phase 6 Digital Twin Actions
  setHistoricMode: (mode: boolean, commit?: string) => void;
  setNodeStatus: (nodeId: string, status: 'ONLINE' | 'OFFLINE') => void;
  setInitialStatuses: (statuses: Record<string, 'ONLINE' | 'OFFLINE'>) => void;
  setRoutingTrace: (trace: string[]) => void;
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

  // 3a. AWS resource_type -> specific icon slug (highest priority for AWS services)
  const awsResourceTypeMap: Record<string, string> = {
    'aws_lambda_function': 'awslambda',
    'aws_dynamodb_table': 'awsdynamodb',
    'aws_cloudfront_distribution': 'awscloudfront',
    'aws_api_gateway_rest_api': 'awsapigateway',
    'aws_api_gateway_integration': 'awsapigateway',
    'aws_apigatewayv2_api': 'awsapigateway',
    'aws_ecs_cluster': 'awsecs',
    'aws_ecs_service': 'awsecs',
    'aws_ecs_task_definition': 'awsfargate',
    'aws_media_connect_flow': 'awsmediaconnect',
    'aws_media_live_channel': 'awsmedialive',
    'aws_media_package_channel': 'awsmediapackage',
    'aws_medialive_channel': 'awsmedialive',
    'aws_mediaconnect_flow': 'awsmediaconnect',
    'aws_mediapackage_channel': 'awsmediapackage',
    'aws_iam_role': 'awsiam',
    'aws_iam_role_policy': 'awsiam',
    'aws_iam_policy': 'awsiam',
    'aws_transcribe_vocabulary': 'awstranscribe',
    'aws_route53_zone': 'amazonroute53',
    'aws_route53_record': 'amazonroute53',
  };
  const resType = (metadata?.resource_type || '').toLowerCase();
  if (resType && awsResourceTypeMap[resType]) {
    return awsResourceTypeMap[resType];
  }

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
    'aws': 'amazonaws',
    'lambda': 'awslambda',
    'cloudfront': 'awscloudfront',
    'dynamodb': 'awsdynamodb',
    'apigateway': 'awsapigateway',
    'api_gateway': 'awsapigateway',
    'media_connect': 'awsmediaconnect',
    'media_live': 'awsmedialive',
    'media_package': 'awsmediapackage',
    'fargate': 'awsfargate',
    'ecs': 'awsecs',
    'bedrock': 'amazonaws',
    'transcribe': 'awstranscribe',
    'iam': 'awsiam',
    'gcp': 'googlecloud',
    'google-cloud': 'googlecloud',
    'azure': 'microsoftazure',
    'cloudflare': 'cloudflare',
    'digitalocean': 'digitalocean',
    'github': 'github',
    'python': 'python',
    'java': 'java',
    'csharp': 'csharp',
    'c#': 'csharp',
    'dotnet': 'dotnet'
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

const formatGraphData = (rawNodes: any[], rawEdges: any[]): { nodes: Node[]; edges: Edge[] } => {
  // 1. Detect if we have AWS resources and reconstruct hierarchy / edges
  const hasAWS = rawNodes.some(n => n.metadata && n.metadata.provider === 'aws');

  let processedRawNodes = [...rawNodes];
  let processedRawEdges = [...rawEdges];

  if (hasAWS) {
    // Add AWS Cloud & Region groups if not present
    if (!processedRawNodes.some(n => n.id === 'aws-cloud-group')) {
      processedRawNodes.push({
        id: 'aws-cloud-group',
        label: '☁️ AWS Cloud',
        type: 'group',
      });
    }
    if (!processedRawNodes.some(n => n.id === 'aws-region-group')) {
      processedRawNodes.push({
        id: 'aws-region-group',
        label: '🌐 Region (us-east-1)',
        type: 'group',
        parentId: 'aws-cloud-group',
      });
    }

    // Set parent ID for AWS resources
    processedRawNodes = processedRawNodes.map(node => {
      if (node.metadata && node.metadata.provider === 'aws') {
        const resType = node.metadata.resource_type || '';
        if (resType === 'aws_cloudfront_distribution' || resType === 'aws_route53_zone') {
          return { ...node, parentId: 'aws-cloud-group' };
        } else {
          return { ...node, parentId: 'aws-region-group' };
        }
      }
      return node;
    });

    // Remove old terraform-group
    processedRawNodes = processedRawNodes.filter(n => n.id !== 'terraform-group');

    // Helper to dynamically inject missing AWS edges
    const addAWSLink = (src: string, tgt: string, label: string) => {
      const edgeKey = `${src}-${tgt}`;
      if (!processedRawEdges.some(e => e.source === src && e.target === tgt)) {
        processedRawEdges.push({
          id: edgeKey,
          source: src,
          target: tgt,
          label: label
        });
      }
    };

    // Find full resource IDs in processedRawNodes
    const findNodeIdByPrefix = (prefix: string) => {
      const match = processedRawNodes.find(n => n.id.toLowerCase().includes(prefix.toLowerCase()));
      return match ? match.id : null;
    };

    const mediaConnectId = findNodeIdByPrefix('media_connect');
    const mediaLiveId = findNodeIdByPrefix('media_live');
    const mediaPackageId = findNodeIdByPrefix('media_package');
    const cdnId = findNodeIdByPrefix('cloudfront') || findNodeIdByPrefix('cdn');
    const apiId = findNodeIdByPrefix('api_gateway') || findNodeIdByPrefix('api');
    const lambdaId = findNodeIdByPrefix('lambda') || findNodeIdByPrefix('event_handler');
    const dbId = findNodeIdByPrefix('dynamodb') || findNodeIdByPrefix('metadata_store');
    const fargateId = findNodeIdByPrefix('fargate') || findNodeIdByPrefix('fargate_service');
    const transcribeId = findNodeIdByPrefix('transcribe') || findNodeIdByPrefix('transcribe_processor');
    const policyId = findNodeIdByPrefix('policy') || findNodeIdByPrefix('fargate_ai_policy');

    // Inject missing edges based on live stream architecture flow:
    if (mediaConnectId && mediaLiveId) {
      addAWSLink(mediaConnectId, mediaLiveId, 'Video Ingest');
    }
    if (mediaLiveId && mediaPackageId) {
      addAWSLink(mediaLiveId, mediaPackageId, 'Stream Packaging');
    }
    if (mediaPackageId && cdnId) {
      addAWSLink(mediaPackageId, cdnId, 'CDN Origin');
    }
    if (mediaPackageId && lambdaId) {
      addAWSLink(mediaPackageId, lambdaId, 'Event Trigger');
    }
    if (lambdaId && dbId) {
      addAWSLink(lambdaId, dbId, 'Metadata Store');
    }
    if (fargateId && transcribeId) {
      addAWSLink(fargateId, transcribeId, 'Audio Stream');
    }
    if (fargateId && dbId) {
      addAWSLink(fargateId, dbId, 'Metadata Store');
    }
    if (transcribeId && dbId) {
      addAWSLink(transcribeId, dbId, 'Write Transcripts');
    }
    if (cdnId && apiId) {
      addAWSLink(cdnId, apiId, 'API Gateway Integration');
    }
    if (policyId && fargateId) {
      addAWSLink(policyId, fargateId, 'IAM Role Policy');
    }
  }

  const formattedNodes: Node[] = processedRawNodes.map((node) => {
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
        parentId: node.parentId,
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
    
    let cleanLabel = node.label || node.id;
    cleanLabel = cleanLabel.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{2600}-\u{26FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{2B50}]/gu, '').trim();
    cleanLabel = cleanLabel.replace(/🐘|🐬|💾|📡|⚡|❤️|🐳|🌐|⚙️|🗄️|☁️|🐙|🧓|🔥|📊/g, '').trim();

    const logoSlug = getLogoSlug(node.id, node.type, cleanLabel, node.metadata?.image, node.metadata);

    // Official AWS architecture icons from awslabs/aws-icons-for-plantuml
    const AWS_ICON_BASE = 'https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/v18.0/dist';
    const awsIconMap: Record<string, string> = {
      'awslambda':       `${AWS_ICON_BASE}/Compute/Lambda.png`,
      'awsdynamodb':     `${AWS_ICON_BASE}/Database/DynamoDB.png`,
      'awscloudfront':   `${AWS_ICON_BASE}/NetworkingContentDelivery/CloudFront.png`,
      'awsapigateway':   `${AWS_ICON_BASE}/ApplicationIntegration/APIGateway.png`,
      'awsfargate':      `${AWS_ICON_BASE}/Containers/Fargate.png`,
      'awsecs':          `${AWS_ICON_BASE}/Containers/ElasticContainerService.png`,
      'awsmediaconnect': `${AWS_ICON_BASE}/MediaServices/ElementalMediaConnect.png`,
      'awsmedialive':    `${AWS_ICON_BASE}/MediaServices/ElementalMediaLive.png`,
      'awsmediapackage': `${AWS_ICON_BASE}/MediaServices/ElementalMediaPackage.png`,
      'awstranscribe':   `${AWS_ICON_BASE}/MachineLearning/Transcribe.png`,
      'awsiam':          `${AWS_ICON_BASE}/SecurityIdentityCompliance/IdentityandAccessManagement.png`,
      'amazonroute53':   `${AWS_ICON_BASE}/NetworkingContentDelivery/Route53.png`,
    };

    const logoUrl = logoSlug && awsIconMap[logoSlug]
      ? awsIconMap[logoSlug]
      : logoSlug === 'redis'
      ? 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redis/redis-original.svg'
      : (logoSlug === 'aws' || logoSlug === 'amazonwebservices' || logoSlug === 'amazonaws')
      ? 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/amazonaws.svg'
      : logoSlug
      ? `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${logoSlug}.svg`
      : null;

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

  const formattedEdges: Edge[] = processedRawEdges.map((edge) => {
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
const initialLayout = getLayoutedElements(formattedMock.nodes, formattedMock.edges, 'LR');

export const useGraphStore = create<GraphState>((set, get) => {
  let ws: WebSocket | null = null;
  let diffTimeout: any = null;
  
  return {
    nodes: initialLayout.nodes,
    edges: initialLayout.edges,
    direction: 'LR',
    error: null,
    activeAgentNode: null,
    theme: 'light',
    websocketStatus: 'disconnected',
    selectedNodeId: null,
    metricsHistory: {},
    codeChanges: [],
    geminiApiKey: localStorage.getItem('loomiss_gemini_api_key') || null,
    vulnerabilities: [],

    // Phase 6 Digital Twin States
    historicMode: false,
    historicCommit: 'active',
    nodeStatuses: {},
    routingTrace: [],
    // Performance Optimization Mode
    performanceMode: false,

    setTheme: (theme) => set({ theme }),
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    setGeminiApiKey: (key) => {
      if (key) {
        localStorage.setItem('loomiss_gemini_api_key', key);
      } else {
        localStorage.removeItem('loomiss_gemini_api_key');
      }
      set({ geminiApiKey: key });
    },
    setVulnerabilities: (vulns) => set({ vulnerabilities: vulns }),
    setPerformanceMode: (mode) => set({ performanceMode: mode }),

    // Phase 6 Digital Twin Actions
    setHistoricMode: (mode, commit) => set({ historicMode: mode, historicCommit: commit || 'active' }),
    setNodeStatus: (nodeId, status) => set((state) => ({
      nodeStatuses: { ...state.nodeStatuses, [nodeId]: status }
    })),
    setInitialStatuses: (statuses) => set({ nodeStatuses: statuses }),
    setRoutingTrace: (trace) => set((state) => {
      const updatedEdges = state.edges.map(edge => {
        const isHighlighted = trace.includes(edge.id);
        const isNginx = edge.source === 'nginx' || edge.source.includes('nginx') || edge.source.includes('gateway');
        const defaultClr = isNginx ? '#06b6d4' : '#a855f7';
        return {
          ...edge,
          style: {
            ...edge.style,
            stroke: isHighlighted ? '#eab308' : defaultClr,
            strokeWidth: isHighlighted ? 4 : 2,
          }
        };
      });
      return { routingTrace: trace, edges: updatedEdges };
    }),

    setElements: (nodes, edges) => {
      const { direction, nodes: currentNodes, edges: currentEdges, performanceMode } = get();
      
      // Auto-enable performance mode on large graphs (over 15 nodes)
      if (nodes.length > 15 && !performanceMode) {
        set({ performanceMode: true });
      }
      
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

    fetchGraph: async (commit) => {
      try {
        const url = commit && commit !== 'active' ? `/api/graph?commit=${commit}` : '/api/graph';
        const response = await fetch(url);
        if (!response.ok) throw new Error('Không thể tải dữ liệu từ daemon server');
        const data = await response.json();
        
        if (data.nodes && data.nodes.length > 0) {
          const { nodes, edges } = formatGraphData(data.nodes, data.edges || []);
          
          const isHistoric = commit && commit !== 'active';
          const { nodeStatuses } = get();

          const nodesWithLiveStatuses = nodes.map(node => {
            if (!isHistoric && nodeStatuses[node.id]) {
              return {
                ...node,
                data: {
                  ...node.data,
                  status: nodeStatuses[node.id]
                }
              };
            }
            return node;
          });

          get().setElements(nodesWithLiveStatuses, edges);
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
              case 'UPDATE_GRAPH': {
                set({ error: null, vulnerabilities: [] });
                if (data.nodes) {
                  const { nodes, edges } = formatGraphData(data.nodes, data.edges || []);
                  
                  // Chỉ áp dụng Live Statuses khi KHÔNG ở chế độ Time Travel lịch sử
                  const { historicMode, nodeStatuses } = get();
                  const nodesWithStatuses = nodes.map(node => {
                    if (!historicMode && nodeStatuses[node.id]) {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          status: nodeStatuses[node.id]
                        }
                      };
                    }
                    return node;
                  });

                  get().setElements(nodesWithStatuses, edges);
                }
                break;
              }
              case 'SERVICE_STATUS_CHANGE': {
                set((state) => {
                  const updatedStatuses = { ...state.nodeStatuses, [data.nodeId]: data.status };
                  
                  // Chỉ cập nhật trạng thái hiển thị trực quan của node khi KHÔNG ở chế độ Time Travel lịch sử
                  if (state.historicMode) {
                    return { nodeStatuses: updatedStatuses };
                  }

                  const updatedNodes = state.nodes.map(node => {
                    if (node.id === data.nodeId) {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          status: data.status
                        }
                      };
                    }
                    return node;
                  });
                  return { nodeStatuses: updatedStatuses, nodes: updatedNodes };
                });
                break;
              }
              case 'INITIAL_STATUSES': {
                if (data.statuses) {
                  set((state) => {
                    if (state.historicMode) {
                      return { nodeStatuses: data.statuses };
                    }
                    const updatedNodes = state.nodes.map(node => {
                      if (data.statuses[node.id]) {
                        return {
                          ...node,
                          data: {
                            ...node.data,
                            status: data.statuses[node.id]
                          }
                        };
                      }
                      return node;
                    });
                    return { nodeStatuses: data.statuses, nodes: updatedNodes };
                  });
                }
                break;
              }
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
              case 'CODE_CHANGES':
                if (data.changes) {
                  set({ codeChanges: data.changes });
                }
                break;
              case 'METRICS_UPDATE': {
                const metrics = data.metrics as Record<string, { cpu: number; ram: number; network: number }>;
                set((state) => {
                  const newHistory = { ...state.metricsHistory };
                  
                  Object.keys(metrics).forEach(nodeId => {
                    if (!newHistory[nodeId]) {
                      newHistory[nodeId] = { cpu: [], ram: [], network: [] };
                    }
                    
                    const cpuHistory = [...newHistory[nodeId].cpu, metrics[nodeId].cpu];
                    const ramHistory = [...newHistory[nodeId].ram, metrics[nodeId].ram];
                    const networkHistory = [...newHistory[nodeId].network, metrics[nodeId].network];
                    
                    if (cpuHistory.length > 20) cpuHistory.shift();
                    if (ramHistory.length > 20) ramHistory.shift();
                    if (networkHistory.length > 20) networkHistory.shift();
                    
                    newHistory[nodeId] = {
                      cpu: cpuHistory,
                      ram: ramHistory,
                      network: networkHistory
                    };
                  });

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

                  return { 
                    nodes: updatedNodes, 
                    edges: updatedEdges,
                    metricsHistory: newHistory
                  };
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
