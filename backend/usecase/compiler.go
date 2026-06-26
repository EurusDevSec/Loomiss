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
	// --- Giai đoạn Post-Processing (Tối ưu hóa và hợp nhất đồ thị) ---

	var hasDockerNginx bool
	var hasDockerApp bool
	var dockerAppID string
	var hasDockerSoketi bool
	var dockerSoketiID string

	for id, node := range nodeMap {
		idLower := strings.ToLower(id)
		if node.ParentID == "docker-compose-group" {
			if idLower == "nginx" {
				hasDockerNginx = true
			} else if idLower == "app" || idLower == "backend" {
				hasDockerApp = true
				dockerAppID = id
			} else if idLower == "soketi" {
				hasDockerSoketi = true
				dockerSoketiID = id
			}
		}
	}

	// Định nghĩa bản đồ hợp nhất để ánh xạ các node local/app level vào các node Docker tương ứng
	mergeMappings := make(map[string]string)
	if hasDockerApp {
		mergeMappings["laravel"] = dockerAppID
		mergeMappings["backend"] = dockerAppID
		mergeMappings["laravel-postgres"] = "postgres"
		mergeMappings["backend-postgres"] = "postgres"
		mergeMappings["laravel-pgsql"] = "postgres"
		mergeMappings["backend-pgsql"] = "postgres"
		mergeMappings["laravel-redis"] = "redis"
		mergeMappings["backend-redis"] = "redis"
		mergeMappings["laravel-sqlite"] = "postgres" // Chuyển kết nối SQLite local thành Postgres trong container
	}
	if hasDockerSoketi {
		mergeMappings["laravel-soketi"] = dockerSoketiID
		mergeMappings["backend-soketi"] = dockerSoketiID
	}

	// Thực hiện hợp nhất các thuộc tính của các node bị gộp
	for sourceID, targetID := range mergeMappings {
		sourceNode, sourceExists := nodeMap[sourceID]
		targetNode, targetExists := nodeMap[targetID]
		if sourceExists && targetExists {
			// Nâng cấp nhãn và icon của targetNode dựa trên sourceNode đẹp hơn (không áp dụng cho database để tránh SQLite đè Postgres)
			if targetNode.Type != "database" && sourceNode.Label != "" && !strings.HasPrefix(targetNode.Label, "🐘") && !strings.HasPrefix(targetNode.Label, "📡") {
				cleanLabel := sourceNode.Label
				if strings.Contains(cleanLabel, " (") {
					parts := strings.Split(cleanLabel, " (")
					cleanLabel = parts[0]
				}
				targetNode.Label = fmt.Sprintf("%s (%s)", cleanLabel, targetNode.ID)
			}
			// Gộp metadata
			if targetNode.Metadata == nil {
				targetNode.Metadata = make(map[string]string)
			}
			for k, v := range sourceNode.Metadata {
				if v != "" {
					targetNode.Metadata[k] = v
				}
			}
			nodeMap[targetID] = targetNode
			// Xóa node local thừa
			delete(nodeMap, sourceID)
		}
	}

	// Helper to extract clean image name (e.g. library/postgres:15 -> postgres)
	extractImageName := func(image string) string {
		parts := strings.Split(image, "/")
		img := parts[len(parts)-1]
		if strings.Contains(img, ":") {
			partsImg := strings.Split(img, ":")
			img = partsImg[0]
		}
		return img
	}

	// Helper to title case a string
	toTitleCase := func(s string) string {
		if len(s) == 0 {
			return ""
		}
		return strings.ToUpper(s[:1]) + strings.ToLower(s[1:])
	}

	// Đảm bảo nhãn của các node trong docker-compose-group chuẩn chỉ, sạch sẽ, không có emoji lộn xộn (ByteByteGo style)
	for id, node := range nodeMap {
		if node.ParentID == "docker-compose-group" {
			var tech *parsers.TechDefinition
			tech = parsers.DetectTechnology(id)
			if tech == nil && node.Metadata != nil {
				if img, ok := node.Metadata["image"]; ok && img != "" {
					tech = parsers.DetectTechnology(img)
				}
			}

			if tech != nil {
				suffix := parsers.GetReadableType(tech.Type)
				if tech.ID == "nginx" {
					node.Label = "Nginx Reverse Proxy"
				} else {
					node.Label = fmt.Sprintf("%s %s", tech.Name, suffix)
				}
			} else {
				cleanName := id
				if node.Metadata != nil {
					if img, ok := node.Metadata["image"]; ok && img != "" {
						cleanName = extractImageName(img)
					}
				}
				node.Label = fmt.Sprintf("%s Service", toTitleCase(cleanName))
			}
			nodeMap[id] = node
		}
	}

	// --- Giai đoạn 2.5: Tự động suy luận Edge từ biến môi trường (Env Linker) ---
	for id, node := range nodeMap {
		envValsStr, exists := node.Metadata["env_values"]
		if !exists || envValsStr == "" {
			continue
		}

		envVals := strings.Split(envValsStr, ",")
		for _, val := range envVals {
			host := extractHostFromEnvValue(val)
			if host == "" {
				continue
			}
			hostLower := strings.ToLower(host)

			// Tìm kiếm node đích tương xứng trong nodeMap
			for targetID, targetNode := range nodeMap {
				if id == targetID {
					continue
				}

				targetIDLower := strings.ToLower(targetID)
				targetLabelLower := strings.ToLower(targetNode.Label)
				// Loại bỏ emoji của target label để so khớp chính xác
				reEmoji := regexp.MustCompile(`[\x{1F300}-\x{1F9FF}]|[\x{2700}-\x{27BF}]|[\x{2600}-\x{26FF}]|🐳|🐘|🐬|💾|📡|❤️|⚛️|🐹|🎼|🔴|☸️|🛡️|⚡|💚|🧡|🅰️|🍃|🧪|💎|🦭|👁️|🔍|🐇|🫘|🦆|🚦|🦍|⚖️|☁️|🌐`)
				targetLabelClean := strings.TrimSpace(reEmoji.ReplaceAllString(targetLabelLower, ""))

				isMatch := targetIDLower == hostLower || targetLabelClean == hostLower

				// So khớp thêm qua host metadata nếu có
				if !isMatch && targetNode.Metadata != nil {
					if th, ok := targetNode.Metadata["host"]; ok && strings.ToLower(th) == hostLower {
						isMatch = true
					}
				}

				if isMatch {
					edgePort := extractPortFromEnvValue(val)
					edgeLabel := "Connects"
					if edgePort != "" {
						edgeLabel = fmt.Sprintf("Connects (%s)", edgePort)
					}

					edgeKey := fmt.Sprintf("%s->%s", id, targetID)
					if _, ok := edgeMap[edgeKey]; !ok {
						edgeMap[edgeKey] = domain.Edge{
							ID:     fmt.Sprintf("%s-%s", id, targetID),
							Source: id,
							Target: targetID,
							Label:  edgeLabel,
						}
					}
					break // Đã match target, chuyển sang biến môi trường tiếp theo
				}
			}
		}
	}

	// Định tuyến lại các Edges dựa trên bản đồ hợp nhất và Nginx Proxy
	newEdgeMap := make(map[string]domain.Edge)
	for _, edge := range edgeMap {
		src := edge.Source
		tgt := edge.Target

		if mappedSrc, exists := mergeMappings[src]; exists {
			src = mappedSrc
		}
		if mappedTgt, exists := mergeMappings[tgt]; exists {
			tgt = mappedTgt
		}

		// Nếu Nginx tồn tại và Edge đi từ Frontend tới App, định tuyến lại qua Nginx (Reverse Proxy)
		if hasDockerNginx {
			if strings.Contains(strings.ToLower(src), "frontend") {
				if tgt == dockerAppID {
					tgt = "nginx"
					edge.Label = "HTTP API"
				}
			}
		}

		// Tránh tự nối vòng (self-loop)
		if src == tgt {
			continue
		}

		edgeKey := fmt.Sprintf("%s->%s", src, tgt)
		edge.Source = src
		edge.Target = tgt
		edge.ID = fmt.Sprintf("%s-%s", src, tgt)

		// Chỉ giữ edge có label chi tiết nhất
		if existing, exists := newEdgeMap[edgeKey]; !exists || len(edge.Label) > len(existing.Label) {
			newEdgeMap[edgeKey] = edge
		}
	}
	edgeMap = newEdgeMap

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

