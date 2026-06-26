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

	// Route cho WebSocket (sẽ triển khai hoàn chỉnh ở Phase 3)
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("WebSocket handler not implemented in Phase 1"))
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
