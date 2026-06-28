package daemon

import (
	"archive/tar"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"loomiss/usecase"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

//go:embed dist/*
var frontendFS embed.FS

// StartServer khởi chạy HTTP Server phục vụ giao diện và API
func StartServer(port int) error {
	// Tự động giải phóng cổng nếu bị chiếm dụng trước đó
	killProcessOnPort(port)

	watchDir := "."
	if envDir := os.Getenv("LOOMISS_WATCH_DIR"); envDir != "" {
		watchDir = envDir
	}

	// Lấy thư mục dist bên trong embed.FS
	subFS, err := fs.Sub(frontendFS, "dist")
	if err != nil {
		return fmt.Errorf("failed to sub FS: %w", err)
	}

	hub := NewHub()

	// Khởi chạy File Watcher giám sát thư mục hiện tại ở background
	err = StartWatcher(watchDir, hub)
	if err != nil {
		fmt.Printf("[Loomiss] Warning: failed to start file watcher: %v\n", err)
	}

	// Khởi chạy Metrics Streamer ở background
	StartMetricsStreamer(hub)

	// Khởi chạy Live-Shadow prober giám sát cổng TCP cục bộ ở background
	StartLiveShadowProber(hub)

	mux := http.NewServeMux()
	
	// Server file tĩnh
	fileServer := http.FileServer(http.FS(subFS))
	mux.Handle("/", fileServer)

	// API trả về đồ thị phân tích thực tế (chấp nhận tham số commit lịch sử)
	mux.HandleFunc("/api/graph", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		
		commit := r.URL.Query().Get("commit")
		targetPath := watchDir
		var err error
		
		if commit != "" && commit != "active" {
			targetPath, err = extractCommitConfigs(watchDir, commit)
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"error": "Không thể trích xuất lịch sử commit: " + err.Error()})
				return
			}
		}
		
		graph, err := usecase.CompileGraph(targetPath)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		
		json.NewEncoder(w).Encode(graph)
	})

	// API trả về danh sách 15 commits gần nhất phục vụ Time Travel
	mux.HandleFunc("/api/git/commits", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		
		cmd := exec.Command("git", "log", "-n", "15", "--oneline")
		cmd.Dir = watchDir
		out, err := cmd.CombinedOutput()
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Không thể lấy lịch sử git: " + err.Error()})
			return
		}
		
		type Commit struct {
			Hash    string `json:"hash"`
			Message string `json:"message"`
		}
		
		var commits []Commit
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			parts := strings.SplitN(line, " ", 2)
			if len(parts) >= 2 {
				commits = append(commits, Commit{
					Hash:    parts[0],
					Message: parts[1],
				})
			} else if len(parts) == 1 {
				commits = append(commits, Commit{
					Hash:    parts[0],
					Message: "",
				})
			}
		}
		
		json.NewEncoder(w).Encode(commits)
	})

	// API trả về log thực tế của container
	mux.HandleFunc("/api/logs", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		nodeID := r.URL.Query().Get("nodeId")
		if nodeID == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "nodeId is required"})
			return
		}

		// Chạy lệnh docker logs để lấy log thực tế
		cmd := exec.Command("docker", "logs", "--tail", "50", nodeID)
		output, err := cmd.CombinedOutput()
		if err != nil {
			// Thử tìm tên container phù hợp trong list docker ps
			psCmd := exec.Command("docker", "ps", "--format", "{{.Names}}")
			psOut, psErr := psCmd.CombinedOutput()
			if psErr == nil {
				names := strings.Split(string(psOut), "\n")
				for _, name := range names {
					name = strings.TrimSpace(name)
					if strings.Contains(name, nodeID) {
						cmd2 := exec.Command("docker", "logs", "--tail", "50", name)
						output2, err2 := cmd2.CombinedOutput()
						if err2 == nil {
							json.NewEncoder(w).Encode(map[string]string{"logs": string(output2)})
							return
						}
					}
				}
			}
			json.NewEncoder(w).Encode(map[string]string{
				"error": fmt.Sprintf("Không thể lấy log từ container '%s'. Đảm bảo Docker đang chạy và container hoạt động.", nodeID),
			})
			return
		}

		json.NewEncoder(w).Encode(map[string]string{"logs": string(output)})
	})

	// API nhận thông tin intent của AI Agent từ MCP server
	mux.HandleFunc("/api/agent-activity", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var payload struct {
			NodeID string `json:"nodeId"`
			Action string `json:"action"`
		}

		err := json.NewDecoder(r.Body).Decode(&payload)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		fmt.Printf("[Loomiss] Received Agent Activity for node: %s, action: %s\n", payload.NodeID, payload.Action)

		// Broadcast sự kiện tới Web UI qua WebSocket
		hub.Broadcast(map[string]interface{}{
			"type":   "AGENT_ACTIVITY",
			"nodeId": payload.NodeID,
			"action": payload.Action,
		})

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Broadcasted"))
	})

	// Route cho WebSocket nâng cấp kết nối và đăng ký vào Hub
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			fmt.Printf("[Loomiss] WebSocket upgrade error: %v\n", err)
			return
		}
		
		hub.Register(conn)
		
		// Gửi ngay danh sách thay đổi code hiện tại khi vừa kết nối
		go func() {
			changes := GetGitChanges(".")
			payload, err := json.Marshal(map[string]interface{}{
				"type":    "CODE_CHANGES",
				"changes": changes,
			})
			if err == nil {
				_ = conn.WriteMessage(1, payload) // 1 là text message
			}
		}()

		// Gửi ngay trạng thái các dịch vụ Live-Shadow khi vừa kết nối
		go func() {
			statuses := GetNodeStatuses()
			payload, err := json.Marshal(map[string]interface{}{
				"type":     "INITIAL_STATUSES",
				"statuses": statuses,
			})
			if err == nil {
				_ = conn.WriteMessage(1, payload)
			}
		}()
		
		// Goroutine lắng nghe ngắt kết nối
		go func() {
			defer hub.Unregister(conn)
			for {
				_, _, err := conn.ReadMessage()
				if err != nil {
					break
				}
			}
		}()
	})

	serverAddr := fmt.Sprintf("localhost:%d", port)
	server := &http.Server{
		Addr:    serverAddr,
		Handler: mux,
	}

	fmt.Printf("[Loomiss] Web UI is running on http://%s\n", serverAddr)

	// Tự động mở trình duyệt sau 500ms để đảm bảo server đã kịp khởi chạy
	go func() {
		time.Sleep(500 * time.Millisecond)
		openBrowser(fmt.Sprintf("http://%s", serverAddr))
	}()

	return server.ListenAndServe()
}

