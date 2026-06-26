---
name: github_actions_ci
description: Cấu hình và vận hành hệ thống CI/CD để kiểm thử Go/React và tự động phát hành các tệp binary trên GitHub Releases.
---

# GitHub Actions CI/CD Skill for Loomiss

Quy trình tự động hóa kiểm định và triển khai dự án Loomiss sử dụng GitHub Actions, giúp bạn tự động chạy test và đóng gói ứng dụng thành các file binary độc lập (Windows, macOS, Linux) để phân phối trực tiếp.

---

## 1. Cấu hình CI/CD Pipeline (`.github/workflows/release.yml`)

```yaml
name: Build and Release Loomiss

on:
  push:
    tags:
      - 'v*' # Trigger khi push tag có định dạng v1.0.0, v1.0.1...

jobs:
  build-frontend:
    name: Build React Frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-size: 20
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install Dependencies
        run: |
          cd frontend
          npm ci

      - name: Build Frontend
        run: |
          cd frontend
          npm run build # Tạo thư mục frontend/dist

      - name: Upload Frontend Artifact
        uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: frontend/dist/

  build-backend-and-release:
    name: Cross-Compile Go & Release
    runs-on: ubuntu-latest
    needs: build-frontend
    strategy:
      matrix:
        goos: [linux, windows, darwin]
        goarch: [amd64, arm64]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Download Frontend Artifact
        uses: actions/download-artifact@v4
        with:
          name: frontend-dist
          path: backend/daemon/dist # Nơi go:embed trỏ đến

      - name: Run Backend Tests
        run: |
          cd backend
          go test ./...

      - name: Cross-Compile Binary
        env:
          GOOS: ${{ matrix.goos }}
          GOARCH: ${{ matrix.goarch }}
          CGO_ENABLED: 0 # Đảm bảo pure Go, không dùng CGO
        run: |
          cd backend
          BINARY_NAME=loomiss
          if [ "${{ matrix.goos }}" = "windows" ]; then
            BINARY_NAME=loomiss.exe
          fi
          go build -ldflags="-s -w" -o ../bin/$BINARY_NAME-${{ matrix.goos }}-${{ matrix.goarch }} .

      - name: Package Release
        run: |
          cd bin
          BINARY_NAME=loomiss-${{ matrix.goos }}-${{ matrix.goarch }}
          if [ "${{ matrix.goos }}" = "windows" ]; then
            zip loomiss-${{ matrix.goos }}-${{ matrix.goarch }}.zip loomiss.exe-${{ matrix.goos }}-${{ matrix.goarch }}
          else
            tar -czvf loomiss-${{ matrix.goos }}-${{ matrix.goarch }}.tar.gz loomiss-${{ matrix.goos }}-${{ matrix.goarch }}
          fi

      - name: Upload Artifact to Github Release
        uses: softprops/action-gh-release@v2
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: |
            bin/loomiss-*.zip
            bin/loomiss-*.tar.gz
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 2. Quy tắc vận hành và bảo mật

*   **Không bật CGO**: `CGO_ENABLED: 0` là bắt buộc trong workflow. Nó đảm bảo các Go binary được liên kết tĩnh (statically linked), hoạt động độc lập mà không cần bất kỳ thư viện C động (`libc.so`) nào trên OS đích.
*   **Bảo mật Token**: Sử dụng biến mặc định `${{ secrets.GITHUB_TOKEN }}` được GitHub cấp sẵn cho mỗi repository để tạo Release và upload file, không cần cấu hình thêm secret thủ công.
*   **Tối ưu kích thước**: Sử dụng flag `-ldflags="-s -w"` khi build Go để lược bỏ bảng ký hiệu debug (debug symbols) và thông tin DWARF, giúp giảm khoảng 30% dung lượng file binary đầu ra.
