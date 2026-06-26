package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// Upgrader để chuyển đổi HTTP Connection thành WebSocket Connection
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Cho phép kết nối cục bộ
	},
}

// Hub quản lý danh sách các clients WebSocket đang kết nối
type Hub struct {
	clients   map[*websocket.Conn]bool
	clientsMu sync.Mutex
}

// NewHub tạo một Hub mới
func NewHub() *Hub {
	return &Hub{
		clients: make(map[*websocket.Conn]bool),
	}
}

// Register đăng ký client mới
func (h *Hub) Register(conn *websocket.Conn) {
	h.clientsMu.Lock()
	defer h.clientsMu.Unlock()
	h.clients[conn] = true
}

// Unregister gỡ bỏ client
func (h *Hub) Unregister(conn *websocket.Conn) {
	h.clientsMu.Lock()
	defer h.clientsMu.Unlock()
	if _, ok := h.clients[conn]; ok {
		delete(h.clients, conn)
		conn.Close()
	}
}

// Broadcast gửi tin nhắn (JSON struct) tới tất cả các client đang kết nối
func (h *Hub) Broadcast(message interface{}) {
	h.clientsMu.Lock()
	defer h.clientsMu.Unlock()

	data, err := json.Marshal(message)
	if err != nil {
		fmt.Printf("[Loomiss] Error marshaling JSON broadcast: %v\n", err)
		return
	}

	for client := range h.clients {
		err := client.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			fmt.Printf("[Loomiss] Error writing to WebSocket client: %v\n", err)
			client.Close()
			delete(h.clients, client)
		}
	}
}
