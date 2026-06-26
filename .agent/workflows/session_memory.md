# 💾 SESSION MEMORY — Loomiss Project
> Last Checkpoint: 2026-06-26 | Status: **PHASE 1 (SKELETON & SINGLE BINARY) — 100% COMPLETE & VERIFIED**

---

## ⚡ Active Tasks Completed (Những việc ĐÃ HOÀN THÀNH trong session)

### 🎨 Khởi tạo Giao diện & Auto Layout (Phase 1 Frontend)
*   **Vite + React Flow:** Khởi tạo dự án React TS thành công trong thư mục `frontend/`. Cài đặt `@xyflow/react` và các thư viện liên quan.
*   **Dagre Auto-Layout ([`layout.ts`](file:///r:/_Projects/Eurus_Workspace/Loomiss/frontend/src/utils/layout.ts)):** Cài đặt hàm sắp xếp node tự động dựa trên Dagre, hỗ trợ đổi hướng dọc (TB) / ngang (LR) và an toàn kiểu dữ liệu (Type-safe).
*   **Tailwind CSS v4 & index.css ([`index.css`](file:///r:/_Projects/Eurus_Workspace/Loomiss/frontend/src/index.css)):** Cấu hình Tailwind v4 dạng `@import` và `@theme` hiện đại, loại bỏ các lỗi tương thích PostCSS. Thiết kế giao diện Dark Mode neon cao cấp và hiệu ứng pulsing edges / ripple.
*   **Zustand Store ([`useGraphStore.ts`](file:///r:/_Projects/Eurus_Workspace/Loomiss/frontend/src/store/useGraphStore.ts)):** Quản lý toàn bộ trạng thái đồ thị và WebSocket độc lập với UI theo đúng tư duy Pragmatic Clean Architecture.

### ⚙️ Backend HTTP Server & go:embed Đóng gói (Phase 1 Backend)
*   **Go Module & Domain Layer ([`models.go`](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/domain/models.go) & [`interfaces.go`](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/domain/interfaces.go)):** Khởi tạo `loomiss` module, thiết lập models và các interface trừu tượng cho SQLite, caching, embedding.
*   **Static Assets Embedding ([`server.go`](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/daemon/server.go)):** Nhúng trực tiếp thư mục build `dist/` vào file Go binary thông qua `go:embed`. Khởi chạy HTTP Server trên cổng `18900` và tự động mở trình duyệt tương ứng với hệ điều hành khi start.
*   **CLI Routing ([`main.go`](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/main.go)):** Xử lý định tuyến CLI (`loomiss start`, `loomiss mcp`) và mặc định khởi chạy Web server nếu gọi trực tiếp.
*   **Đóng gói Binary:** Biên dịch chéo thành công ra file binary `loomiss.exe` ở cả thư mục gốc và thư mục `backend/` dạng **pure Go (Zero CGO)**.

---

## 🧠 Semantic Context Essence (Tinh túy kiến thức & Quyết định thiết kế)

*   **Đầu ra của Build Frontend:** `frontend/vite.config.ts` được chỉnh sửa để build trực tiếp vào `../backend/daemon/dist/`, giúp đơn giản hóa việc nhúng tài nguyên bằng Go compiler.
*   **Position enum của @xyflow/react:** Bắt buộc sử dụng `Position.Left`, `Position.Top` từ thư viện thay vì truyền chuỗi string thường như `'left'`, `'top'` để tránh lỗi biên dịch TypeScript khi bật `verbatimModuleSyntax`.
*   **Tailwind v4 PostCSS Integration:** Sử dụng plugin `@tailwindcss/postcss` trong `postcss.config.js` thay vì plugin cũ, cấu hình `@import "tailwindcss"` và `@theme` trực tiếp trong tệp tin CSS.
*   **Log redirection của MCP:** Ghi nhớ ở các phase sau khi code MCP, mọi stdout của tiến trình `mcp` chỉ được ghi dữ liệu JSON-RPC. Mọi log debug phải chuyển hướng ra `stderr`.

---

## 🔜 Next Steps (3 hành động kỹ thuật trực tiếp kế tiếp)

- [ ] **Step 1 (Phase 2):** Khởi tạo package `parsers` trong `backend/parsers/` và viết trình phân tích cú pháp `compose.go` đọc tệp `docker-compose.yml` sử dụng thư viện `yaml.v3`.
- [ ] **Step 2 (Phase 2):** Viết trình phân tích cú pháp `terraform.go` đọc các file `.tf` sử dụng `hcl/v2`.
- [ ] **Step 3 (Phase 2):** Viết custom parser hoặc lexer đơn giản `nginx.go` phân tích các block và chỉ thị `proxy_pass` của Nginx.
