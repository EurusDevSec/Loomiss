package parsers

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"loomiss/domain"
)

// AppLevelParser scans project for package.json, go.mod and .env configurations to build node graphs
type AppLevelParser struct{}

func (p *AppLevelParser) Name() string { return "AppLevel" }

func (p *AppLevelParser) CanParse(workspacePath string) bool {
	found := false
	_ = filepath.Walk(workspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if shouldSkipDir(path, info, workspacePath) {
				return filepath.SkipDir
			}
			if info.Name() == ".github" {
				workflowsPath := filepath.Join(path, "workflows")
				if subInfo, subErr := os.Stat(workflowsPath); subErr == nil && subInfo.IsDir() {
					found = true
					return filepath.SkipDir
				}
			}
			if strings.ToLower(info.Name()) == "grafana" {
				found = true
				return filepath.SkipDir
			}
			return nil
		}
		nameLower := strings.ToLower(info.Name())
		if info.Name() == "package.json" || info.Name() == "go.mod" || info.Name() == "Jenkinsfile" || nameLower == "prometheus.yml" || nameLower == "prometheus.yaml" || nameLower == "grafana.ini" {
			found = true
			return filepath.SkipDir
		}
		return nil
	})
	return found
}

type PackageJSON struct {
	Name            string            `json:"name"`
	Dependencies    map[string]string `json:"dependencies"`
	DevDependencies map[string]string `json:"devDependencies"`
	Scripts         map[string]string `json:"scripts"`
}

func (p *AppLevelParser) Parse(workspacePath string) ([]domain.Node, []domain.Edge, error) {
	var nodes []domain.Node
	var edges []domain.Edge

	var hasGithubActions bool
	var hasJenkins bool
	var hasPrometheus bool
	var hasGrafana bool

	err := filepath.Walk(workspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		nameLower := strings.ToLower(info.Name())

		if info.IsDir() {
			if shouldSkipDir(path, info, workspacePath) {
				return filepath.SkipDir
			}
			if info.Name() == ".github" {
				workflowsPath := filepath.Join(path, "workflows")
				if subInfo, subErr := os.Stat(workflowsPath); subErr == nil && subInfo.IsDir() {
					hasGithubActions = true
				}
			}
			if nameLower == "grafana" {
				hasGrafana = true
			}
			return nil
		}

		if info.Name() == "Jenkinsfile" {
			hasJenkins = true
		}
		if nameLower == "prometheus.yml" || nameLower == "prometheus.yaml" {
			hasPrometheus = true
		}
		if nameLower == "grafana.ini" {
			hasGrafana = true
		}

		dir := filepath.Dir(path)
		folderName := filepath.Base(dir)
		if folderName == "." || folderName == "/" || folderName == "" || folderName == filepath.Base(workspacePath) {
			folderName = "root"
		}

		if info.Name() == "package.json" {
			pNodes, pEdges := parsePackageJSON(path, dir, folderName)
			nodes = append(nodes, pNodes...)
			edges = append(edges, pEdges...)
		} else if info.Name() == "go.mod" {
			gNodes, gEdges := parseGoMod(path, dir, folderName)
			nodes = append(nodes, gNodes...)
			edges = append(edges, gEdges...)
		}

		return nil
	})

	hasApps := false
	for _, n := range nodes {
		if n.Type != "group" {
			hasApps = true
			break
		}
	}

	if hasApps {
		nodes = append(nodes, domain.Node{
			ID:    "app-workspace-group",
			Label: "📦 Local Applications Tier",
			Type:  "group",
		})
	}

	if hasGithubActions || hasJenkins || hasPrometheus || hasGrafana {
		nodes = append(nodes, domain.Node{
			ID:    "devops-monitoring-group",
			Label: "🛠️ DevOps & Observability Tier",
			Type:  "group",
		})

		if hasGithubActions {
			nodes = append(nodes, domain.Node{
				ID:       "github-actions",
				Label:    "🐙 GitHub Actions CI/CD",
				Type:     "app",
				Status:   "active",
				ParentID: "devops-monitoring-group",
			})
		}
		if hasJenkins {
			nodes = append(nodes, domain.Node{
				ID:       "jenkins",
				Label:    "🧓 Jenkins Pipelines",
				Type:     "app",
				Status:   "active",
				ParentID: "devops-monitoring-group",
			})
		}
		if hasPrometheus {
			nodes = append(nodes, domain.Node{
				ID:       "prometheus",
				Label:    "🔥 Prometheus Server",
				Type:     "database",
				Status:   "active",
				Metadata: map[string]string{"ports": "9090"},
				ParentID: "devops-monitoring-group",
			})
		}
		if hasGrafana {
			nodes = append(nodes, domain.Node{
				ID:       "grafana",
				Label:    "📊 Grafana Dashboards",
				Type:     "app",
				Status:   "active",
				Metadata: map[string]string{"ports": "3000"},
				ParentID: "devops-monitoring-group",
			})
		}
	}

	return nodes, edges, err
}

