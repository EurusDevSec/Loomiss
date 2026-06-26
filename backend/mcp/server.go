package mcp

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"loomiss/usecase"
	"net/http"
	"os"
	"strings"
)

// MCP Server structures
type JsonRpcRequest struct {
	JsonRpc string           `json:"jsonrpc"`
	ID      *json.RawMessage `json:"id,omitempty"`
	Method  string           `json:"method"`
	Params  json.RawMessage  `json:"params,omitempty"`
}

type JsonRpcResponse struct {
	JsonRpc string           `json:"jsonrpc"`
	ID      *json.RawMessage `json:"id,omitempty"`
	Result  interface{}      `json:"result,omitempty"`
	Error   *JsonRpcError    `json:"error,omitempty"`
}

type JsonRpcError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type InitializeParams struct {
	ProtocolVersion string `json:"protocolVersion"`
}

type InitializeResult struct {
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    ServerCapabilities `json:"capabilities"`
	ServerInfo      ServerInfo         `json:"serverInfo"`
}

type ServerCapabilities struct {
	Tools map[string]interface{} `json:"tools"`
}

type ServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type Tool struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema InputSchema `json:"inputSchema"`
}

type InputSchema struct {
	Type       string                 `json:"type"`
	Properties map[string]Property    `json:"properties,omitempty"`
	Required   []string               `json:"required,omitempty"`
}

type Property struct {
	Type        string `json:"type"`
	Description string `json:"description"`
}

type ToolsListResult struct {
	Tools []Tool `json:"tools"`
}

type ToolCallParams struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

type TextContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type ToolCallResult struct {
	Content []TextContent `json:"content"`
}

// StartMcpServer khởi chạy MCP Server lắng nghe qua stdio
func StartMcpServer() {
	fmt.Fprintln(os.Stderr, "[Loomiss MCP] Starting MCP Server...")

	reader := bufio.NewReader(os.Stdin)

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				fmt.Fprintln(os.Stderr, "[Loomiss MCP] Stdin EOF reached, stopping.")
				break
			}
			fmt.Fprintf(os.Stderr, "[Loomiss MCP] Error reading stdin: %v\n", err)
			break
		}

		line = strings.TrimSpace(line)
		if len(line) == 0 {
			continue
		}

		fmt.Fprintf(os.Stderr, "[Loomiss MCP] Received request: %s\n", line)

		var req JsonRpcRequest
		err = json.Unmarshal([]byte(line), &req)
		if err != nil {
			sendError(nil, -32700, "Parse error: "+err.Error())
			continue
		}

		handleRequest(&req)
	}
}

func handleRequest(req *JsonRpcRequest) {
	switch req.Method {
	case "initialize":
		// Trả về thông tin server và capabilities
		res := InitializeResult{
			ProtocolVersion: "2024-11-05",
			Capabilities: ServerCapabilities{
				Tools: make(map[string]interface{}), // Báo cho client là server có hỗ trợ tools
			},
			ServerInfo: ServerInfo{
				Name:    "Loomiss MCP Server",
				Version: "1.0.0",
			},
		}
		sendResult(req.ID, res)

	case "notifications/initialized":
		// Chỉ là notification, không cần phản hồi
		fmt.Fprintln(os.Stderr, "[Loomiss MCP] Received initialized notification.")

	case "tools/list":
		// Trả về danh sách tools
		tools := []Tool{
			{
				Name:        "get_architecture_schema",
				Description: "Lấy sơ đồ kiến trúc hiện tại của dự án (Nodes & Edges từ docker-compose, terraform, nginx)",
				InputSchema: InputSchema{
					Type: "object",
				},
			},
			{
				Name:        "report_agent_intent",
				Description: "AI Agent báo cáo ý định thao tác chỉnh sửa tệp tin cấu hình liên quan đến một Node",
				InputSchema: InputSchema{
					Type: "object",
					Properties: map[string]Property{
						"nodeId": {
							Type:        "string",
							Description: "ID của Node (ví dụ: sneakers-backend, database, redis-cache-service)",
						},
						"action": {
							Type:        "string",
							Description: "Hành động đang thực hiện (ví dụ: editing, creating, deleting)",
						},
					},
					Required: []string{"nodeId", "action"},
				},
			},
		}
		sendResult(req.ID, ToolsListResult{Tools: tools})

	case "tools/call":
		var params ToolCallParams
		err := json.Unmarshal(req.Params, &params)
		if err != nil {
			sendError(req.ID, -32602, "Invalid params: "+err.Error())
			return
		}

		handleToolCall(req.ID, params)

	case "ping":
		sendResult(req.ID, map[string]string{})

	default:
		sendError(req.ID, -32601, fmt.Sprintf("Method not found: %s", req.Method))
	}
}

func handleToolCall(id *json.RawMessage, params ToolCallParams) {
	switch params.Name {
	case "get_architecture_schema":
		// Biên dịch đồ thị hiện tại từ thư mục làm việc
		graph, err := usecase.CompileGraph(".")
		if err != nil {
			sendError(id, -32000, "Failed to compile architecture: "+err.Error())
			return
		}

		graphBytes, err := json.Marshal(graph)
		if err != nil {
			sendError(id, -32000, "Failed to serialize schema: "+err.Error())
			return
		}

		sendResult(id, ToolCallResult{
			Content: []TextContent{
				{
					Type: "text",
					Text: string(graphBytes),
				},
			},
		})

	case "report_agent_intent":
		type ReportArgs struct {
			NodeID string `json:"nodeId"`
			Action string `json:"action"`
		}

		var args ReportArgs
		err := json.Unmarshal(params.Arguments, &args)
		if err != nil {
			sendError(id, -32602, "Invalid arguments: "+err.Error())
			return
		}

		// Gọi IPC Bridge đến daemon HTTP Server cục bộ
		ipcErr := sendIpcIntent(args.NodeID, args.Action)
		if ipcErr != nil {
			fmt.Fprintf(os.Stderr, "[Loomiss MCP] IPC Error: %v (daemon might not be running)\n", ipcErr)
		}

		sendResult(id, ToolCallResult{
			Content: []TextContent{
				{
					Type: "text",
					Text: fmt.Sprintf("Intent reported successfully for Node ID: %s", args.NodeID),
				},
			},
		})

	default:
		sendError(id, -32601, "Tool not found: "+params.Name)
	}
}

func sendIpcIntent(nodeId, action string) error {
	// Gửi request POST tới local server daemon chính
	url := "http://localhost:18900/api/agent-activity"
	payload := map[string]string{
		"nodeId": nodeId,
		"action": action,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status code: %d", resp.StatusCode)
	}

	return nil
}

func sendResult(id *json.RawMessage, result interface{}) {
	resp := JsonRpcResponse{
		JsonRpc: "2.0",
		ID:      id,
		Result:  result,
	}
	sendResponse(resp)
}

func sendError(id *json.RawMessage, code int, message string) {
	resp := JsonRpcResponse{
		JsonRpc: "2.0",
		ID:      id,
		Error: &JsonRpcError{
			Code:    code,
			Message: message,
		},
	}
	sendResponse(resp)
}

func sendResponse(resp JsonRpcResponse) {
	data, err := json.Marshal(resp)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[Loomiss MCP] Failed to marshal JSON-RPC response: %v\n", err)
		return
	}

	// Đảm bảo ghi ra stdout và kết thúc bằng kí tự xuống dòng
	os.Stdout.Write(data)
	os.Stdout.Write([]byte("\n"))
	fmt.Fprintf(os.Stderr, "[Loomiss MCP] Sent response: %s\n", string(data))
}
