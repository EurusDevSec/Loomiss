# Loomiss 🌀

[![Go Version](https://img.shields.io/github/go-mod/go-version/glincker/loomiss?color=00ADD8&logo=go&logoColor=white)](https://golang.org)
[![React Version](https://img.shields.io/badge/react-19.x-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CGO-Free](https://img.shields.io/badge/CGO--Free-Pure_Go-brightgreen?logo=go)](https://golang.org)
[![MCP Integrated](https://img.shields.io/badge/MCP-JSON--RPC-purple?logo=json)](https://modelcontextprotocol.io)

**Loomiss** is a standalone, enterprise-grade **Dynamic Architecture Visualizer** and **Model Context Protocol (MCP) Server** built in pure, CGO-free Go. It parses workspace configurations, microservices, and infrastructure files in real-time, rendering an interactive, neon-accented cyberpunk Web UI. 

Loomiss acts as the **"Digital Twin"** of your live codebase, bridging the gap between local source files, cloud orchestration layouts, and real-time observability.

---

## 📋 Table of Contents

- [The Enterprise Pain Points](#-the-enterprise-pain-points)
- [How Loomiss Solves & Measures Reality](#-how-loomiss-solves--measures-reality)
- [Guaranteeing Diagram Accuracy](#-guaranteeing-diagram-accuracy)
- [Key Features](#-key-features)
- [System Architecture](#%EF%B8%8F-system-architecture)
- [Supported Stack Scanners](#%EF%B8%8F-supported-stack-scanners)
- [Getting Started](#-getting-started)
- [Model Context Protocol (MCP) Integration](#-model-context-protocol-mcp-integration)
- [Development & Build Instructions](#-development--build-instructions)
- [License](#-license)

---

## 🚨 The Enterprise Pain Points

In modern DevOps and AI-assisted development environments, engineering teams face critical "blind spots":

### 1. AI Coding Blindness (Sự mù quáng khi AI sửa code)
Coding Agents (Cursor, Devin, etc.) can edit dozens of configuration files simultaneously. Kỹ sư phải đọc file diff rời rạc mà không có cái nhìn tổng quan. Loomiss converts code changes into an interactive visual graph, showing precisely what new links or databases the AI has introduced before you commit.

### 2. Architecture Diagram Drift (Trôi lệch sơ đồ hạ tầng)
Miro, Lucidchart, or Draw.io diagrams are static drawings that become obsolete the moment the next line of code is pushed. Loomiss eliminates this draft overhead: **your code is the documentation**. 

### 3. Visual Clutter & Path Congestion (Nghẽn mạng & Chồng lấn đường vẽ)
When graphs scale up to 30+ services (like Google's Microservices Demo), traditional layout tools produce tangled, crossing lines. Loomiss implements **A\* Pathfinding** and **Focal Fading** to untangle dense microservice communication highways.

---

## 📈 How Loomiss Solves & Measures Reality

Loomiss does not mock or estimate configurations; it measures system state through concrete verification engines:

```
┌────────────────────────────────────────────────────────┐
│                      Loomiss Core                      │
├───────────────────┬────────────────────────────────────┤
│ Static Scanner    │ K8s, Terraform, Nginx, Compose, Env│
├───────────────────┼────────────────────────────────────┤
│ Live Observability│ TCP/HTTP Background Prober (10s)   │
├───────────────────┼────────────────────────────────────┤
│ Real-Time Metrics │ Docker SDK Container Resource Stream│
└───────────────────┴────────────────────────────────────┘
```

1. **Lightweight TCP/HTTP Probing:** A background Goroutine runs every 10 seconds to check if exposed ports of nodes are alive. Offline services pulse bright red and display an `OFFLINE` badge on the UI, turning their connecting edges red to represent blocked data paths.
2. **Docker SDK Metrics Integration:** Streams real-time CPU & RAM container statistics directly to the Web UI via WebSockets, rendering neon indicator bars below each service node.
3. **Ghost Node Detection:** If an Nginx proxy or gateway directs traffic to an unmapped host/port, Loomiss instantly generates a grey-dashed **Ghost Node** (`unknown_service`) to alert engineers of routing gaps.

---

## 🎯 Guaranteeing Diagram Accuracy

Loomiss guarantees a $100\%$ accurate representation of your infrastructure through:

*   **Recursive Workspace Mapping:** Scans all configuration files (YAML, HCL, Conf, package declarations) under the target workspace recursively.
*   **Recursive Parent Coordinate Normalization:** For nested groups (like pods inside Kubernetes or databases inside Terraform), Loomiss sums up parent coordinates, converting relative values to absolute canvas coordinates. This allows the pathfinder to position edges accurately.
*   **Folder-Based Service ID Resolution:** Automatically extracts microservice directory structures (e.g. `microservices-demo/src/<service_name>`) as the unified Node ID, guaranteeing that local source code projects merge flawlessly with cloud Kubernetes deployment declarations.
*   **Time Travel Git Diffs:** Backed by `git log` and `git show`, users can slide back through Git history. Loomiss builds and displays the exact architecture at previous commits *without* running a disk `git checkout`, highlighting added (green), modified (yellow), or deleted (dashed-red) nodes.

---

## 🌀 Key Features

> [!TIP]
> **A* Pathfinder (Smart Edges):** Integrated `@jalez/react-flow-smart-edge` to calculate obstacle-avoiding orthogonal paths around node bounding boxes, resolving edge-node overlaps. Group nodes are filtered out of obstacles to allow clean internal routing.
>
> **Interactive Hover Highlight:** Rê chuột qua bất kỳ đường nối nào sẽ làm nó đổi màu sang Neon Cyan, tăng độ rộng và phóng to các hạt traffic chạy dọc theo path.
>
> **Selected-Node Focus Fading:** Selecting a node dims all unrelated connections to $15\%$ opacity, keeping directly connected paths at $100\%$ opacity to immediately clarify traffic flows.
>
> **Layout Grid Spacing:** Adjusted node margins (`colWidth = 360`, `rowHeight = 180`) to ensure parallel edge labels (like `"Depends On"`) sit cleanly in a $120\text{px}$ clear horizontal channel without overlapping handles.

---

## ⚙️ System Architecture

```mermaid
graph TD
    subgraph "Target Workspace Directory"
        DC[docker-compose.yml]
        NX[nginx.conf]
        TF[main.tf]
        ENV[.env files]
        PKG[package.json / go.mod / requirements.txt / pom.xml / .csproj]
        K8S[Kubernetes YAMLs]
    end

    subgraph "Loomiss Go Daemon (CLI)"
        Watcher[File Watcher fsnotify]
        Registry[ConfigParser Registry]
        Compiler[Graph Compiler & Resolver]
        SQLite[(SQLite DB: memory.db)]
        Similarity[Cosine Similarity Engine]
        JSONRPC[JSON-RPC Stdio Handler]
        Prober[Observability TCP Prober]
    end

    subgraph "Clients"
        UI[React Flow Web Interface]
        AI[IDE AI Agent - Cursor/VSCode]
    end

    %% Workflow Connections
    Watcher -. Watches .-> Workspace
    Registry -- Parses configurations --> Target Workspace Directory
    
    Compiler -- Aggregates & Resolves Ports --> Registry
    Prober -- Telemetry check --> Compiler
    UI -- Fetches Graph / WebSocket --> Compiler
    
    JSONRPC -- Reads/Writes Tools --> Compiler
    JSONRPC -- Queries Semantic Cache --> SQLite
    JSONRPC -- Search Vector Rules --> Similarity
    AI -- JSON-RPC Protocol --> JSONRPC
```

---

## 🛠️ Supported Stack Scanners

Loomiss includes modular `ConfigParser` implementations to parse and group the following stacks:

1.  **Orchestration & Infrastructure Tiers:**
    *   **Kubernetes:** Parses Deployment, Service, and StatefulSet manifests, grouping them into the `☸️ Kubernetes Cluster`.
    *   **Docker Compose:** Parses services, exposed ports, and depends_on properties under the `🐳 Docker Compose Stack`.
    *   **Terraform:** Extracts resource relations, database instances, and binds them under the `☁️ Terraform Cloud Tier`.
    *   **Nginx Proxy:** Resolves listening blocks and `proxy_pass` rules, grouped under the `🌐 Public Gateway Tier`.
2.  **Multilanguage Application Scanner:**
    *   **Python:** Scans `requirements.txt`, `pyproject.toml`, `Pipfile`.
    *   **Java:** Scans `pom.xml`, `build.gradle`.
    *   **C# / .NET:** Scans `.csproj`.
    *   **Node.js & Go:** Parses `package.json` and `go.mod`.
    *   *Automatically sets technology-specific logos (with Devicons fallbacks for AWS/Java trademark 404s).*

---

## 🚀 Getting Started

Loomiss is packaged as a **completely standalone binary** containing both the embedded React frontend and the Go engine. **You do NOT need Go, Node.js, or npm to run it.**

### 1. Quick Start (No Dependencies Needed)

1.  **Copy** the compiled `loomiss.exe` (or `loomiss` on Linux/macOS) to your target project folder.
2.  **Run** the command:
    ```bash
    ./loomiss.exe start
    ```
3.  Open `http://localhost:18900` in your browser.

### 2. Building from Source & Installation (For Developers)

#### Option A: Automated Build & Installer (Recommended)
Our automated setup scripts check your prerequisites, install dependencies, compile the Vite app and Go binary, and configure the global system path:

*   **On Windows (PowerShell):**
    ```powershell
    PowerShell -ExecutionPolicy Bypass -File ./setup.ps1
    ```
*   **On Linux/macOS:**
    ```bash
    chmod +x ./setup.sh
    ./setup.sh
    ```

#### Option B: Manual Compilation (With AppLocker/Windows Defender Bypass)
On some Windows enterprise environments, newly compiled binaries inside temp directories are blocked. Strip debug symbols to change the signature:

1.  Build the React Flow frontend assets:
    ```bash
    cd frontend && npm install && npm run build && cd ..
    ```
2.  Build the standalone Go executable with stripped symbols:
    ```bash
    cd backend
    go build -ldflags="-s -w" -o ../loomiss.exe main.go
    cd ..
    ```
3.  To run the daemon:
    ```bash
    go run -ldflags="-s -w" main.go start
    ```

---

## 🤖 Model Context Protocol (MCP) Integration

Loomiss registers as an MCP server. Add the following block to your editor's `mcp.json` settings:

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

### Exposed Tools
*   `get_architecture_schema`: Retrieves the resolved graph schema. Supports semantic caching.
*   `report_agent_intent`: Signals that the AI is editing a specific node, flashing a green ripple on the Web UI.
*   `add_architectural_memory` / `get_architectural_memory`: Manages architectural rules in the vector SQLite DB.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
