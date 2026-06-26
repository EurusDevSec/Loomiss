# Phase 1: Xây Dựng Khung Xương & Single Binary

## 1. Mục tiêu (Goals)
*   Khởi tạo cấu trúc dự án Frontend (React + React Flow) và Backend (Go).
*   Tích hợp bộ công cụ layout tự động Dagre ở phía Frontend để tự sắp xếp node.
*   Đóng gói toàn bộ tài nguyên Frontend đã build vào trong file thực thi Go duy nhất (Single Binary) bằng `go:embed`.
*   Biên dịch thành công và chạy thử nghiệm khởi động tự động mở trình duyệt.

---

## 2. Kiến trúc & Stack kỹ thuật (Tech Stack)
*   **Frontend:** React (TypeScript), Vite, Tailwind CSS, React Flow (`@xyflow/react` hoặc `reactflow`), `@reactflow/dagre` (hoặc `dagre.js`).
*   **Backend:** Go (Golang), `net/http` (Standard Library), `embed` (Standard Library) để đóng gói thư mục tĩnh.

---

## 3. Các bước triển khai chi tiết (Implementation Steps)

### Bước 1: Thiết lập cấu trúc thư mục dự án
Tạo cấu trúc cây thư mục sạch cho cả Backend và Frontend:
```
Loomiss/
├── backend/                     # Mã nguồn Golang
│   ├── main.go                  # Điểm khởi chạy CLI
│   └── daemon/                  # HTTP Server & Server tĩnh
└── frontend/                    # Mã nguồn React
    ├── src/
    └── package.json
```

### Bước 2: Khởi tạo và thiết kế Frontend (React + React Flow)
1. Khởi tạo dự án React TS bằng Vite trong thư mục `frontend`:
   ```bash
   npx -y create-vite@latest frontend --template react-ts
   ```
2. Cài đặt các thư viện đồ họa:
   ```bash
   cd frontend
   npm install @xyflow/react dagre @types/dagre tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```
3. Thiết kế giao diện **Dark Mode neon**:
   * Cấu hình bảng màu Slate/Zinc trong `tailwind.config.js`.
   * Tạo Layout Component với các hiệu ứng glassmorphism (phông nền mờ, bo viền mảnh) cho thanh điều khiển.
4. Tích hợp thuật toán sắp xếp tự động **Dagre Layout**:
   * Viết hàm nhận danh sách Node và Edge thô, tính toán tọa độ `(x, y)` bằng `dagre` theo chiều ngang (LR) hoặc dọc (TB).
   * Cập nhật tọa độ vào các Node trước khi đưa vào React Flow render.
5. Tạo các Custom Node mẫu:
   * Node Gateway/Reverse Proxy (màu Neon Cyan).
   * Node Application Service (màu Neon Purple).
   * Node Database/Cache (màu Neon Amber).

### Bước 3: Thiết lập Backend và tích hợp đóng gói `go:embed`
1. Khởi tạo Go module tại thư mục `backend`:
   ```bash
   cd backend
   go mod init loomiss
   ```
2. Viết file `backend/main.go` khởi chạy HTTP Server:
   * Sử dụng thư viện `embed` để nhúng thư mục build của frontend:
     ```go
     //go:embed daemon/dist/*
     var frontendFS embed.FS
     ```
   * Viết HTTP Handler trả về file tĩnh từ `frontendFS`.
3. Tích hợp tính năng tự động mở trình duyệt:
   * Sử dụng các lệnh command hệ thống của Go (`exec.Command`) để chạy lệnh mở trình duyệt mặc định trỏ tới `http://localhost:18900` khi server Go khởi động thành công.

---

## 4. Kịch bản kiểm thử & Xác thực (Verification Plan)
*   **Build Frontend:** Chạy `npm run build` trong thư mục `frontend` tạo ra thư mục `dist`. Di chuyển hoặc copy `dist` vào `backend/daemon/dist`.
*   **Biên dịch Backend:** Chạy `go build -o loomiss.exe` trong thư mục `backend`.
*   **Chạy thử nghiệm:** Nhấp đúp vào file `loomiss.exe` hoặc chạy lệnh `.\loomiss.exe` trong console.
*   **Tiêu chuẩn đạt (Definition of Done):**
    1. Trình duyệt mặc định tự động mở ra địa chỉ `http://localhost:18900`.
    2. Giao diện tối màu (Dark Mode) xuất hiện, hiển thị sơ đồ mạng mẫu gồm các node Nginx, App, Database được sắp xếp đều đặn bằng Dagre mà không bị đè lên nhau.
