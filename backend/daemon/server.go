package daemon

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"loomiss/usecase"
	"net/http"
	"os/exec"
	"runtime"
	"time"
)

//go:embed dist/*
var frontendFS embed.FS

// StartServer khởi chạy HTTP Server phục vụ giao diện và API
func StartServer(port int) error {
	// Lấy thư mục dist bên trong embed.FS
	subFS, err := fs.Sub(frontendFS, "dist")
	if err != nil {
		return fmt.Errorf("failed to sub FS: %w", err)
	}

	hub := NewHub()

	// Khởi chạy File Watcher giám sát thư mục hiện tại ở background
	err = StartWatcher(".", hub)
	if err != nil {
		fmt.Printf("[Loomiss] Warning: failed to start file watcher: %v\n", err)
	}

	// Khởi chạy Metrics Streamer ở background
	StartMetricsStreamer(hub)

	mux := http.NewServeMux()
	
	// Server file tĩnh
	fileServer := http.FileServer(http.FS(subFS))
	mux.Handle("/", fileServer)

	// API trả về đồ thị phân tích thực tế của thư mục hiện tại
	mux.HandleFunc("/api/graph", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		
		graph, err := usecase.CompileGraph(".")
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		
		json.NewEncoder(w).Encode(graph)
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
