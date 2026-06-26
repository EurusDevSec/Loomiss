# Loomiss Pragmatic Clean Architecture

Tài liệu này định nghĩa cấu trúc thiết kế **Kiến trúc Sạch Thực tế (Pragmatic Clean Architecture)** cho dự án Loomiss. Khác với mô hình Clean Architecture học thuật (thường gây phình mã nguồn và có quá nhiều lớp trung gian), phiên bản thực tế này tập trung vào tính ngắn gọn, giảm mã lặp (boilerplate), đẩy nhanh tốc độ code lúc đầu nhưng vẫn giữ lại khả năng thay thế linh hoạt (cơ sở dữ liệu và AI model) và dễ viết Unit Test.

---

## 1. Bản đồ Kiến trúc Đơn giản hóa (Flatter Architectural Map)

Chúng ta tổ chức mã nguồn Go theo một cấu trúc phẳng hơn, phân chia rạch ròi theo chức năng thay vì chia thành quá nhiều tầng lồng nhau sâu:

```
backend/
├── domain/                      # TẦNG LÕI (Domain Entities & Interfaces)
│   ├── models.go                # Định nghĩa Node, Edge, Graph, MemoryFact, PromptCache
│   └── interfaces.go            # Chỉ khai báo các interfaces có nguy cơ thay đổi cao
│
├── parsers/                     # TẦNG PHÂN TÍCH (Docker-compose, Terraform, Nginx)
│   ├── compose.go
│   ├── terraform.go
│   └── nginx.go
│
├── db/                          # TẦNG LƯU TRỮ (SQLite CGO-free)
│   └── sqlite.go                # Hiện thực hóa các Database Interfaces
│
├── mcp/                         # TẦNG MCP (Model Context Protocol JSON-RPC)
│   └── server.go                # Các tools và giao tiếp stdio/SSE
│
├── daemon/                      # TẦNG ĐIỀU PHỐI (HTTP, WebSockets, File Watcher, IPC)
│   ├── server.go                # HTTP & WebSockets
│   ├── watcher.go               # fsnotify file watcher & Debounce
│   └── router.go                # Các router cục bộ (IPC API)
│
└── main.go                      # ĐIỂM KHỞI CHẠY (Wired & Dependency Injection)
```

---

## 2. 4 Nguyên tắc "Thực tế" (Pragmatic Core Principles)

### 📌 Nguyên tắc 1: Thiết lập Interface có chọn lọc (Selective Interfaces)
Chúng ta **chỉ** định nghĩa Interface cho các thành phần thực sự có khả năng thay đổi hoặc cần giả lập (mock) để viết Unit Test. Không tạo interface cho những thứ cố định:
*   **Có tạo Interface (trong `domain/interfaces.go`):**
    *   `EmbeddingClient`: Để sau này dễ dàng đổi từ **Gemini Embedding API** sang model **ONNX chạy offline** trên máy.
    *   `MemoryRepository`: Để đổi từ **SQLite local** sang lưu trữ **Cloud** hoặc file JSON phẳng.
    *   `CacheRepository`: Để đổi cache lưu trữ SQLite sang Redis hoặc In-memory cache.
*   **Không tạo Interface (Viết trực tiếp struct):**
    *   Các Parser (`ComposeParser`, `TerraformParser`...): Vì cấu pháp file config đã chuẩn hóa bởi các thư viện Go ngoài, không cần thiết lập trừu tượng.
    *   `FileWatcher`, `WebSocketServer`: Viết dạng module tiện ích dùng trực tiếp.

### 📌 Nguyên tắc 2: Cho phép Parser trả về thẳng Domain Entity
Để tránh việc tạo DTO (Data Transfer Object) trung gian rồi viết code mapping dữ liệu tốn token và thời gian:
*   Các Parser trong thư mục `parsers/` được phép khởi tạo trực tiếp và trả về các đối tượng thuộc package `domain` (ví dụ: `domain.Node`, `domain.Edge`).
*   Tầng điều phối `daemon` sẽ gọi thẳng các Parser này để lấy danh sách Node/Edge và tổng hợp lại.

### 📌 Nguyên tắc 3: Dependency Injection tập trung tại `main.go`
Mọi việc khởi tạo kết nối (SQLite DB, HTTP Server) và luồng phụ thuộc đều được thực hiện tập trung duy nhất tại `main.go`. Các package con không được tự ý import chéo hoặc tự khởi tạo database:
```go
// main.go (Wired dependencies)
func main() {
    // 1. Khởi tạo Database
    database, _ := db.NewSQLite("memory.db")
    
    // 2. Khởi tạo AI Client
    aiClient := external.NewGeminiClient(apiKey)
    
    // 3. Tiêm dependencies vào MCP Server
    mcpServer := mcp.NewServer(database, aiClient)
    
    // 4. Khởi chạy HTTP Daemon
    go daemon.StartServer(database)
    
    // 5. Chạy MCP
    mcpServer.Start()
}
```

### 📌 Nguyên tắc 4: Tách biệt logic đồ họa và luồng dữ liệu trên Frontend
Ở phía React UI:
*   Không viết logic kết nối WebSocket hoặc tính toán Dagre trực tiếp bên trong component render.
*   Sử dụng Custom Hooks hoặc Zustand Store (ví dụ: `useGraphStore.ts`) để lưu trữ danh sách Nodes, Edges, và xử lý gói tin WebSocket.
*   Các custom component như `NginxNode` chỉ nhận props tĩnh và render ra giao diện SVG/Tailwind.

---

## 3. Lợi ích đạt được

*   **Tốc độ code tối đa:** Tránh việc tạo quá nhiều tầng trung gian, cấu trúc package phẳng giúp import cực kỳ đơn giản và dễ hiểu.
*   **Token tối ưu:** Loại bỏ hầu hết code boilerplate lặp đi lặp lại giúp dung lượng file nhỏ gọn hơn, tiết kiệm context token khi AI Agent làm việc.
*   **An toàn kiến trúc:** Vẫn giữ lại khả năng thay thế database và AI engine cũng như viết Mock Test hoàn chỉnh cho các thành phần quan trọng.
