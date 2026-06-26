package parsers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"loomiss/domain"
)

func TestParseDockerCompose(t *testing.T) {
	// Khởi tạo nội dung mock docker-compose
	content := `
version: '3'
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - app
  app:
    image: sneakers-app:1.0
    ports:
      - "8080"
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
`
	tmpFile, err := os.CreateTemp("", "docker-compose-*.yml")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(content); err != nil {
		t.Fatalf("failed to write to temp file: %v", err)
	}
	tmpFile.Close()

	nodes, edges, err := ParseDockerCompose(tmpFile.Name())
	if err != nil {
		t.Fatalf("ParseDockerCompose failed: %v", err)
	}

	// Kiểm định Nodes (3 nodes thực tế + 1 node group)
	if len(nodes) != 4 {
		t.Errorf("expected 4 nodes, got %d", len(nodes))
	}

	nodeMap := make(map[string]string)
	for _, node := range nodes {
		nodeMap[node.ID] = node.Type
	}

	if nodeMap["web"] != "gateway" {
		t.Errorf("expected web node to be gateway, got %s", nodeMap["web"])
	}
	if nodeMap["app"] != "app" {
		t.Errorf("expected app node to be app, got %s", nodeMap["app"])
	}
	if nodeMap["db"] != "database" {
		t.Errorf("expected db node to be database, got %s", nodeMap["db"])
	}

	// Kiểm định Edges
	if len(edges) != 2 {
		t.Errorf("expected 2 edges, got %d", len(edges))
	}

	edgeMap := make(map[string]string)
	for _, edge := range edges {
		edgeMap[edge.Source] = edge.Target
	}

	if edgeMap["web"] != "app" {
		t.Errorf("expected edge web -> app, got web -> %s", edgeMap["web"])
	}
	if edgeMap["app"] != "db" {
		t.Errorf("expected edge app -> db, got app -> %s", edgeMap["app"])
	}
}

func TestParseNginxConfig(t *testing.T) {
	content := `
server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://backend-app:8080;
    }
}
`
	tmpFile, err := os.CreateTemp("", "nginx-*.conf")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(content); err != nil {
		t.Fatalf("failed to write to temp file: %v", err)
	}
	tmpFile.Close()

	nodes, edges, err := ParseNginxConfig(tmpFile.Name())
	if err != nil {
		t.Fatalf("ParseNginxConfig failed: %v", err)
	}

	if len(nodes) != 2 {
		t.Errorf("expected 2 nodes, got %d", len(nodes))
	}
	if nodes[0].ID != "nginx" {
		t.Errorf("expected node ID to be nginx, got %s", nodes[0].ID)
	}

	if len(edges) != 1 {
		t.Errorf("expected 1 edge, got %d", len(edges))
	}
	if edges[0].Source != "nginx" || edges[0].Target != "backend-app" {
		t.Errorf("expected edge nginx -> backend-app, got %s -> %s", edges[0].Source, edges[0].Target)
	}
}

