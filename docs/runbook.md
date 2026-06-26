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

Sau khi tích hợp thành công, AI Agent trong IDE của bạn sẽ có quyền truy cập vào các công cụ sau:

### 1. `get_architecture_schema`
*   **Mô tả:** Lấy sơ đồ kiến trúc hiện tại của dự án. Hỗ trợ **Semantic Caching** để lưu đệm kết quả nếu truyền vào tham số `prompt`.
*   **Tham số đầu vào:**
    *   `prompt` (string, không bắt buộc): Mô tả câu lệnh yêu cầu của Agent (ví dụ: `"vẽ sơ đồ docker-compose"`).
*   **Kết quả trả về:** Khung JSON chứa danh sách các `Nodes` và `Edges` được phân tích. Nếu phát hiện câu lệnh tương tự đã chạy trước đó (> 90% tương đồng), hệ thống trả về ngay lập tức từ bộ đệm SQLite (Cache Hit), giúp giảm thiểu thời gian chờ và tiết kiệm LLM token.

### 2. `report_agent_intent`
*   **Mô tả:** AI Agent báo cáo ý định thao tác chỉnh sửa tệp cấu hình trước khi lưu để phát hiệu ứng động (Ripple) nhấp nháy sáng trên node UI tương ứng.
*   **Tham số đầu vào:**
    *   `nodeId` (string, bắt buộc): ID của Node (ví dụ: `database`, `sneakers-backend`).
    *   `action` (string, bắt buộc): Hành động (`editing`, `creating`, `deleting`).

### 3. `add_architectural_memory`
*   **Mô tả:** Lưu quy tắc thiết kế kiến trúc hoặc ghi nhận thực tế của dự án vào bộ nhớ dài hạn SQLite.
*   **Tham số đầu vào:**
    *   `fact` (string, bắt buộc): Nội dung quy tắc cần nhớ (ví dụ: `"Container database MySQL chỉ được chạy trong mạng subnet nội bộ, cấm mở ra public"`).

### 4. `get_architectural_memory`
*   **Mô tả:** Tra cứu các quy tắc thiết kế đã học từ trước dựa trên truy vấn tương đồng ngữ nghĩa vector (threshold > 0.35).
*   **Tham số đầu vào:**
    *   `query` (string, bắt buộc): Câu hỏi tra cứu (ví dụ: `"bảo mật subnet database mysql"`).

---

## 🔬 4. Kiểm Thử Thủ Công & Hướng Dẫn Debug (E2E Testing)

Bạn có thể kiểm tra các tính năng của MCP (bao gồm cả Caching và Memory) trực tiếp từ dòng lệnh bằng cách pipe các khung tin JSON-RPC chuẩn:

### A. Kiểm tra Semantic Caching (Bộ đệm tương đồng):
1. **Lần 1 (Tạo cache / Cache Miss):** Gửi gói tin phân tích sơ đồ kèm prompt:
   ```powershell
   '{"jsonrpc":"2.0","id":100,"method":"tools/call","params":{"name":"get_architecture_schema","arguments":{"prompt":"render docker-compose network diagram"}}}' | ./loomiss.exe mcp
   ```
   *Nhìn vào dòng log stderr sẽ thấy báo:* `Cache Miss. Highest similarity: 0.0000` và `Successfully cached new prompt in DB`.

2. **Lần 2 (Truy vấn trùng / Cache Hit):** Gửi lại đúng gói tin trên hoặc prompt giống hệt:
   ```powershell
   '{"jsonrpc":"2.0","id":101,"method":"tools/call","params":{"name":"get_architecture_schema","arguments":{"prompt":"render docker-compose network diagram"}}}' | ./loomiss.exe mcp
   ```
   *Nhìn vào dòng log stderr sẽ thấy báo:* `Cache Hit! Saved LLM Tokens. Cosine Similarity: 1.0000` và kết quả trả về ngay lập tức (<10ms).

### B. Kiểm tra Bộ nhớ dài hạn (Vector Memory):
1. **Lưu Fact:** Gửi gói tin ghi nhớ thiết kế:
   ```powershell
   '{"jsonrpc":"2.0","id":102,"method":"tools/call","params":{"name":"add_architectural_memory","arguments":{"fact":"Container database MySQL should only run in internal subnet and not open to public"}}}' | ./loomiss.exe mcp
   ```
   *Phản hồi đúng:* `Successfully saved fact to long-term memory...`

