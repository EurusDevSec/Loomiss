# Phase 4: Tích Hợp MCP Server & Đa IDE Harness

## 1. Mục tiêu (Goals)
*   Triển khai giao thức Model Context Protocol (MCP) trên Go backend để cấp dữ liệu trực tiếp cho AI Agent.
*   Cài đặt cơ chế IPC (Inter-Process Communication) để đồng bộ hóa thông tin giữa các tiến trình MCP và CLI Daemon chính.
*   Cấu hình kiểm thử hoạt động của MCP trên **Antigravity IDE** và Cursor.
*   Kiểm thử chế độ Fallback phổ quát thông qua File Watcher trên các IDE không hỗ trợ MCP (như VSCode/GitHub Copilot).

---

## 2. Kiến trúc & Stack kỹ thuật (Tech Stack)
*   **MCP Protocol:** Giao thức JSON-RPC qua `stdio` (Standard Input/Output) và `SSE/HTTP`.
*   **IPC Bridge:** HTTP REST API client-server cục bộ.
*   **Target Environments:** Antigravity IDE, Cursor, VSCode/Kiro (chạy GitHub Copilot).

---

## 3. Các bước triển khai chi tiết (Implementation Steps)

### Bước 1: Xây dựng MCP Server trong Go
1. Viết mã xử lý giao thức JSON-RPC trên Go backend:
   * Thiết lập bộ đọc/ghi không chặn (non-blocking) trên `os.Stdin` và `os.Stdout`.
   * **Quy tắc quan trọng:** Tuyệt đối không dùng `fmt.Println` để log debug ra stdout vì nó sẽ phá vỡ giao thức JSON-RPC của MCP client. Mọi thông tin log debug phải được chuyển hướng ghi ra `os.Stderr` hoặc một tệp tin log riêng (`loomiss-mcp.log`).
2. Khai báo các công cụ (Tools) cung cấp qua MCP:
   * `get_architecture_schema`: Trả về dữ liệu Graph Schema (JSON) hiện tại của workspace cho AI Agent.
   * `report_agent_intent`: Nhận tham số `filePath` và `action` (ví dụ: "editing", "creating") để AI Agent báo cáo tệp tin nó đang can thiệp trước khi lưu.

### Bước 2: Thiết lập cơ chế IPC
Vì IDE khởi chạy tiến trình MCP (`loomiss mcp`) độc lập với tiến trình Web UI chính (`loomiss start`), ta đồng bộ qua HTTP:
1. Trong CLI Daemon chính (`loomiss start`), mở thêm một endpoint API cục bộ: `POST http://localhost:18900/api/agent-activity`.
2. Khi AI Agent trong IDE gọi tool `report_agent_intent`, tiến trình MCP con sẽ bắn một request POST chứa thông tin file đang sửa tới API cục bộ trên.
3. Server chính nhận tin nhắn, phát đi thông điệp WebSocket tới trình duyệt để Web UI nhấp nháy sáng hoặc làm nổi bật (glowing) node tương ứng với tệp tin đang được chỉnh sửa.

### Bước 3: Cấu hình và kiểm thử trên Antigravity IDE & Cursor
1. Hướng dẫn cấu hình MCP Server:
   * Mở file cấu hình cài đặt MCP trong **Antigravity IDE** hoặc Cursor (`mcp.json`):
     ```json
     {
       "mcpServers": {
         "loomiss": {
           "command": "C:/path/to/loomiss.exe",
           "args": ["mcp"]
         }
       }
     }
     ```
2. Mở khung chat AI và ra lệnh kiểm thử:
   * *"Hãy sử dụng công cụ của Loomiss để phân tích sơ đồ kiến trúc hiện tại."*
   * Xác thực AI Agent gọi tool thành công và đọc được danh sách service.

### Bước 4: Kiểm thử Fallback phổ quát trên VSCode
1. Mở thư mục dự án bằng VSCode (sử dụng GitHub Copilot tiêu chuẩn).
2. Yêu cầu Copilot viết thêm một service vào tệp `docker-compose.yml` và thực hiện lưu file.
3. *Kỳ vọng:* Mặc dù VSCode + Copilot không có kết nối MCP trực tiếp tới Loomiss, cơ chế File Watcher của daemon chính vẫn phát hiện sự thay đổi và cập nhật sơ đồ tức thì trên trình duyệt.

---

## 4. Kịch bản kiểm thử & Xác thực (Verification Plan)
*   **Chạy Daemon:** `loomiss.exe start` trên cổng 18900.
*   **MCP Check:** Khởi chạy `loomiss.exe mcp` từ console và gửi thủ công gói tin JSON-RPC yêu cầu gọi `get_architecture_schema`. Xác thực dữ liệu trả về đúng định dạng MCP.
*   **IDE Integration:**
    *   Cấu hình thành công trên **Antigravity IDE**.
    *   Hỏi AI: *"Thêm cơ sở dữ liệu Postgres vào backend."*
    *   *Kỳ vọng:* Web UI lập tức hiển thị hiệu ứng nhấp nháy màu tím trên Node App và vẽ một Node Database Postgres mới xuất hiện nhấp nháy trước cả khi tệp tin thực sự được lưu.