func TestParseTerraformDirectory(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "tf-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	content := `
resource "aws_instance" "web_server" {
  ami           = "ami-123"
  instance_type = "t2.micro"
}

resource "aws_db_instance" "mysql_db" {
  allocated_storage = 20
  engine            = "mysql"
  instance_class    = "db.t2.micro"
  
  # Tạo tham chiếu phụ thuộc để test edges
  security_group_names = [aws_instance.web_server.id]
}
`
	tfFile := filepath.Join(tmpDir, "main.tf")
	if err := os.WriteFile(tfFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write tf file: %v", err)
	}

	nodes, edges, err := ParseTerraformDirectory(tmpDir)
	if err != nil {
		t.Fatalf("ParseTerraformDirectory failed: %v", err)
	}

	if len(nodes) != 3 {
		t.Errorf("expected 3 nodes, got %d", len(nodes))
	}

	nodeMap := make(map[string]string)
	for _, node := range nodes {
		nodeMap[node.ID] = node.Type
	}

	if nodeMap["aws_instance.web_server"] != "app" {
		t.Errorf("expected aws_instance.web_server to be app, got %s", nodeMap["aws_instance.web_server"])
	}
	if nodeMap["aws_db_instance.mysql_db"] != "database" {
		t.Errorf("expected aws_db_instance.mysql_db to be database, got %s", nodeMap["aws_db_instance.mysql_db"])
	}

	// MySQL phụ thuộc vào web_server qua tham chiếu biến
	if len(edges) != 1 {
		t.Errorf("expected 1 edge, got %d", len(edges))
	}
	if edges[0].Source != "aws_db_instance.mysql_db" || edges[0].Target != "aws_instance.web_server" {
		t.Errorf("expected edge mysql_db -> web_server, got %s -> %s", edges[0].Source, edges[0].Target)
	}
}

func TestAppLevelParser(t *testing.T) {
	// Create a temp workspace directory
	tmpWorkspace, err := os.MkdirTemp("", "workspace-*")
	if err != nil {
		t.Fatalf("failed to create temp workspace: %v", err)
	}
	defer os.RemoveAll(tmpWorkspace)

	// Create a subfolder for Node app
	nodeAppDir := filepath.Join(tmpWorkspace, "my-frontend")
	if err := os.MkdirAll(nodeAppDir, 0755); err != nil {
		t.Fatalf("failed to create node app dir: %v", err)
	}

	pkgContent := `{
		"name": "my-frontend",
		"dependencies": {
			"next": "^13.0.0",
			"react": "^18.0.0"
		}
	}`
	if err := os.WriteFile(filepath.Join(nodeAppDir, "package.json"), []byte(pkgContent), 0644); err != nil {
		t.Fatalf("failed to write package.json: %v", err)
	}

	envContent := `
PORT=3000
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
`
	if err := os.WriteFile(filepath.Join(nodeAppDir, ".env"), []byte(envContent), 0644); err != nil {
		t.Fatalf("failed to write .env: %v", err)
	}

	// Create a subfolder for Go app
	goAppDir := filepath.Join(tmpWorkspace, "my-backend")
	if err := os.MkdirAll(goAppDir, 0755); err != nil {
		t.Fatalf("failed to create go app dir: %v", err)
	}

	goModContent := `module github.com/user/my-backend

go 1.20
`
	if err := os.WriteFile(filepath.Join(goAppDir, "go.mod"), []byte(goModContent), 0644); err != nil {
		t.Fatalf("failed to write go.mod: %v", err)
	}

	goEnvContent := `
PORT=8080
REDIS_URL=redis://localhost:6379
`
	if err := os.WriteFile(filepath.Join(goAppDir, ".env.local"), []byte(goEnvContent), 0644); err != nil {
		t.Fatalf("failed to write .env.local: %v", err)
	}

	// Run the parser
	parser := &AppLevelParser{}
	if !parser.CanParse(tmpWorkspace) {
		t.Fatalf("expected AppLevelParser to CanParse the workspace")
	}

	nodes, edges, err := parser.Parse(tmpWorkspace)
	if err != nil {
		t.Fatalf("AppLevelParser Parse failed: %v", err)
	}

	// We expect 5 nodes: my-frontend, my-frontend-postgres, my-backend, my-backend-redis + 1 group node
	if len(nodes) != 5 {
		t.Errorf("expected 5 nodes, got %d", len(nodes))
	}

	nodeMap := make(map[string]domain.Node)
	for _, n := range nodes {
		nodeMap[n.ID] = n
	}

	if _, ok := nodeMap["my-frontend"]; !ok {
		t.Errorf("expected my-frontend node")
	} else {
		n := nodeMap["my-frontend"]
		if !strings.Contains(n.Label, "Next.js") {
			t.Errorf("expected label to contain Next.js, got %s", n.Label)
		}
		if n.Metadata["ports"] != "3000" {
			t.Errorf("expected metadata ports to be 3000, got %s", n.Metadata["ports"])
		}
	}

	if _, ok := nodeMap["my-frontend-postgres"]; !ok {
		t.Errorf("expected my-frontend-postgres node")
	}

	if _, ok := nodeMap["my-backend"]; !ok {
		t.Errorf("expected my-backend node")
	} else {
		n := nodeMap["my-backend"]
		if !strings.Contains(n.Label, "Go Backend") {
			t.Errorf("expected label to contain Go Backend, got %s", n.Label)
		}
		if n.Metadata["ports"] != "8080" {
			t.Errorf("expected metadata ports to be 8080, got %s", n.Metadata["ports"])
		}
	}

	if _, ok := nodeMap["my-backend-redis"]; !ok {
		t.Errorf("expected my-backend-redis node")
	}

	// We expect 3 edges: my-frontend -> my-frontend-postgres, my-backend -> my-backend-redis, and my-frontend -> my-backend
	if len(edges) != 3 {
		t.Errorf("expected 3 edges, got %d", len(edges))
	}

	eMap := make(map[string]domain.Edge)
	for _, e := range edges {
		eMap[fmt.Sprintf("%s->%s", e.Source, e.Target)] = e
	}

	if _, ok := eMap["my-frontend->my-backend"]; !ok {
		t.Errorf("expected my-frontend -> my-backend edge to be created")
	} else if eMap["my-frontend->my-backend"].Label != "HTTP API" {
		t.Errorf("expected edge label to be HTTP API, got %s", eMap["my-frontend->my-backend"].Label)
	}
}

func TestParseNginxConfigUpstreamAndComments(t *testing.T) {
	content := `
# proxy_pass http://commented-out-host:8080;
upstream backend_pool {
    server app1:3000 weight=3;
    server app2:3000;
}

server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://backend_pool;
    }
}
`
	tmpFile, err := os.CreateTemp("", "nginx-*.conf")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(content); err != nil {
		t.Fatalf("failed to write to temp file: %v", err)
	}
	tmpFile.Close()

	_, edges, err := ParseNginxConfig(tmpFile.Name())
	if err != nil {
		t.Fatalf("ParseNginxConfig failed: %v", err)
	}

	// 1. Kiểm tra không có target nào chứa 'commented-out-host'
	for _, edge := range edges {
		if strings.Contains(edge.Target, "commented-out-host") {
			t.Errorf("expected commented-out host to be ignored, but found in edge: %v", edge)
		}
	}

	// 2. Kiểm tra Upstream Pool đã được phân rã thành các node app1 và app2
	foundApp1 := false
	foundApp2 := false
	for _, edge := range edges {
		if edge.Source == "nginx" && edge.Target == "app1" {
			foundApp1 = true
		}
		if edge.Source == "nginx" && edge.Target == "app2" {
			foundApp2 = true
		}
	}

	if !foundApp1 || !foundApp2 {
		t.Errorf("expected edges to app1 and app2 resolved from upstream backend_pool, got foundApp1=%t, foundApp2=%t", foundApp1, foundApp2)
	}
}

func TestDockerComposeEnvironment(t *testing.T) {
	content := `
version: '3'
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
  api:
    image: sneakers-app:1.0
    environment:
      - DB_HOST=postgres-db
      - REDIS_URL=redis://redis-cache:6379
`
	tmpFile, err := os.CreateTemp("", "docker-compose-*.yml")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(content); err != nil {
		t.Fatalf("failed to write to temp file: %v", err)
	}
	tmpFile.Close()

	nodes, _, err := ParseDockerCompose(tmpFile.Name())
	if err != nil {
		t.Fatalf("ParseDockerCompose failed: %v", err)
	}

	foundAPI := false
	for _, node := range nodes {
		if node.ID == "api" {
			foundAPI = true
			envValues := node.Metadata["env_values"]
			if !strings.Contains(envValues, "postgres-db") || !strings.Contains(envValues, "redis://redis-cache:6379") {
				t.Errorf("expected env_values metadata to contain environment values, got: %s", envValues)
			}
		}
	}

	if !foundAPI {
		t.Errorf("expected api node to be parsed")
	}
}


