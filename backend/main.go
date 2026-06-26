package main

import (
	"flag"
	"fmt"
	"loomiss/daemon"
	"os"
)

func main() {
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
	fmt.Println("[Loomiss] MCP Server handler is not implemented in Phase 1.")
	os.Exit(0)
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
