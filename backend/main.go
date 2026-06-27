package main

import (
	"flag"
	"fmt"
	"loomiss/daemon"
	"loomiss/mcp"
	"os"
	"strings"
)

func main() {
	// Tự động chuyển thư mục làm việc lên thư mục cha nếu đang chạy trong thư mục backend
	cwd, err := os.Getwd()
	if err == nil {
		if strings.HasSuffix(cwd, "backend") || strings.HasSuffix(cwd, "backend\\") || strings.HasSuffix(cwd, "backend/") {
			if _, err := os.Stat("../docker-compose.yml"); err == nil {
				fmt.Println("[Loomiss] Phát hiện đang chạy từ thư mục backend. Tự động chuyển thư mục làm việc lên thư mục cha...")
				_ = os.Chdir("..")
			}
		}
	}

	// Khai báo các flags
	portFlag := flag.Int("port", 18900, "Port to run the Loomiss Web Server")
	flag.Parse()

	args := flag.Args()

	// Routing lệnh CLI
	if len(args) > 0 {
		switch args[0] {
		case "start":
			runDaemon(*portFlag)
		case "mcp":
			runMcp()
		case "help":
			printHelp()
		default:
			fmt.Printf("[Loomiss] Unknown command: %s\n", args[0])
			printHelp()
			os.Exit(1)
		}
		return
	}

	// Chạy chế độ daemon mặc định nếu không truyền tham số
	runDaemon(*portFlag)
}

func runDaemon(port int) {
	fmt.Printf("[Loomiss] Initializing Daemon on port %d...\n", port)
	err := daemon.StartServer(port)
	if err != nil {
		fmt.Printf("[Loomiss] Error starting server: %v\n", err)
		os.Exit(1)
	}
}

func runMcp() {
	mcp.StartMcpServer()
}

func printHelp() {
	fmt.Println("Loomiss - Standalone Dynamic Architecture Visualizer")
	fmt.Println("\nUsage:")
	fmt.Println("  loomiss [command] [options]")
	fmt.Println("\nCommands:")
	fmt.Println("  start     Start the visualizer daemon and open the Web UI (Default)")
	fmt.Println("  mcp       Start the MCP server for AI Agents")
	fmt.Println("  help      Show this help message")
	fmt.Println("\nOptions:")
	fmt.Println("  -port     Port to listen on (Default: 18900)")
}
