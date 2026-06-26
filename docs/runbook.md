# Hướng Dẫn Sử Dụng & Vận Hành Loomiss (Runbook)

Tài liệu này hướng dẫn chi tiết cách chạy, cấu hình và vận hành Loomiss Daemon cùng với tính năng MCP (Model Context Protocol) Server tích hợp trong các IDE hỗ trợ AI (như Antigravity IDE và Cursor).

---

## 🚀 1. Khởi Chạy Web Visualizer Daemon

Tiến trình CLI chính (`loomiss start`) chịu trách nhiệm quét thư mục làm việc, phát hiện thay đổi của các file cấu hình và cập nhật giao diện đồ thị thời gian thực qua WebSocket.

### Cách chạy:
Chạy tệp thực thi ngay tại thư mục dự án của bạn:
```powershell
./loomiss.exe start
```
*Mặc định, daemon sẽ lắng nghe trên cổng `18900` và tự động mở trình duyệt web hiển thị giao diện tại địa chỉ: `http://localhost:18900`.*

### Cấu hình cổng tùy chỉnh:
Bạn có thể đổi cổng chạy server thông qua tham số `-port`:
```powershell
./loomiss.exe start -port 9000
```

---

## 🤖 2. Cấu Hình Tích Hợp MCP Server Trên Các IDE

Khi bạn sử dụng các IDE hỗ trợ AI như **Antigravity IDE** hoặc **Cursor**, bạn có thể đăng ký Loomiss như một MCP Server để AI Agent gọi các công cụ tương tác trực tiếp với Loomiss.

### File cấu hình MCP (`mcp.json`)
Mở file cấu hình MCP của IDE của bạn (thường nằm ở `C:/Users/<Username>/.codeium/mcp.json` hoặc trong menu Cài đặt MCP của Cursor) và thêm định nghĩa server sau:

```json
{
  "mcpServers": {
    "loomiss": {
      "command": "R:/_Projects/Eurus_Workspace/Loomiss/loomiss.exe",
      "args": ["mcp"]
    }
  }
}
```

*Lưu ý: Thay đổi đường dẫn tuyệt đối ở trường `"command"` cho chính xác với vị trí file `loomiss.exe` trên hệ thống của bạn.*

---

## 🛠️ 3. Các Công Cụ (Tools) Cung Cấp Qua MCP

Sau khi tích hợp thành công, AI Agent trong IDE của bạn sẽ có quyền truy cập vào 2 công cụ sau:

### 1. `get_architecture_schema`
*   **Mô tả:** Lấy sơ đồ kiến trúc hiện tại của dự án.
*   **Tham số đầu vào:** Không có (`{}`).
*   **Kết quả trả về:** Khung JSON chứa danh sách các `Nodes` (services, resources) và `Edges` (liên kết, dependency) được phân tích từ các tệp `docker-compose.yml`, `nginx.conf`, và `*.tf`.

### 2. `report_agent_intent`
*   **Mô tả:** AI Agent báo cáo ý định thao tác chỉnh sửa tệp tin cấu hình liên quan đến một Node trước khi ghi file, nhằm nhấp nháy sáng giao diện UI.
*   **Tham số đầu vào:**
    *   `nodeId` (string, bắt buộc): ID của Node đang tác động (ví dụ: `database`, `sneakers-backend`).
    *   `action` (string, bắt buộc): Hành động đang thực hiện (`editing`, `creating`, `deleting`).
*   **Kết quả trả về:** Thông báo phản hồi thành công và nháy sáng xanh lá neon kèm hiệu ứng vòng tròn lan toả (ripple) trên Web UI.

---

## 🔬 4. Kiểm Thử Thủ Công & Hướng Dẫn Debug

Trong trường hợp kết nối MCP gặp vấn đề hoặc bạn muốn kiểm thử thủ công qua CLI:

### Kiểm tra giao thức JSON-RPC qua PowerShell:
Vì MCP giao tiếp thông qua giao thức JSON-RPC qua `stdio` (Standard Input/Output) trên cùng một dòng, bạn có thể kiểm tra trực tiếp bằng cách pipe gói tin JSON-RPC vào lệnh:

#### A. Gửi gói tin khởi tạo (`initialize`):
```powershell
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test"},"capabilities":{}}}' | ./loomiss.exe mcp
```
*Phản hồi đúng:* Trả về JSON chứa thông tin `Loomiss MCP Server`.

#### B. Xem danh sách công cụ (`tools/list`):
```powershell
'{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | ./loomiss.exe mcp
```
*Phản hồi đúng:* Trả về JSON định nghĩa cấu trúc 2 tools `get_architecture_schema` và `report_agent_intent`.

#### C. Gọi hiệu ứng Ripple sáng Node từ xa (`report_agent_intent`):
Đảm bảo bạn đang mở Web UI (`http://localhost:18900`) và chạy lệnh sau:
```powershell
'{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"report_agent_intent","arguments":{"nodeId":"database","action":"editing"}}}' | ./loomiss.exe mcp
```
*Kỳ vọng:* Web UI lập tức hiển thị hiệu ứng vòng tròn xanh lá lan toả (ripple) xung quanh node database trong 4 giây.

### Xem log debug của MCP:
Để không làm hỏng cấu trúc khung tin JSON-RPC trên kênh `stdout`, tất cả các log hoạt động debug của MCP được ghi nhận vào dòng lỗi tiêu chuẩn **`stderr`**. 
Nếu tích hợp trong IDE báo lỗi không kết nối được, hãy kiểm tra bảng console output hoặc log stderr của IDE để xem chi tiết lỗi phát ra từ Loomiss MCP.