func parsePackageJSON(path, dir, folderName string) ([]domain.Node, []domain.Edge) {
	var nodes []domain.Node
	var edges []domain.Edge

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil
	}

	var pkg PackageJSON
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, nil
	}

	label := "📦 Node.js App"
	nodeType := "app"

	isDep := func(name string) bool {
		_, ok1 := pkg.Dependencies[name]
		_, ok2 := pkg.DevDependencies[name]
		return ok1 || ok2
	}

	if isDep("next") {
		label = "⚡ Next.js Frontend"
	} else if isDep("react") {
		label = "⚛️ React Frontend"
	} else if isDep("vue") {
		label = "💚 Vue Frontend"
	} else if isDep("svelte") {
		label = "🧡 Svelte Frontend"
	} else if isDep("express") {
		label = "🟢 Express Backend"
	} else if isDep("nest") {
		label = "🔴 NestJS Backend"
	}

	id := pkg.Name
	if id == "" {
		id = folderName
	}
	id = strings.ReplaceAll(id, "@", "")
	id = strings.ReplaceAll(id, "/", "-")

	envMetadata, envEdges, envDBNodes := parseEnvFile(dir, id, "app-workspace-group")

	metadata := map[string]string{
		"path": path,
	}
	for k, v := range envMetadata {
		metadata[k] = v
	}

	appNode := domain.Node{
		ID:       id,
		Label:    fmt.Sprintf("%s (%s)", label, id),
		Type:     nodeType,
		Status:   "active",
		Metadata: metadata,
		ParentID: "app-workspace-group",
	}

	nodes = append(nodes, appNode)
	nodes = append(nodes, envDBNodes...)
	edges = append(edges, envEdges...)

	return nodes, edges
}

func parseGoMod(path, dir, folderName string) ([]domain.Node, []domain.Edge) {
	var nodes []domain.Node
	var edges []domain.Edge

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil
	}

	content := string(data)
	lines := strings.Split(content, "\n")
	moduleName := folderName
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "module ") {
			moduleName = strings.TrimSpace(strings.TrimPrefix(line, "module "))
			parts := strings.Split(moduleName, "/")
			moduleName = parts[len(parts)-1]
			break
		}
	}

	id := moduleName
	if id == "" {
		id = folderName
	}

	envMetadata, envEdges, envDBNodes := parseEnvFile(dir, id, "app-workspace-group")

	metadata := map[string]string{
		"path": path,
	}
	for k, v := range envMetadata {
		metadata[k] = v
	}

	appNode := domain.Node{
		ID:       id,
		Label:    fmt.Sprintf("🐹 Go Backend (%s)", id),
		Type:     "app",
		Status:   "active",
		Metadata: metadata,
		ParentID: "app-workspace-group",
	}

	nodes = append(nodes, appNode)
	nodes = append(nodes, envDBNodes...)
	edges = append(edges, envEdges...)

	return nodes, edges
}

