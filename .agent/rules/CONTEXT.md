# 🧱 CONTEXT.md — Loomiss Project Architecture
> *Last updated: 2026-06-27 | Env: Go Backend (Local Dev/CLI) & React Web UI (Vite + React Flow)*

---

## 🛠️ Core Tech Stack & Infrastructure

| Layer | Technology | Deployment Strategy |
|---|---|---|
| **Core CLI & Backend** | Go (Golang) - Pure Go (No CGO) | Compiled into a single static binary for Windows, macOS, and Linux. Serves the embedded Web UI via `go:embed`. |
| **Frontend (Web UI)** | React.js (Vite), React Flow, `@reactflow/dagre` (Auto-layout), `@jalez/react-flow-smart-edge` (A* routing), TailwindCSS | Built into static assets (`dist/`), embedded directly into the Go binary. |
| **Local Configuration Parsers** | Pure Go Parsers: `gopkg.in/yaml.v3` (Docker-compose & Kubernetes YAML), `github.com/hashicorp/hcl/v2` (Terraform), Custom Go Lexer (Nginx) | Reads local configuration files static AST on local disk offline. Highly fault-tolerant. |
| **Multilanguage Scanner** | Go, Node.js, Python (`requirements.txt`, `pyproject.toml`), Java (`pom.xml`, `build.gradle`), C# (`.csproj`) | Scans project folders recursively, resolving technologies and tech-specific icons with CDN devicon fallbacks. |
| **Smart Caching & Database** | Pure Go SQLite (`modernc.org/sqlite`) + Cosine Similarity Vector matching | Stores prompt cache and architectural facts locally. Generates embeddings using Gemini Embedding API. |
| **Event Bridge & Realtime** | WebSockets (`gorilla/websocket`) | Pushes real-time graph updates (nodes & edges changes) from the Go daemon to the React UI. |
| **AI Integration & IPC** | MCP Server (stdio & SSE), Local HTTP API (localhost:18900) | Provides architecture context to AI Agents (Antigravity IDE, Cursor, Windsurf, Cline) via MCP tools. Processes IPC updates via HTTP POST to the main daemon. |
| **Fallback Detection** | File Watcher (`fsnotify`) with Debouncing | Fallback for IDEs without MCP (VSCode + standard Copilot). Automatically updates UI upon file save. |

---

## 📁 Repository Directory Structure

```
Loomiss/
├── .agent/                      # AI Agent session persistence & instructions
│   ├── rules/                   # Project rules (CONTEXT.md, PLAN.md, ORCHESTRATOR.md)
│   ├── skills/                  # Domain-specific skill guides (save_checkpoint.md, etc.)
│   └── workflows/               # Session memory (session_memory.md)
├── docs/                        # Project documentation (plan.md, architecture.md, etc.)
├── backend/                     # Go Backend codebase (HTTP server, WebSockets, Parsers, MCP)
│   ├── domain/                  # Domain Entities & Interfaces (models.go, interfaces.go)
│   ├── parsers/                 # YAML, HCL, Nginx, K8s, App-level parsers (compose.go, k8s.go, app_level.go)
│   ├── db/                      # SQLite CGO-free database implementation (sqlite.go)
│   ├── mcp/                     # MCP protocol handler (server.go)
│   ├── daemon/                  # HTTP/WS, File Watcher, Prober, Metrics (server.go, prober.go, watcher.go)
│   └── main.go                  # Application Entry & Dependency Injection
└── frontend/                    # Vite + React Frontend codebase
    ├── src/                     # React application source code
    │   ├── components/          # Custom nodes (ArchitectureNode) & Custom edges (TrafficEdge)
    │   ├── store/               # Zustand Store managing WebSockets & graph states
    │   ├── utils/               # Auto-layout (layout.ts) using Dagre
    │   └── App.tsx              # Main layout & View
    └── package.json             # React dependencies
```

---

## 📏 System Rules & Design Guidelines

- **Clean Architecture**: Tuân thủ nghiêm ngập mô hình kiến trúc sạch và quy tắc viết code tránh spaghetti quy định trong [docs/architecture.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/architecture.md). Phân chia code Go thành các tầng: Domain Entities, Use Cases, Adapters, và Infrastructure.
- **No CGO Dependency**: All Go code must be pure Go. This includes using a pure Go SQLite driver (`modernc.org/sqlite`) to enable zero-config cross-compilation.
- **Smart Edge A* Routing**: Use `@jalez/react-flow-smart-edge` for orthogonal, overlap-free connections. Bounding boxes of group nodes (`type === 'group'`) are omitted from obstacle calculation, while child nodes coordinates are recursively resolved to absolute coordinates.
- **Interactive Highlight & Focus**: Hovering on edges switches their stroke to bright Neon Cyan and scales animation particles. Selecting a node dims unrelated connections to 15% opacity while keeping related connections at 100% opacity.
- **Visual Grid Spacing**: Layout spacing constants in `layout.ts` must maintain `colWidth = 360` and `rowHeight = 180` to preserve a 120px gap for "Depends On" labels.
- **Fault Tolerance (LKG)**: The parser must never crash the application or clear the diagram on syntax errors. If a config file is temporarily invalid (e.g. during active typing), the system must retain the **Last Known Good (LKG)** state and show a minor warning on the UI.
- **Smart Debouncing**: Debounce file system events by `1500ms` in Go using channels to prevent redundant parsing and visual stuttering while typing.
- **Unified Daemon IPC**: The main daemon (`loomiss start`) runs the HTTP/WS server. The MCP process (`loomiss mcp`) called by IDEs acts as a client that relays agent activities to the daemon via a local IPC API.
