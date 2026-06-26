package domain

// Node đại diện cho một nút trong sơ đồ kiến trúc (e.g. Nginx, Web, DB)
type Node struct {
	ID       string            `json:"id"`
	Label    string            `json:"label"`
	Type     string            `json:"type"`     // gateway, app, database, network, group
	Status   string            `json:"status"`   // active, error
	Metadata map[string]string `json:"metadata"` // ports, environment variables, image
	ParentID string            `json:"parentId,omitempty"`
}

// Edge đại diện cho liên kết mạng giữa các node
type Edge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label"` // Cổng kết nối (e.g. "80 -> 8080")
}

// GraphSchema là cấu trúc dữ liệu đồ thị chung gửi qua WebSocket
type GraphSchema struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}