// extractHostFromEnvValue trích xuất hostname hoặc IP từ chuỗi biến môi trường
func extractHostFromEnvValue(val string) string {
	val = strings.TrimSpace(val)
	if val == "" {
		return ""
	}
	// 1. Tách schema nếu có (e.g. redis://redis:6379)
	if strings.Contains(val, "://") {
		parts := strings.SplitN(val, "://", 2)
		val = parts[1]
	}
	// 2. Loại bỏ credentials (e.g. user:pass@db:5432)
	if strings.Contains(val, "@") {
		parts := strings.SplitN(val, "@", 2)
		val = parts[1]
	}
	// 3. Loại bỏ paths và ports (e.g. db:5432/dbname)
	if strings.Contains(val, "/") {
		parts := strings.SplitN(val, "/", 2)
		val = parts[0]
	}
	if strings.Contains(val, ":") {
		parts := strings.SplitN(val, ":", 2)
		val = parts[0]
	}
	return strings.TrimSpace(val)
}

// extractPortFromEnvValue trích xuất port số từ chuỗi biến môi trường
func extractPortFromEnvValue(val string) string {
	rePort := regexp.MustCompile(`:(\d+)`)
	matches := rePort.FindStringSubmatch(val)
	if len(matches) >= 2 {
		return matches[1]
	}
	return ""
}
