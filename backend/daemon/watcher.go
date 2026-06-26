package daemon

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
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

	cleanWorkspacePath := filepath.Clean(workspacePath)
	// Đệ quy thêm tất cả các thư mục con vào watcher (loại trừ các thư mục không cần thiết)
	err = filepath.Walk(cleanWorkspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if filepath.Clean(path) != cleanWorkspacePath {
				name := info.Name()
				if strings.HasPrefix(name, ".") || name == "node_modules" || name == "dist" || name == "bin" {
					return filepath.SkipDir
				}
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

		var graphDebounceTimer *time.Timer
		var codeDebounceTimer *time.Timer
		
		graphDebounceDuration := 1500 * time.Millisecond
		codeDebounceDuration := 500 * time.Millisecond

		broadcastCodeChanges := func() {
			changes := GetGitChanges(workspacePath)
			hub.Broadcast(map[string]interface{}{
				"type":    "CODE_CHANGES",
				"changes": changes,
			})
		}

		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}

				filename := filepath.Base(event.Name)
				ext := strings.ToLower(filepath.Ext(filename))
				isConfig := ext == ".yml" || ext == ".yaml" || ext == ".tf" || ext == ".conf"
				isSource := ext == ".go" || ext == ".tsx" || ext == ".ts" || ext == ".js" || ext == ".css"

				if isConfig || isSource {
					// Lắng nghe các tác vụ ghi, tạo hoặc xóa file
					if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create || event.Op&fsnotify.Remove == fsnotify.Remove {
						// Trigger code changes update quickly
						if codeDebounceTimer != nil {
							codeDebounceTimer.Stop()
						}
						codeDebounceTimer = time.AfterFunc(codeDebounceDuration, broadcastCodeChanges)

						// Trigger graph compile only for config changes
						if isConfig {
							if graphDebounceTimer != nil {
								graphDebounceTimer.Stop()
							}
							graphDebounceTimer = time.AfterFunc(graphDebounceDuration, func() {
								fmt.Println("[Loomiss] Workspace config change detected, re-compiling graph...")
								graph, err := usecase.CompileGraph(workspacePath)
								if err != nil {
									fmt.Printf("[Loomiss] Syntax error in config files (LKG safe mode): %v\n", err)
									hub.Broadcast(map[string]interface{}{
										"type":    "PARSE_ERROR",
										"message": err.Error(),
									})
									return
								}

								fmt.Printf("[Loomiss] Graph compiled successfully with %d nodes and %d edges\n", len(graph.Nodes), len(graph.Edges))
								hub.Broadcast(map[string]interface{}{
									"type":  "UPDATE_GRAPH",
									"nodes": graph.Nodes,
									"edges": graph.Edges,
								})
							})
						}
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

// CodeChange đại diện cho một tệp bị thay đổi trong workspace
type CodeChange struct {
	Path      string `json:"path"`
	Status    string `json:"status"` // "modified", "added", "deleted"
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
}

// GetGitChanges quét workspace và trả về danh sách các tệp source code bị thay đổi bằng lệnh Git
func GetGitChanges(workspacePath string) []CodeChange {
	cmd := exec.Command("git", "status", "--porcelain")
	cmd.Dir = workspacePath
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil
	}

	var changes []CodeChange
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if len(line) < 4 {
			continue
		}
		status := strings.TrimSpace(line[:2])
		filePath := strings.TrimSpace(line[3:])

		// Chuẩn hóa đường dẫn cho Windows/Unix
		filePath = filepath.ToSlash(filePath)
		lowerPath := strings.ToLower(filePath)

		// Bỏ qua các file build, binary, ẩn hoặc không thuộc source code
		if strings.Contains(lowerPath, "/dist/") || strings.Contains(lowerPath, "node_modules/") ||
			strings.HasSuffix(lowerPath, ".exe") || strings.HasPrefix(filepath.Base(filePath), ".") {
			continue
		}

		statusName := "modified"
		if status == "??" || status == "A" {
			statusName = "added"
		} else if status == "D" {
			statusName = "deleted"
		}

		additions := 0
		deletions := 0

		if statusName == "modified" {
			// Lấy numstat từ git diff
			diffCmd := exec.Command("git", "diff", "--numstat", "--", filePath)
			diffCmd.Dir = workspacePath
			diffOut, diffErr := diffCmd.CombinedOutput()
			if diffErr == nil && len(diffOut) > 0 {
				fields := strings.Fields(string(diffOut))
				if len(fields) >= 2 {
					additions, _ = strconv.Atoi(fields[0])
					deletions, _ = strconv.Atoi(fields[1])
				}
			}
		} else if statusName == "added" {
			// Đọc số dòng của file mới thêm để làm chỉ số additions
			fullPath := filepath.Join(workspacePath, filePath)
			data, readErr := os.ReadFile(fullPath)
			if readErr == nil {
				additions = len(strings.Split(string(data), "\n"))
			}
		}

		changes = append(changes, CodeChange{
			Path:      filePath,
			Status:    statusName,
			Additions: additions,
			Deletions: deletions,
		})
	}
	return changes
}
