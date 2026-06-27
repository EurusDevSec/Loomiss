package daemon

import (
	"fmt"
	"loomiss/usecase"
	"net"
	"strings"
	"sync"
	"time"
)

var (
	statusesMutex sync.RWMutex
	nodeStatuses  = make(map[string]string) // nodeId -> "ONLINE" or "OFFLINE"
)

// GetNodeStatuses trả về bản sao an toàn của bản đồ trạng thái các node
func GetNodeStatuses() map[string]string {
	statusesMutex.RLock()
	defer statusesMutex.RUnlock()
	copyMap := make(map[string]string)
	for k, v := range nodeStatuses {
		copyMap[k] = v
	}
	return copyMap
}

// StartLiveShadowProber khởi chạy tiến trình giám sát trạng thái TCP định kỳ ở background
func StartLiveShadowProber(hub *Hub) {
	go func() {
		// Chờ server khởi chạy hoàn chỉnh
		time.Sleep(3 * time.Second)
		fmt.Println("[Loomiss] Live-Shadow prober service initialized.")

		ticker := time.NewTicker(8 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			graph, err := usecase.CompileGraph(".")
			if err != nil {
				continue
			}

			for _, node := range graph.Nodes {
				// Chỉ probe các node vật lý (apps, databases, gateways)
				if node.Type == "group" || node.Type == "unknown_service" {
					continue
				}

				portsStr := node.Metadata["ports"]
				if portsStr == "" {
					continue
				}

				// Phân tích và lấy các cổng host cần probe
				ports := parseHostPorts(portsStr)
				if len(ports) == 0 {
					continue
				}

				isOnline := false
				for _, port := range ports {
					addr := net.JoinHostPort("127.0.0.1", port)
					conn, err := net.DialTimeout("tcp", addr, 1500*time.Millisecond)
					if err == nil {
						_ = conn.Close()
						isOnline = true
						break
					}
				}

				status := "OFFLINE"
				if isOnline {
					status = "ONLINE"
				}

				statusesMutex.Lock()
				oldStatus, exists := nodeStatuses[node.ID]
				nodeStatuses[node.ID] = status
				statusesMutex.Unlock()

				// Phát hiện chuyển trạng thái và broadcast qua WebSocket
				if !exists || oldStatus != status {
					hub.Broadcast(map[string]interface{}{
						"type":   "SERVICE_STATUS_CHANGE",
						"nodeId": node.ID,
						"status": status,
					})
				}
			}
		}
	}()
}

// parseHostPorts phân tích cú pháp chuỗi ports (e.g. "8888:8888", "80:80,443:443")
func parseHostPorts(portsStr string) []string {
	var hostPorts []string
	// Thay thế ký tự ngăn cách thông thường bằng khoảng trắng
	s := strings.NewReplacer(",", " ", ";", " ").Replace(portsStr)
	fields := strings.Fields(s)

	for _, field := range fields {
		field = strings.TrimSpace(field)
		if field == "" {
			continue
		}

		// Định dạng port: 8888:8888 hoặc 8888
		if strings.Contains(field, ":") {
			parts := strings.Split(field, ":")
			if len(parts) > 0 {
				hostPort := strings.TrimSpace(parts[0])
				if hostPort != "" {
					hostPorts = append(hostPorts, hostPort)
				}
			}
		} else {
			hostPorts = append(hostPorts, field)
		}
	}
	return hostPorts
}
