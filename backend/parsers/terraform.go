package parsers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclsyntax"
	"loomiss/domain"
)

// ParseTerraformDirectory quét thư mục và phân tích tất cả các tệp .tf
func ParseTerraformDirectory(dirPath string) ([]domain.Node, []domain.Edge, error) {
	var nodes []domain.Node
	var edges []domain.Edge

	files, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, nil, err
	}

	// Lưu danh sách các resource ID để kiểm tra sự tồn tại khi tạo edge
	resourceMap := make(map[string]bool)

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".tf") {
			continue
		}

		filePath := filepath.Join(dirPath, file.Name())
		data, err := os.ReadFile(filePath)
		if err != nil {
			return nil, nil, err
		}

		// Parse cấu hình HCL
		f, diag := hclsyntax.ParseConfig(data, file.Name(), hcl.Pos{Line: 1, Column: 1})
		if diag.HasErrors() {
			// Bỏ qua tệp bị lỗi cú pháp tạm thời
			continue
		}

		body, ok := f.Body.(*hclsyntax.Body)
		if !ok {
			continue
		}

		for _, block := range body.Blocks {
			if block.Type == "resource" && len(block.Labels) >= 2 {
				resType := block.Labels[0] // aws_instance
				resName := block.Labels[1] // web

				nodeID := fmt.Sprintf("%s.%s", resType, resName)
				resourceMap[nodeID] = true

				// Phân loại Node
				nodeType := "app"
				if strings.Contains(resType, "db") || strings.Contains(resType, "rds") || strings.Contains(resType, "dynamodb") || strings.Contains(resType, "redis") || strings.Contains(resType, "cache") {
					nodeType = "database"
				} else if strings.Contains(resType, "lb") || strings.Contains(resType, "gateway") || strings.Contains(resType, "route53") {
					nodeType = "gateway"
				}

				nodes = append(nodes, domain.Node{
					ID:       nodeID,
					Label:    fmt.Sprintf("☁️ %s", resName),
					Type:     nodeType,
					Status:   "active",
					Metadata: map[string]string{
						"provider":      strings.Split(resType, "_")[0],
						"resource_type": resType,
					},
					ParentID: "terraform-group",
				})

				// Tìm các tham chiếu biến bên trong các thuộc tính
				for _, attr := range block.Body.Attributes {
					refs := extractReferences(attr.Expr)
					for _, ref := range refs {
						edges = append(edges, domain.Edge{
							ID:     fmt.Sprintf("%s-%s", nodeID, ref),
							Source: nodeID,
							Target: ref,
							Label:  attr.Name,
						})
					}
				}
			}
		}
	}

	// Lọc lại các Edges, chỉ giữ những edge nối giữa các Node thực sự tồn tại trong đồ thị
	var validEdges []domain.Edge
	for _, edge := range edges {
		if resourceMap[edge.Source] && resourceMap[edge.Target] {
			validEdges = append(validEdges, edge)
		}
	}

	if len(nodes) > 0 {
		nodes = append(nodes, domain.Node{
			ID:    "terraform-group",
			Label: "☁️ Terraform Cloud Tier",
			Type:  "group",
		})
	}

	return nodes, validEdges, nil
}

// extractReferences trích xuất biến tham chiếu từ HCL Expression
func extractReferences(expr hcl.Expression) []string {
	var refs []string
	for _, traversal := range expr.Variables() {
		var parts []string
		for _, traverser := range traversal {
			switch t := traverser.(type) {
			case hcl.TraverseRoot:
				parts = append(parts, t.Name)
			case hcl.TraverseAttr:
				parts = append(parts, t.Name)
			}
		}
		// Một tham chiếu resource đầy đủ phải có ít nhất 2 phần (e.g. aws_db_instance.postgres)
		if len(parts) >= 2 {
			refs = append(refs, fmt.Sprintf("%s.%s", parts[0], parts[1]))
		}
	}
	return refs
}
