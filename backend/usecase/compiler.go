package usecase

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"loomiss/domain"
	"loomiss/parsers"
)

// CompileGraph quét toàn bộ thư mục chỉ định và hợp nhất các sơ đồ phân tích được
func CompileGraph(workspacePath string) (*domain.GraphSchema, error) {
	var mergedNodes []domain.Node
	var mergedEdges []domain.Edge

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
			if existing.Label == "" || strings.HasPrefix(existing.Label, "🐳") || strings.HasPrefix(existing.Label, "☁️") {
				// Giữ nguyên nhãn cũ nếu đã có icon
			} else {
				existing.Label = node.Label
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

	// Quét đệ quy thư mục
	err := filepath.Walk(workspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Tiếp tục quét kể cả khi lỗi đọc một file
		}

		if info.IsDir() {
			name := info.Name()
			// Bỏ qua các thư mục hệ thống / phụ trợ lớn để tối ưu hóa
			if strings.HasPrefix(name, ".") || name == "node_modules" || name == "dist" || name == "bin" {
				return filepath.SkipDir
			}

			// Quét các tệp Terraform trong thư mục này
			tfNodes, tfEdges, err := parsers.ParseTerraformDirectory(path)
			if err == nil && len(tfNodes) > 0 {
				addNodes(tfNodes)
				addEdges(tfEdges)
			}
			return nil
		}

		filename := strings.ToLower(info.Name())

		// Phân tích Docker Compose
		if filename == "docker-compose.yml" || filename == "docker-compose.yaml" {
			dcNodes, dcEdges, err := parsers.ParseDockerCompose(path)
			if err == nil {
				addNodes(dcNodes)
				addEdges(dcEdges)
			}
		}

		// Phân tích Nginx Config
		if filename == "nginx.conf" || (strings.Contains(filename, "nginx") && strings.HasSuffix(filename, ".conf")) {
			nxNodes, nxEdges, err := parsers.ParseNginxConfig(path)
			if err == nil {
				addNodes(nxNodes)
				addEdges(nxEdges)
			}
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to compile graph recursively: %w", err)
	}

	// Chuyển map thành slice kết quả
	for _, node := range nodeMap {
		mergedNodes = append(mergedNodes, node)
	}
	for _, edge := range edgeMap {
		mergedEdges = append(mergedEdges, edge)
	}

	// Trả về Graph Schema hoàn chỉnh
	return &domain.GraphSchema{
		Nodes: mergedNodes,
		Edges: mergedEdges,
	}, nil
}
