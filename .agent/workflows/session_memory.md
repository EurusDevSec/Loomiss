# 💾 SESSION MEMORY — Loomiss Project
> Last Checkpoint: 2026-06-26 | Status: **INITIAL FEASIBILITY EVALUATION & CONTEXT SETUP — 100% COMPLETE**

---

## ⚡ Active Tasks Completed (Những việc ĐÃ HOÀN THÀNH trong session)

### 📋 Kiến trúc & Kế hoạch Tối ưu hóa (Phase 0)

*   **Đánh giá & Phản biện Kế hoạch ([`evaluation_report.md`](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/evaluation_report.md)):**
    *   Phân tích các rủi ro kỹ thuật liên quan đến CGO khi dùng Tree-sitter. Đề xuất chuyển sang các **Pure Go Parsers** (`yaml.v3`, `hcl/v2`, custom nginx parser) để tối ưu cross-compilation.
    *   Xác định React Flow thiếu layout tự động. Đề xuất tích hợp **Dagre Layout Engine** (`@reactflow/dagre`) ở phía Frontend.
    *   Đề xuất cơ chế IPC (HTTP REST API nội bộ) để đồng bộ thông tin giữa tiến trình MCP stdio và Daemon chính.
    *   Xây dựng cơ chế chịu lỗi **LKG (Last Known Good)** để ngăn sập/xóa sơ đồ khi gõ cấu hình bị lỗi cú pháp tạm thời.

*   **Cập nhật Kế hoạch Tổng thể ([`plan.md`](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/plan.md)):**
    *   Gộp toàn bộ các đề xuất tối ưu hóa kiến trúc vào tài liệu kế hoạch chính.
    *   Bổ sung cơ chế **Universal Fallback (File Watcher)** giúp hỗ trợ tất cả các IDE / AI Clients không có MCP (như VSCode + standard GitHub Copilot).
    *   Bổ sung tiêu chuẩn đầu ra (Definition of Done) yêu cầu kiểm thử trên ít nhất 3 môi trường: **Antigravity IDE**, **Cursor** (qua MCP), và **VSCode/Kiro** (qua File Watcher khi lưu file).

*   **Thiết lập Context Agent mới ([`.agent/`](file:///r:/_Projects/Eurus_Workspace/Loomiss/.agent/)):**
    *   Tái cấu trúc và sửa đổi toàn bộ các file `.agent/rules/` (`CONTEXT.md`, `PLAN.md`, `ORCHESTRATOR.md`) phù hợp với stack công nghệ của Loomiss (Go, React Flow, WebSockets, MCP, IPC).

---

## 🧠 Semantic Context Essence (Tinh túy kiến thức & Quyết định thiết kế)

*   **Không sử dụng CGO**: Đây là tôn chỉ tiên quyết của phần backend nhằm đảm bảo quá trình biên dịch chéo sang Windows, Linux, macOS cực kỳ nhanh gọn thông qua Golang toolchain gốc mà không cần compiler GCC ngoài.
*   **Universal Fallback bằng File Watcher**: Với các IDE không tích hợp sẵn MCP (như VSCode thông thường chạy Copilot), watcher (`fsnotify`) của daemon chính đóng vai trò phát hiện sự thay đổi khi lưu file để cập nhật sơ đồ. MCP chỉ là kênh bổ sung nhằm cung cấp ngữ cảnh trực tiếp và hành động trước khi lưu.
*   **Dagre Layout Engine**: Bắt buộc phải tính toán tọa độ node từ trước khi vẽ để tránh hiện tượng các node đè lên nhau tại gốc (0,0).

---

## 🔜 Next Steps (3 hành động kỹ thuật trực tiếp kế tiếp)

- [ ] **Step 1:** Khởi tạo project frontend Vite + React trong thư mục `frontend` của dự án, cài đặt React Flow, Dagre layout và Tailwind CSS.
- [ ] **Step 2:** Khởi tạo dự án Go trong thư mục `backend`, thiết lập HTTP Server cơ bản và cấu hình `go:embed` trỏ tới thư mục build static `dist/` của frontend.
- [ ] **Step 3:** Tiến hành biên dịch thử nghiệm single binary của Go trên môi trường Windows local và xác thực giao thức mở trình duyệt tự động khi khởi chạy.