func parseEnvFile(dir string, parentID string, parentGroupID string) (map[string]string, []domain.Edge, []domain.Node) {
	metadata := make(map[string]string)
	var edges []domain.Edge
	var nodes []domain.Node

	envFiles := []string{".env", ".env.local", ".env.development", ".env.production"}
	var envData []byte
	for _, file := range envFiles {
		p := filepath.Join(dir, file)
		if data, e := os.ReadFile(p); e == nil {
			envData = data
			break
		}
	}

	if len(envData) == 0 {
		return metadata, nil, nil
	}

	lines := strings.Split(string(envData), "\n")
	envMap := make(map[string]string)
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			v = strings.Trim(v, `"'`)
			envMap[k] = v
		}
	}

	if port, ok := envMap["PORT"]; ok {
		metadata["ports"] = port
	}

	dbType := ""
	dbHost := ""
	dbPort := ""
	dbName := ""

	for k, v := range envMap {
		kLower := strings.ToLower(k)
		if strings.Contains(kLower, "redis") {
			dbType = "redis"
			if strings.Contains(v, "://") {
				u := strings.Split(v, "://")
				if len(u) > 1 {
					hostPort := strings.Split(strings.Split(u[1], "@")[len(strings.Split(u[1], "@"))-1], "/")[0]
					if strings.Contains(hostPort, ":") {
						parts := strings.Split(hostPort, ":")
						dbHost = parts[0]
						dbPort = parts[1]
					} else {
						dbHost = hostPort
					}
				}
			} else if strings.Contains(v, ":") {
				parts := strings.Split(v, ":")
				dbHost = parts[0]
				dbPort = parts[1]
			}
		} else if strings.Contains(kLower, "postgres") || strings.Contains(kLower, "pg") {
			dbType = "postgres"
		} else if strings.Contains(kLower, "mongo") {
			dbType = "mongodb"
		} else if strings.Contains(kLower, "mysql") {
			dbType = "mysql"
		}

		if strings.Contains(kLower, "db_host") || strings.Contains(kLower, "database_host") {
			dbHost = v
		}
		if strings.Contains(kLower, "db_port") || strings.Contains(kLower, "database_port") {
			dbPort = v
		}
		if strings.Contains(kLower, "db_name") || strings.Contains(kLower, "database_name") {
			dbName = v
		}
	}

	if urlVal, ok := envMap["DATABASE_URL"]; ok {
		if strings.HasPrefix(urlVal, "postgres") || strings.HasPrefix(urlVal, "postgresql") {
			dbType = "postgres"
		} else if strings.HasPrefix(urlVal, "mysql") {
			dbType = "mysql"
		}
	}
	if _, ok := envMap["MONGO_URI"]; ok {
		dbType = "mongodb"
	}
	if _, ok := envMap["REDIS_URL"]; ok {
		dbType = "redis"
	}

	if dbType != "" {
		dbID := parentID + "-" + dbType
		dbLabel := ""
		switch dbType {
		case "redis":
			dbLabel = "❤️ Redis Cache"
		case "postgres":
			dbLabel = "🐘 PostgreSQL DB"
		case "mongodb":
			dbLabel = "🍃 MongoDB"
		case "mysql":
			dbLabel = "🐬 MySQL DB"
		default:
			dbLabel = "🗄️ " + strings.Title(dbType) + " Database"
		}

		dbMetadata := map[string]string{
			"type": dbType,
		}
		if dbHost != "" {
			dbMetadata["host"] = dbHost
		}
		if dbPort != "" {
			dbMetadata["ports"] = dbPort
		}
		if dbName != "" {
			dbMetadata["database_name"] = dbName
		}

		dbNode := domain.Node{
			ID:       dbID,
			Label:    dbLabel,
			Type:     "database",
			Status:   "active",
			Metadata: dbMetadata,
			ParentID: parentGroupID,
		}

		edgeLabel := "Connects"
		if dbPort != "" {
			edgeLabel = fmt.Sprintf("Connects (%s)", dbPort)
		}

		dbEdge := domain.Edge{
			ID:     fmt.Sprintf("%s-%s", parentID, dbID),
			Source: parentID,
			Target: dbID,
			Label:  edgeLabel,
		}

		nodes = append(nodes, dbNode)
		edges = append(edges, dbEdge)
	}

	return metadata, edges, nodes
}
