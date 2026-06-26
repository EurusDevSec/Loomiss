package daemon

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"loomiss/usecase"
)

// StartWatcher khởi chạy tiến trình giám sát thư mục dự án và debounce
func StartWatcher(workspacePath string, hub *Hub) error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("failed to create fsnotify watcher: %w", err)
	}

	// Đệ quy thêm tất cả các thư mục con vào watcher (loại trừ các thư mục không cần thiết)
	err = filepath.Walk(workspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			name := info.Name()
			if strings.HasPrefix(name, ".") || name == "node_modules" || name == "dist" || name == "bin" {
				return filepath.SkipDir
			}
			err = watcher.Add(path)
			if err != nil {
				fmt.Printf("[Loomiss] Warning: failed to watch directory %s: %v\n", path, err)
			}
		}
		return nil
	})
	if err != nil {
		watcher.Close()
		return fmt.Errorf("failed to walk workspace directory: %w", err)
	}

	// Goroutine xử lý và lọc sự kiện
	go func() {
		defer watcher.Close()

		var debounceTimer *time.Timer
		debounceDuration := 1500 * time.Millisecond
		eventChan := make(chan bool)

		// Goroutine xử lý debounce bằng Timer
		go func() {
			for range eventChan {
				if debounceTimer != nil {
					debounceTimer.Stop()
				}
				debounceTimer = time.AfterFunc(debounceDuration, func() {
					fmt.Println("[Loomiss] Workspace change detected, re-compiling graph...")
					
					graph, err := usecase.CompileGraph(workspacePath)
					if err != nil {
						fmt.Printf("[Loomiss] Syntax error in config files (LKG safe mode): %v\n", err)
						// Phát tin nhắn lỗi cú pháp cho UI (chế độ LKG)
						hub.Broadcast(map[string]interface{}{
							"type":    "PARSE_ERROR",
							"message": err.Error(),
						})
						return
					}

					fmt.Printf("[Loomiss] Graph compiled successfully with %d nodes and %d edges\n", len(graph.Nodes), len(graph.Edges))
					// Phát tin nhắn cập nhật đồ thị cho UI
					hub.Broadcast(map[string]interface{}{
						"type":  "UPDATE_GRAPH",
						"nodes": graph.Nodes,
						"edges": graph.Edges,
					})
				})
			}
		}()

		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}

				// Chỉ quan tâm đến các tệp cấu hình
				filename := filepath.Base(event.Name)
				ext := strings.ToLower(filepath.Ext(filename))
				isConfig := ext == ".yml" || ext == ".yaml" || ext == ".tf" || ext == ".conf"
				
				if isConfig {
					// Lắng nghe các tác vụ ghi, tạo hoặc xóa file
					if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create || event.Op&fsnotify.Remove == fsnotify.Remove {
						eventChan <- true
					}
				}

			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				fmt.Printf("[Loomiss] Watcher error: %v\n", err)
			}
		}
	}()

	return nil
}