// openBrowser mở URL trên trình duyệt mặc định tùy thuộc vào OS
func openBrowser(url string) {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "rundll32"
		args = []string{"url.dll,FileProtocolHandler", url}
	case "darwin":
		cmd = "open"
		args = []string{url}
	case "linux":
		cmd = "xdg-open"
		args = []string{url}
	default:
		fmt.Printf("[Loomiss] Please open %s manually in your browser.\n", url)
		return
	}

	exec.Command(cmd, args...).Start()
}

// killProcessOnPort tự động tìm và kết liễu tiến trình đang chiếm dụng cổng TCP truyền vào
func killProcessOnPort(port int) {
	if runtime.GOOS == "windows" {
		// Tìm PID đang LISTEN trên cổng chỉ định
		cmd := exec.Command("cmd", "/c", fmt.Sprintf("netstat -ano | findstr LISTENING | findstr :%d", port))
		out, err := cmd.Output()
		if err != nil {
			return // Cổng không bị chiếm dụng
		}

		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			fields := strings.Fields(line)
			if len(fields) >= 5 {
				localAddr := fields[1]
				if strings.HasSuffix(localAddr, fmt.Sprintf(":%d", port)) {
					pidStr := fields[len(fields)-1]
					var pidVal int
					fmt.Sscanf(pidStr, "%d", &pidVal)
					if pidVal > 0 && pidVal != os.Getpid() {
						fmt.Printf("[Loomiss] Phát hiện cổng %d đang bị chiếm dụng bởi tiến trình PID %d. Đang tự động giải phóng...\n", port, pidVal)
						// Buộc dừng tiến trình cũ
						killCmd := exec.Command("taskkill", "/F", "/PID", pidStr)
						_ = killCmd.Run()
						// Chờ hệ điều hành giải phóng socket
						time.Sleep(500 * time.Millisecond)
					}
				}
			}
		}
	} else {
		// Unix-like (Linux/macOS)
		cmd := exec.Command("sh", "-c", fmt.Sprintf("lsof -t -i:%d", port))
		out, err := cmd.Output()
		if err == nil {
			pidStr := strings.TrimSpace(string(out))
			if pidStr != "" {
				var pidVal int
				fmt.Sscanf(pidStr, "%d", &pidVal)
				if pidVal > 0 && pidVal != os.Getpid() {
					fmt.Printf("[Loomiss] Phát hiện cổng %d đang bị chiếm dụng bởi tiến trình PID %d. Đang tự động giải phóng...\n", port, pidVal)
					killCmd := exec.Command("kill", "-9", pidStr)
					_ = killCmd.Run()
					time.Sleep(500 * time.Millisecond)
				}
			}
		}
	}
}

// extractCommitConfigs trích xuất các file cấu hình quan trọng của một commit vào thư mục sandbox tạm thời
func extractCommitConfigs(workspacePath string, commit string) (string, error) {
	destDir := filepath.Join(workspacePath, ".loomiss", "history", commit)
	if _, err := os.Stat(destDir); err == nil {
		return destDir, nil
	}

	err := os.MkdirAll(destDir, 0755)
	if err != nil {
		return "", err
	}

	cmd := exec.Command("git", "archive", "--format=tar", commit)
	cmd.Dir = workspacePath
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}

	if err := cmd.Start(); err != nil {
		return "", err
	}

	tr := tar.NewReader(stdout)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}

		ext := strings.ToLower(filepath.Ext(hdr.Name))
		isImportant := ext == ".yml" || ext == ".yaml" || ext == ".tf" || ext == ".conf" ||
			ext == ".go" || ext == ".tsx" || ext == ".ts" || ext == ".js" || ext == ".css" ||
			hdr.Name == "package.json" || hdr.Name == "go.mod"

		if !isImportant && hdr.Typeflag != tar.TypeDir {
			continue
		}

		target := filepath.Join(destDir, hdr.Name)
		switch hdr.Typeflag {
		case tar.TypeDir:
			os.MkdirAll(target, 0755)
		case tar.TypeReg:
			os.MkdirAll(filepath.Dir(target), 0755)
			f, err := os.OpenFile(target, os.O_CREATE|os.O_RDWR|os.O_TRUNC, os.FileMode(hdr.Mode))
			if err != nil {
				return "", err
			}
			if _, err := io.Copy(f, tr); err != nil {
				f.Close()
				return "", err
			}
			f.Close()
		}
	}

	_ = cmd.Wait()
	return destDir, nil
}
