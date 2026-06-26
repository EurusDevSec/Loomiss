package mcp

import (
	"bufio"
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"loomiss/memory"
	"loomiss/usecase"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
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

	// Khởi tạo Database SQLite cục bộ tại workspace root
	err := memory.InitDB(".")
	if err != nil {
		fmt.Fprintf(os.Stderr, "[Loomiss MCP] Error initializing SQLite DB: %v\n", err)
	} else {
		fmt.Fprintln(os.Stderr, "[Loomiss MCP] SQLite Database initialized successfully.")
		defer memory.CloseDB()
	}

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
		res := InitializeResult{
			ProtocolVersion: "2024-11-05",
			Capabilities: ServerCapabilities{
				Tools: make(map[string]interface{}),
			},
			ServerInfo: ServerInfo{
				Name:    "Loomiss MCP Server",
				Version: "1.0.0",
			},
		}
		sendResult(req.ID, res)

	case "notifications/initialized":
		fmt.Fprintln(os.Stderr, "[Loomiss MCP] Received initialized notification.")

	case "tools/list":
		tools := []Tool{
			{
				Name:        "get_architecture_schema",
				Description: "Lấy sơ đồ kiến trúc hiện tại của dự án (Nodes & Edges từ docker-compose, terraform, nginx). Có hỗ trợ Semantic Caching thông qua tham số prompt.",
				InputSchema: InputSchema{
					Type: "object",
					Properties: map[string]Property{
						"prompt": {
							Type:        "string",
							Description: "Mô tả lệnh yêu cầu của Agent để kiểm tra bộ đệm tương đồng (Ví dụ: 'vẽ sơ đồ docker-compose')",
						},
					},
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
			{
				Name:        "add_architectural_memory",
				Description: "Lưu quy tắc thiết kế kiến trúc hoặc ghi nhận thực tế của dự án vào bộ nhớ dài hạn SQLite",
				InputSchema: InputSchema{
					Type: "object",
					Properties: map[string]Property{
						"fact": {
							Type:        "string",
							Description: "Quy tắc/Thông tin kiến trúc cần nhớ (Ví dụ: 'Database MySQL chỉ chạy subnet nội bộ')",
						},
					},
					Required: []string{"fact"},
				},
			},
			{
				Name:        "get_architectural_memory",
				Description: "Tra cứu các quy tắc thiết kế đã học từ trước dựa trên truy vấn tương đồng ngữ nghĩa vector",
				InputSchema: InputSchema{
					Type: "object",
					Properties: map[string]Property{
						"query": {
							Type:        "string",
							Description: "Câu hỏi tra cứu thiết kế (Ví dụ: 'subnet bảo mật database')",
						},
					},
					Required: []string{"query"},
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
		type SchemaArgs struct {
			Prompt string `json:"prompt"`
		}
		var args SchemaArgs
		json.Unmarshal(params.Arguments, &args)

		prompt := strings.TrimSpace(args.Prompt)

		// Kiểm tra Semantic Cache nếu có truyền Prompt
		if prompt != "" {
			fmt.Fprintf(os.Stderr, "[Loomiss MCP] Checking semantic cache for prompt: '%s'\n", prompt)
			
			// Tính vector embedding của prompt mới
			promptEmbed, err := memory.GetEmbedding(prompt)
			if err == nil && len(promptEmbed) > 0 {
				// Tải tất cả các cache từ DB
				caches, dbErr := memory.LoadAllPromptCache()
				if dbErr == nil {
					var bestMatch *memory.PromptCacheEntry
					var maxSimilarity float32 = 0.0

					for i := range caches {
						sim := memory.CosineSimilarity(promptEmbed, caches[i].Embedding)
						if sim > maxSimilarity {
							maxSimilarity = sim
							bestMatch = &caches[i]
						}
					}

					// Ngưỡng khớp ngữ nghĩa > 0.90
					if maxSimilarity > 0.90 && bestMatch != nil {
						fmt.Fprintf(os.Stderr, "[Loomiss MCP] Cache Hit! Saved LLM Tokens. Cosine Similarity: %.4f (Match prompt: '%s')\n", maxSimilarity, bestMatch.Prompt)
						
						// Trả về kết quả đã cache ngay lập tức
						sendResult(id, ToolCallResult{
							Content: []TextContent{
								{
									Type: "text",
									Text: bestMatch.Response,
								},
							},
						})
						return
					}
					fmt.Fprintf(os.Stderr, "[Loomiss MCP] Cache Miss. Highest similarity: %.4f\n", maxSimilarity)
				} else {
					fmt.Fprintf(os.Stderr, "[Loomiss MCP] Error loading prompt cache from DB: %v\n", dbErr)
				}
			} else {
				fmt.Fprintf(os.Stderr, "[Loomiss MCP] Error calculating prompt embedding: %v\n", err)
			}
		}

		// Cache Miss hoặc không có Prompt -> Quét và phân tích tĩnh thực tế
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

		graphStr := string(graphBytes)

		// Lưu vào cache nếu có Prompt
		if prompt != "" {
			promptEmbed, err := memory.GetEmbedding(prompt)
			if err == nil && len(promptEmbed) > 0 {
				cacheId := getMD5Hash(prompt)
				cacheErr := memory.SavePromptCache(cacheId, prompt, promptEmbed, graphStr)
				if cacheErr != nil {
					fmt.Fprintf(os.Stderr, "[Loomiss MCP] Error writing cache to DB: %v\n", cacheErr)
				} else {
					fmt.Fprintln(os.Stderr, "[Loomiss MCP] Successfully cached new prompt in DB.")
				}
			}
		}

		sendResult(id, ToolCallResult{
			Content: []TextContent{
				{
					Type: "text",
					Text: graphStr,
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

		ipcErr := sendIpcIntent(args.NodeID, args.Action)
		if ipcErr != nil {
			fmt.Fprintf(os.Stderr, "[Loomiss MCP] IPC Error: %v\n", ipcErr)
		}

		sendResult(id, ToolCallResult{
			Content: []TextContent{
				{
					Type: "text",
					Text: fmt.Sprintf("Intent reported successfully for Node ID: %s", args.NodeID),
				},
			},
		})

	case "add_architectural_memory":
		type AddMemoryArgs struct {
			Fact string `json:"fact"`
		}
		var args AddMemoryArgs
		err := json.Unmarshal(params.Arguments, &args)
		if err != nil {
			sendError(id, -32602, "Invalid arguments: "+err.Error())
			return
		}

		fact := strings.TrimSpace(args.Fact)
		if fact == "" {
			sendError(id, -32602, "Fact content cannot be empty")
			return
		}

		// Vector hóa fact
		embed, err := memory.GetEmbedding(fact)
		if err != nil {
			sendError(id, -32000, "Failed to vectorize fact: "+err.Error())
			return
		}

		factId := getMD5Hash(fact)
		err = memory.SaveMemory(factId, fact, embed)
		if err != nil {
			sendError(id, -32000, "Failed to save memory to SQLite: "+err.Error())
			return
		}

		fmt.Fprintf(os.Stderr, "[Loomiss MCP] Successfully saved fact memory: '%s'\n", fact)
		sendResult(id, ToolCallResult{
			Content: []TextContent{
				{
					Type: "text",
					Text: fmt.Sprintf("Successfully saved fact to long-term memory: '%s'", fact),
				},
			},
		})

	case "get_architectural_memory":
		type GetMemoryArgs struct {
			Query string `json:"query"`
		}
		var args GetMemoryArgs
		err := json.Unmarshal(params.Arguments, &args)
		if err != nil {
			sendError(id, -32602, "Invalid arguments: "+err.Error())
			return
		}

		query := strings.TrimSpace(args.Query)
		if query == "" {
			sendError(id, -32602, "Query content cannot be empty")
			return
		}

		// Vector hóa query
		queryEmbed, err := memory.GetEmbedding(query)
		if err != nil {
			sendError(id, -32000, "Failed to vectorize query: "+err.Error())
			return
		}

		// Tải toàn bộ memories từ DB
		memories, err := memory.LoadAllMemories()
		if err != nil {
			sendError(id, -32000, "Failed to load memories from SQLite: "+err.Error())
			return
		}

		type ScoredMemory struct {
			Fact       string
			Similarity float32
			CreatedAt  time.Time
		}

		var scored []ScoredMemory
		for i := range memories {
			sim := memory.CosineSimilarity(queryEmbed, memories[i].Embedding)
			// Trả về kết quả khớp tương đối tốt (> 0.35)
			if sim > 0.35 {
				scored = append(scored, ScoredMemory{
					Fact:       memories[i].Fact,
					Similarity: sim,
					CreatedAt:  memories[i].CreatedAt,
				})
			}
		}

		// Sắp xếp giảm dần theo độ tương đồng
		sort.Slice(scored, func(i, j int) bool {
			return scored[i].Similarity > scored[j].Similarity
		})

		var resultStr string
		if len(scored) == 0 {
			resultStr = "No relevant design rules found in long-term memory."
		} else {
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("Found %d relevant architectural rules:\n", len(scored)))
			for idx, sc := range scored {
				sb.WriteString(fmt.Sprintf("%d. [Similarity: %.4f] %s\n", idx+1, sc.Similarity, sc.Fact))
			}
			resultStr = sb.String()
		}

		sendResult(id, ToolCallResult{
			Content: []TextContent{
				{
					Type: "text",
					Text: resultStr,
				},
			},
		})

	default:
		sendError(id, -32601, "Tool not found: "+params.Name)
	}
}

func sendIpcIntent(nodeId, action string) error {
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

func getMD5Hash(text string) string {
	hash := md5.Sum([]byte(text))
	return hex.EncodeToString(hash[:])
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

	os.Stdout.Write(data)
	os.Stdout.Write([]byte("\n"))
	fmt.Fprintf(os.Stderr, "[Loomiss MCP] Sent response: %s\n", string(data))
}
