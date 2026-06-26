package parsers

import (
	"fmt"
	"os"
	"regexp"
	"strings"
	"loomiss/domain"
)

// ParseNginxConfig phân tích cú pháp tệp nginx.conf để trích xuất các thông tin định tuyến
func ParseNginxConfig(filePath string) ([]domain.Node, []domain.Edge, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, nil, err
	}

	content := string(data)

	// Regular expressions để tìm chỉ thị listen và proxy_pass
	listenReg := regexp.MustCompile(`listen\s+(\d+);`)
	proxyReg := regexp.MustCompile(`proxy_pass\s+(https?://)?([^/;\s\(\)]+);`)

	var nodes []domain.Node
	var edges []domain.Edge

	// 1. Trích xuất cổng listen
	listens := listenReg.FindAllStringSubmatch(content, -1)
	ports := make([]string, 0)
	portMap := make(map[string]bool)
	for _, match := range listens {
		if len(match) >= 2 {
			port := match[1]
			if !portMap[port] {
				ports = append(ports, port)
				portMap[port] = true
			}
		}
	}

	// 2. Trích xuất các đích proxy_pass
	proxies := proxyReg.FindAllStringSubmatch(content, -1)
	destinations := make([]string, 0)
	destMap := make(map[string]bool)
	for _, match := range proxies {
		if len(match) >= 3 {
			dest := match[2]
			if !destMap[dest] {
				destinations = append(destinations, dest)
				destMap[dest] = true
			}
		}
	}

	// Nếu tìm thấy cấu hình hợp lệ, tạo Node Nginx
	if len(ports) > 0 || len(destinations) > 0 {
		nginxID := "nginx"
		portsStr := strings.Join(ports, ", ")

		nodes = append(nodes, domain.Node{
			ID:       nginxID,
			Label:    "🌐 Nginx Proxy",
			Type:     "gateway",
			Status:   "active",
			Metadata: map[string]string{
				"ports": portsStr,
			},
		})

		// 3. Tạo các Edge định tuyến
		for _, dest := range destinations {
			host := dest
			port := ""
			// Tách host và port nếu có (e.g. backend-service:8080)
			if strings.Contains(dest, ":") {
				parts := strings.Split(dest, ":")
				host = parts[0]
				port = parts[1]
			}

			// Clean các biến trong nginx ($app_server -> app_server)
			host = strings.ReplaceAll(host, "$", "")

			edgeLabel := "Proxy Pass"
			if port != "" {
				edgeLabel = fmt.Sprintf("Proxy Pass (%s)", port)
			}

			edges = append(edges, domain.Edge{
				ID:     fmt.Sprintf("nginx-%s", host),
				Source: nginxID,
				Target: host,
				Label:  edgeLabel,
			})
		}
	}

	return nodes, edges, nil
}
