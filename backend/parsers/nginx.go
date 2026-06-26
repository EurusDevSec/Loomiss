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

	// 0. Bỏ qua các dòng bị comment bằng dấu '#' để tránh parse nhầm cấu hình cũ
	var cleanLines []string
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") {
			continue
		}
		cleanLines = append(cleanLines, line)
	}
	cleanContent := strings.Join(cleanLines, "\n")

	// Regular expressions để tìm chỉ thị listen, proxy_pass và upstream
	listenReg := regexp.MustCompile(`listen\s+(\d+);`)
	proxyReg := regexp.MustCompile(`proxy_pass\s+(https?://)?([^/;\s\(\)]+);`)
	reUpstream := regexp.MustCompile(`(?s)upstream\s+([^\s{]+)\s*\{([^}]+)\}`)
	reServer := regexp.MustCompile(`server\s+([^\s;]+)`)

	var nodes []domain.Node
	var edges []domain.Edge

	// 1. Phân tích các khối upstream nếu có
	upstreamMap := make(map[string][]string)
	upstreamMatches := reUpstream.FindAllStringSubmatch(cleanContent, -1)
	for _, match := range upstreamMatches {
		if len(match) >= 3 {
			name := strings.TrimSpace(match[1])
			body := match[2]
			
			var servers []string
			serverMatches := reServer.FindAllStringSubmatch(body, -1)
			for _, sm := range serverMatches {
				if len(sm) >= 2 {
					servers = append(servers, strings.TrimSpace(sm[1]))
				}
			}
			upstreamMap[name] = servers
		}
	}

	// 2. Trích xuất cổng listen
	listens := listenReg.FindAllStringSubmatch(cleanContent, -1)
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

	// 3. Trích xuất các đích proxy_pass
	proxies := proxyReg.FindAllStringSubmatch(cleanContent, -1)
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
			ParentID: "public-gateway-group",
		})

		// 4. Tạo các Edge định tuyến
		for _, dest := range destinations {
			// Kiểm tra xem đích có phải là tên một upstream đã định nghĩa trước đó không
			servers, isUpstream := upstreamMap[dest]
			if isUpstream {
				// Nếu là upstream, phân rã liên kết đến toàn bộ các server con trong pool
				for _, server := range servers {
					host := server
					port := ""
					if strings.Contains(server, ":") {
						parts := strings.Split(server, ":")
						host = parts[0]
						port = parts[1]
					}
					host = strings.ReplaceAll(host, "$", "")

					edgeLabel := fmt.Sprintf("Proxy Pass (Upstream: %s)", dest)
					if port != "" {
						edgeLabel = fmt.Sprintf("Proxy Pass (Upstream: %s:%s)", dest, port)
					}

					edges = append(edges, domain.Edge{
						ID:     fmt.Sprintf("nginx-%s", host),
						Source: nginxID,
						Target: host,
						Label:  edgeLabel,
					})
				}
			} else {
				// Nếu là service thông thường, tạo edge trực tiếp
				host := dest
				port := ""
				if strings.Contains(dest, ":") {
					parts := strings.Split(dest, ":")
					host = parts[0]
					port = parts[1]
				}
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
	}

	if len(nodes) > 0 {
		nodes = append(nodes, domain.Node{
			ID:    "public-gateway-group",
			Label: "🌐 Public Gateway Tier",
			Type:  "group",
		})
	}

	return nodes, edges, nil
}
