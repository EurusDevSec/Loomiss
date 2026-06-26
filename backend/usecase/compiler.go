package usecase

import (
	"fmt"
	"regexp"
	"strings"
	"loomiss/domain"
	"loomiss/parsers"
)

// CompileGraph quét toàn bộ thư mục chỉ định và hợp nhất các sơ đồ phân tích được
func CompileGraph(workspacePath string) (*domain.GraphSchema, error) {
	var mergedNodes []domain.Node

	nodeMap := make(map[string]domain.Node)
	edgeMap := make(map[string]domain.Edge)

	// Hàm gộp các Node trùng ID
	addNodes := func(nodes []domain.Node) {
		for _, node := range nodes {
			existing, exists := nodeMap[node.ID]
			if !exists {
				nodeMap[node.ID] = node
				continue
			}

			// Hợp nhất Type (ưu tiên loại chi tiết hơn "app")
			if existing.Type == "app" && node.Type != "app" {
				existing.Type = node.Type
			}

			// Hợp nhất Label (giữ icon đẹp nhất)
			if existing.Label == "" || strings.HasPrefix(existing.Label, "🐳") || strings.HasPrefix(existing.Label, "☁️") || strings.HasPrefix(existing.Label, "🌐") {
				// Giữ nguyên nhãn cũ nếu đã có icon
			} else {
				existing.Label = node.Label
			}

			// Gộp ParentID
			if existing.ParentID == "" && node.ParentID != "" {
				existing.ParentID = node.ParentID
			}

			// Gộp Metadata
			if existing.Metadata == nil {
				existing.Metadata = make(map[string]string)
			}
			for k, v := range node.Metadata {
				if v != "" {
					existing.Metadata[k] = v
				}
			}

			nodeMap[node.ID] = existing
		}
	}

	// Hàm gộp các Edge trùng Source & Target
	addEdges := func(edges []domain.Edge) {
		for _, edge := range edges {
			edgeKey := fmt.Sprintf("%s->%s", edge.Source, edge.Target)
			existing, exists := edgeMap[edgeKey]
			if !exists {
				edgeMap[edgeKey] = edge
				continue
			}

			// Chọn label chi tiết hơn (chứa thông tin port)
			if len(edge.Label) > len(existing.Label) {
				existing.Label = edge.Label
			}
			edgeMap[edgeKey] = existing
		}
	}

	// Chạy danh sách các parser đăng ký
	defaultParsers := parsers.GetDefaultParsers()
	for _, p := range defaultParsers {
		if p.CanParse(workspacePath) {
			pNodes, pEdges, err := p.Parse(workspacePath)
			if err == nil {
				addNodes(pNodes)
				addEdges(pEdges)
			}
		}
	}


	// --- Giai đoạn Resolving (Giải quyết các tham chiếu cổng và sinh Ghost Nodes) ---
	
	// 1. Tạo bản đồ ánh xạ cổng -> NodeID
	portToNodeMap := make(map[string]string)
	for id, node := range nodeMap {
		if ports, exists := node.Metadata["ports"]; exists {
			cleanedPorts := extractIndividualPorts(ports)
			for _, p := range cleanedPorts {
				portToNodeMap[p] = id
			}
		}
	}

	// 2. Duyệt qua danh sách edges và resolve target
	var resolvedEdges []domain.Edge
	for _, edge := range edgeMap {
		// Nếu node đích tồn tại trực tiếp trong nodeMap, giữ nguyên
		if _, exists := nodeMap[edge.Target]; exists {
			resolvedEdges = append(resolvedEdges, edge)
			continue
		}

		// Nếu không tồn tại, thử tìm cổng từ Target hoặc Label
		targetPort := parsePortFromEdge(edge)
		if targetPort != "" {
			if resolvedNodeID, found := portToNodeMap[targetPort]; found {
				// Cập nhật target của edge về đúng NodeID thực tế
				edge.Target = resolvedNodeID
				resolvedEdges = append(resolvedEdges, edge)
				continue
			}
		}

		// Nếu vẫn không resolve được -> Sinh ra Ghost Node
		ghostID := "ghost-" + edge.Target
		if targetPort != "" {
			ghostID = "ghost-" + targetPort
		}

		if _, exists := nodeMap[ghostID]; !exists {
			displayLabel := fmt.Sprintf("❓ Unresolved (%s)", edge.Target)
			if targetPort != "" {
				displayLabel = fmt.Sprintf("❓ Unresolved (:%s)", targetPort)
			}
			nodeMap[ghostID] = domain.Node{
				ID:     ghostID,
				Label:  displayLabel,
				Type:   "unknown_service",
				Status: "inactive",
				Metadata: map[string]string{
					"error": "Không tìm thấy service hoặc hạ tầng nào mở cổng này trong cấu hình.",
				},
			}
		}

		// Trỏ edge về Ghost Node tương ứng
		edge.Target = ghostID
		resolvedEdges = append(resolvedEdges, edge)
	}

	// Chuyển map thành slice kết quả cuối cùng
	for _, node := range nodeMap {
		mergedNodes = append(mergedNodes, node)
	}

	// Trả về Graph Schema hoàn chỉnh
	return &domain.GraphSchema{
		Nodes: mergedNodes,
		Edges: resolvedEdges,
	}, nil
}

// Hỗ trợ trích xuất danh sách cổng số từ chuỗi metadata ports
func extractIndividualPorts(portsStr string) []string {
	var ports []string
	s := strings.NewReplacer(",", " ", ";", " ", ":", " ", "-", " ").Replace(portsStr)
	for _, f := range strings.Fields(s) {
		f = strings.TrimSpace(f)
		if f != "" {
			ports = append(ports, f)
		}
	}
	return ports
}

// Hỗ trợ tách cổng từ Target hoặc Label của Edge
func parsePortFromEdge(edge domain.Edge) string {
	// 1. Thử lấy từ Target (dạng host:port)
	if strings.Contains(edge.Target, ":") {
		parts := strings.Split(edge.Target, ":")
		return strings.TrimSpace(parts[len(parts)-1])
	}
	// 2. Thử lấy từ Label (dạng "Proxy Pass (8080)")
	re := regexp.MustCompile(`\((\d+)\)`)
	matches := re.FindStringSubmatch(edge.Label)
	if len(matches) >= 2 {
		return matches[1]
	}
	return ""
}
