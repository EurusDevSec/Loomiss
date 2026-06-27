# 💾 SESSION MEMORY — Loomiss Project
> Last Checkpoint: 2026-06-27 | Status: Verified with EKS Blueprints Repository and Documented Fully

---

## ⚡ Active Tasks Completed (Những việc ĐÃ HOÀN THÀNH trong session)
*   **Workspace Sample Cleanup:**
    *   Deleted `main.tf`, `docker-compose.yml`, and `nginx.conf` mockup files from the workspace root to ensure they do not contaminate diagrams when running Loomiss on other cloned repositories.
*   **Daemon Directory Switch Fix:**
    *   Modified [backend/main.go](file:///r:/_Projects/Eurus_Workspace/Loomiss/backend/main.go) to remove the dependency on `docker-compose.yml` for directory switching. The daemon now always changes directories up to the parent if launched from the `backend` folder, ensuring correct workspace scanning regardless of which configuration files are present at the root.
*   **EKS Blueprints Verification:**
    *   Cloned and tested Loomiss with the `eks-blueprints-actions-workflow` repository. Verified that it correctly detects 5 Terraform subnet/ArgoCD nodes and 1 Kubernetes deployment node, rendering them side-by-side with A* smart orthogonal routing, tech icons, and live shadow probing (correctly showing public subnet components as offline in pulsing red).
*   **Documentation Refactoring:**
    *   Updated [docs/plan.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/plan.md), [docs/phases/phase2_parsers.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/phases/phase2_parsers.md), and [docs/phases/phase6_wow_features.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/phases/phase6_wow_features.md) with complete information regarding Kubernetes manifests parser, Python/Java/C# scans, A* smart edge routing, absolute coordinate calculation, and edge focus/hover highlight features.
    *   Rewrote the root [README.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/README.md) to showcase Loomiss's real-world business values, exact measurement capabilities (observability, live metrics, AST scanning), and problem statements for modern enterprise environments.

## 🧠 Semantic Context Essence (Tinh túy kiến thức & Quyết định thiết kế)
*   **Always Change Dir on Backend Execution:** When testing/running backend daemon locally using `go run main.go start`, the working directory must be shifted up to the root workspace. Bypassing the `docker-compose.yml` check ensures the workspace root is always targets correctly.
*   **Windows File Lock Prevention:** During hot-swapping or folder deletion on Windows, file handles held by `fsnotify` in the running Go daemon must be freed by stopping the task first.
*   **A* Pathfinding obstacle list mapping:** Absolute coordinates calculation is critical for A* smart edges. Recursive resolution of offset coordinates from parent coordinates ensures accuracy. Removing parent groups from the obstacle array is required to allow drawing routes between internal child nodes.

## 🔜 Next Steps (3 hành động kỹ thuật trực tiếp kế tiếp)
- [ ] **Step 1:** Add support for frontend control panel buttons to toggle visibility of specific categories of edges (e.g. database dependencies vs proxy routing) to further reduce density in large clusters.
- [ ] **Step 2:** Implement an option to export the parsed canvas directly into standard SVG or PNG vector formats for architectural documentation.
- [ ] **Step 3:** Fully implement the phase 7 Generative UI interactive chat features in the Web UI dashboard side-panel.
