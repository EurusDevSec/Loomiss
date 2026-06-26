# 💾 SESSION MEMORY — Loomiss Project
> Last Checkpoint: 2026-06-26 | Status: **PHASE 3 (REALTIME ENGINE & ANIMATION) — 100% COMPLETE & VERIFIED**

---

## ⚡ Active Tasks Completed (Những việc ĐÃ HOÀN THÀNH trong session)

### ⚙️ Triển khai các Parsers hạ tầng thuần Go (Phase 2)
*   **Docker-compose YAML Parser ([`compose.go`](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/parsers/compose.go)):** Trích xuất dịch vụ, ports và dependency container.
*   **Terraform HCL Parser ([`terraform.go`](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/parsers/terraform.go)):** Phân tích tệp `.tf`, tự động trích xuất các cloud resources và Edges liên kết dựa trên các biểu thức tham chiếu biến (`traversal`).
*   **Nginx Parser ([`nginx.go`](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/parsers/nginx.go)):** Parse cổng listen và proxy_pass bằng regex thuần Go.
*   **Graph Compiler ([`compiler.go`](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/usecase/compiler.go)):** Duyệt đệ quy thư mục dự án và gộp thông tin từ các tệp cấu hình khác nhau thành sơ đồ Graph Schema hợp nhất.
*   **Unit Tests ([`parser_test.go`](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/parsers/parser_test.go)):** Unit tests hoàn chỉnh cho cả 3 parser chạy độc lập, đạt tỉ lệ pass 100%.

### 📡 WebSocket Hub & File Watcher (Phase 3)
*   **WebSocket Hub ([`hub.go`](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/daemon/hub.go)):** Quản lý đăng ký kết nối của các client Web UI mở trên trình duyệt và broadcast gói tin JSON.
*   **File Watcher & Debouncing ([`watcher.go`](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/daemon/watcher.go)):** Giám sát các sự kiện ghi, tạo hoặc xóa file cấu hình (`.yml`, `.yaml`, `.tf`, `.conf`) trong thư mục hiện tại. Áp dụng debounce **1500ms** bằng Go channel/timer để tối ưu hóa tài nguyên.
*   **Cơ chế chịu lỗi LKG (Last Known Good):** Khi file gặp lỗi cú pháp dở dang, hệ thống giữ lại Graph tốt gần nhất, đồng thời gửi thông tin `PARSE_ERROR` để báo hiệu banner lỗi đỏ lên UI.
*   **Cấu hình Server ([`server.go`](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/daemon/server.go)):** Cập nhật hàm `StartServer` để khởi chạy đồng thời File Watcher và nâng cấp kết nối HTTP thành kết nối WebSocket.

---

## 🧠 Semantic Context Essence (Tinh túy kiến thức & Quyết định thiết kế)

*   **Không sử dụng CGO**: Mọi thư viện parser (YAML, HCL) và database (SQLite) được sử dụng đều là thuần Go (Zero CGO), đảm bảo biên dịch chéo nhanh chóng.
*   **Dagre Auto-Layout**: Đồ thị tự động căn chỉnh tọa độ node dựa trên thuật toán Dagre tại Frontend trước khi render, giúp các node hiển thị cân đối.
*   **Cơ chế LKG**: Giúp giữ giao diện ổn định, không bị chớp tắt hoặc xóa sơ đồ khi dev đang gõ phím dở cấu hình.
*   **Debounce 1.5s**: Tránh việc gọi parser dồn dập khi gõ phím, giảm thiểu tải CPU tối đa.

---

## 🔜 Next Steps (3 hành động kỹ thuật trực tiếp kế tiếp)

- [ ] **Step 1 (Phase 4):** Triển khai tiến trình MCP Server trong `backend/mcp/server.go` hỗ trợ giao thức JSON-RPC qua `stdio` (hoặc SSE).
- [ ] **Step 2 (Phase 4):** Thiết lập API nội bộ `POST /api/agent-activity` cục bộ để đồng bộ tiến trình MCP con (Cursor/Antigravity) với CLI Daemon chính.
- [ ] **Step 3 (Phase 4):** Cấu hình MCP Server trong file cài đặt của **Antigravity IDE** và Cursor, kiểm thử khả năng phản hồi trực quan sơ đồ thời gian thực.
