---
name: workflow_efficiency
description: Quy tắc tối ưu hóa tốc độ làm việc, tiết kiệm token và tránh lặp lại lỗi cho dự án Go & React Flow.
---

# Cẩm Nang Rút Kinh Nghiệm & Tối Ưu Hóa Quy Trình (Go & React)

Tài liệu này ghi lại các bài học kinh nghiệm và quy tắc làm việc tối ưu nhằm tránh lặp lại lỗi, giảm thời gian xử lý và tiết kiệm token tối đa cho dự án Loomiss.

---

## 1. Tối ưu hóa Token qua việc đọc/tìm kiếm thông tin (Context Budget)
*   **Bài học:** Đọc toàn bộ thư mục lớn hoặc gọi quá nhiều tool nhỏ nhặt (như đọc file, grep search liên tục) gây lãng phí ngân sách Token của phiên chat.
*   **Quy tắc:**
    *   Sử dụng `list_dir` có mục tiêu trước khi đi sâu vào đọc code.
    *   Hạn chế chèn toàn bộ nội dung file lớn vào chat nếu chỉ cần chỉnh sửa một đoạn nhỏ. Sử dụng `view_file` với tham số `StartLine` và `EndLine`.
    *   Gộp các chỉnh sửa không liên tiếp trong cùng một file vào một cuộc gọi `multi_replace_file_content` duy nhất thay vì gọi `replace_file_content` nhiều lần liên tục.

## 2. Quy tắc phát triển và Kiểm thử thời gian thực (Real-time Dev Rules)
*   **File Watcher Debouncing**: Tránh lặp lại việc gọi parser khi lập trình viên gõ phím. Trong Go, sử dụng channel kết hợp timer để debounce sự kiện ghi file ít nhất `1500ms`.
*   **WebSocket Protocol**:
    *   Luôn gửi một gói tin "Ping" định kỳ từ Client (React) lên Server (Go) để duy trì kết nối WebSocket không bị ngắt tự động bởi trình duyệt hoặc OS.
    *   Cấu trúc payload WebSocket phải có trường `type` (ví dụ: `UPDATE_GRAPH`, `AGENT_STATUS`, `ERROR_STATE`) để Frontend phân luồng xử lý chính xác.
*   **LKG (Last Known Good) State**:
    *   Khi có lỗi cú pháp YAML/HCL xảy ra, Backend vẫn trả về HTTP 200/đáp ứng bình thường nhưng gắn cờ báo lỗi và giữ nguyên trạng thái cũ. Không bao giờ gửi sơ đồ rỗng hoặc làm đứng UI.

## 3. Quy chuẩn tích hợp MCP & IPC
*   **MCP qua stdio**: Đảm bảo tiến trình MCP khi chạy bằng lệnh `loomiss mcp` không in bất kỳ log dư thừa nào ra `stdout` ngoại trừ giao thức JSON-RPC hợp lệ. Mọi log debug của MCP server phải được ghi ra `stderr` hoặc tệp tin log riêng.
*   **Endpoint API cục bộ (IPC)**:
    *   Mở cổng API nội bộ mặc định ở `localhost:18900` cho daemon chính.
    *   Khi MCP nhận event từ IDE, nó gửi payload nhỏ dạng POST sang port này để kích hoạt hiệu ứng nhấp nháy neon trên Web UI của Daemon chính.
