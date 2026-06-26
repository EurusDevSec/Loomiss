package parsers

import (
	"os"
	"path/filepath"
	"testing"
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

	// Kiểm định Nodes
	if len(nodes) != 3 {
		t.Errorf("expected 3 nodes, got %d", len(nodes))
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

	if len(nodes) != 1 {
		t.Errorf("expected 1 node, got %d", len(nodes))
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

	if len(nodes) != 2 {
		t.Errorf("expected 2 nodes, got %d", len(nodes))
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