2. **Truy vấn Fact bằng câu hỏi tương tự:** Gửi gói tin tra cứu:
   ```powershell
   '{"jsonrpc":"2.0","id":103,"method":"tools/call","params":{"name":"get_architectural_memory","arguments":{"query":"MySQL database subnet security"}}}' | ./loomiss.exe mcp
   ```
   *Phản hồi đúng:* Hệ thống sẽ tự băm vector và tính toán Cosine Similarity để tìm ra quy tắc khớp cao nhất:
   ```
   Found 1 relevant architectural rules:
   1. [Similarity: 0.5345] Container database MySQL should only run in internal subnet and not open to public
   ```

### Debug & Logs:
*   Mọi thông tin hoạt động của MCP và Vector Database được in ra **`stderr`** (cổng báo lỗi tiêu chuẩn).
*   Nếu tích hợp vào IDE bị lỗi, hãy xem log stderr của client IDE để biết nguyên nhân (ví dụ: lỗi kết nối SQLite, lỗi định dạng JSON-RPC).

---

## 🌍 5. Cách Sử Dụng Loomiss Với Các Dự Án Khác

Vì Loomiss được đóng gói dưới dạng **Single Binary (không phụ thuộc CGO hay môi trường ngoài)**, bạn có thể dễ dàng mang file `loomiss.exe` đi giám sát bất kỳ dự án nào khác của mình.

### Bước 1: Cấu hình biến môi trường (PATH) để chạy toàn cầu
Để có thể gọi lệnh `loomiss` từ bất kỳ thư mục dự án nào:
1. Copy file `loomiss.exe` từ thư mục hiện tại vào một thư mục chung trên máy của bạn (ví dụ: `C:/tools/loomiss.exe` hoặc giữ nguyên ở thư mục hiện tại).
2. Tìm kiếm **"Environment Variables"** trên Windows Search $\rightarrow$ Chọn **Edit the system environment variables**.
3. Click vào **Environment Variables...** $\rightarrow$ Ở mục **System variables**, tìm biến `Path` $\rightarrow$ Chọn **Edit**.
4. Click **New** $\rightarrow$ Nhập đường dẫn đến thư mục chứa file `loomiss.exe` (ví dụ: `R:/_Projects/Eurus_Workspace/Loomiss`).
5. Nhấn **OK** để lưu lại. Khởi động lại terminal (PowerShell/CMD).

### Bước 2: Khởi chạy giám sát trên dự án mới
1. Mở PowerShell/Terminal tại thư mục gốc của dự án khác mà bạn muốn giám sát (ví dụ: dự án `MyNewProject` của bạn).
2. Chạy lệnh:
   ```powershell
   loomiss start
   ```
3. Loomiss sẽ tự động:
   - Nhận diện thư mục làm việc hiện tại làm Workspace.
   - Quét tất cả các file cấu hình hạ tầng (Docker, Terraform, Nginx) và tệp ứng dụng (package.json, go.mod, .env) của dự án mới đó.
   - Mở trình duyệt hiển thị sơ đồ kiến trúc phân lớp tự động của dự án đó tại `http://localhost:18900`.
   - Lắng nghe và cập nhật nóng (hot-reload) thời gian thực mỗi khi bạn chỉnh sửa file trong dự án đó.

### Bước 3: Đăng ký MCP Server cho dự án mới trong IDE (Cursor / VSCode)
Nếu bạn mở dự án mới đó bằng Cursor hoặc Antigravity IDE và muốn AI Agent hỗ trợ code hạ tầng tự động cập nhật lên UI:
- Đăng ký MCP server trong cài đặt IDE với đường dẫn tuyệt đối đến tệp thực thi `loomiss.exe`:
  - **Command:** `R:/_Projects/Eurus_Workspace/Loomiss/loomiss.exe` (hoặc đường dẫn mới của bạn)
  - **Args:** `["mcp"]`
- AI Agent sẽ tự động kết nối qua kênh stdio của thư mục dự án mới đang mở, đọc được sơ đồ của dự án đó, và gửi các hiệu ứng nhấp nháy (ripple) lên UI khi chỉnh sửa.

