package memory

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

type PromptCacheEntry struct {
	ID        string
	Prompt    string
	Embedding []float32
	Response  string
	CreatedAt time.Time
}

type MemoryEntry struct {
	ID        string
	Fact      string
	Embedding []float32
	CreatedAt time.Time
}

var dbConn *sql.DB

// InitDB khởi tạo database SQLite tại thư mục `.loomiss/memory.db`
func InitDB(workspacePath string) error {
	dbDir := filepath.Join(workspacePath, ".loomiss")
	err := os.MkdirAll(dbDir, 0755)
	if err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	dbPath := filepath.Join(dbDir, "memory.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open sqlite database: %w", err)
	}

	// Tạo bảng prompt_cache nếu chưa tồn tại
	createPromptCacheTable := `
	CREATE TABLE IF NOT EXISTS prompt_cache (
		id TEXT PRIMARY KEY,
		prompt TEXT NOT NULL,
		embedding BLOB NOT NULL,
		response TEXT NOT NULL,
		created_at DATETIME NOT NULL
	);`

	_, err = db.Exec(createPromptCacheTable)
	if err != nil {
		db.Close()
		return fmt.Errorf("failed to create prompt_cache table: %w", err)
	}

	// Tạo bảng memories nếu chưa tồn tại
	createMemoriesTable := `
	CREATE TABLE IF NOT EXISTS memories (
		id TEXT PRIMARY KEY,
		fact TEXT NOT NULL,
		embedding BLOB NOT NULL,
		created_at DATETIME NOT NULL
	);`

	_, err = db.Exec(createMemoriesTable)
	if err != nil {
		db.Close()
		return fmt.Errorf("failed to create memories table: %w", err)
	}

	dbConn = db
	return nil
}

// CloseDB đóng kết nối database
func CloseDB() {
	if dbConn != nil {
		dbConn.Close()
	}
}

// SavePromptCache lưu kết quả phân tích sơ đồ và embedding vào cache
func SavePromptCache(id, prompt string, embedding []float32, response string) error {
	if dbConn == nil {
		return fmt.Errorf("database not initialized")
	}

	embedBytes, err := Float32SliceToBytes(embedding)
	if err != nil {
		return err
	}

	query := `INSERT OR REPLACE INTO prompt_cache (id, prompt, embedding, response, created_at) VALUES (?, ?, ?, ?, ?)`
	_, err = dbConn.Exec(query, id, prompt, embedBytes, response, time.Now())
	return err
}

// LoadAllPromptCache tải tất cả cache từ DB để tính tương đồng vector
func LoadAllPromptCache() ([]PromptCacheEntry, error) {
	if dbConn == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	rows, err := dbConn.Query("SELECT id, prompt, embedding, response, created_at FROM prompt_cache")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []PromptCacheEntry
	for rows.Next() {
		var entry PromptCacheEntry
		var embedBytes []byte
		err := rows.Scan(&entry.ID, &entry.Prompt, &embedBytes, &entry.Response, &entry.CreatedAt)
		if err != nil {
			return nil, err
		}

		embed, err := BytesToFloat32Slice(embedBytes)
		if err != nil {
			return nil, err
		}
		entry.Embedding = embed
		entries = append(entries, entry)
	}

	return entries, nil
}

// SaveMemory lưu fact/rule kiến trúc vào database
func SaveMemory(id, fact string, embedding []float32) error {
	if dbConn == nil {
		return fmt.Errorf("database not initialized")
	}

	embedBytes, err := Float32SliceToBytes(embedding)
	if err != nil {
		return err
	}

	query := `INSERT OR REPLACE INTO memories (id, fact, embedding, created_at) VALUES (?, ?, ?, ?)`
	_, err = dbConn.Exec(query, id, fact, embedBytes, time.Now())
	return err
}

// LoadAllMemories tải tất cả memories để đối chiếu tương đồng vector
func LoadAllMemories() ([]MemoryEntry, error) {
	if dbConn == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	rows, err := dbConn.Query("SELECT id, fact, embedding, created_at FROM memories")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []MemoryEntry
	for rows.Next() {
		var entry MemoryEntry
		var embedBytes []byte
		err := rows.Scan(&entry.ID, &entry.Fact, &embedBytes, &entry.CreatedAt)
		if err != nil {
			return nil, err
		}

		embed, err := BytesToFloat32Slice(embedBytes)
		if err != nil {
			return nil, err
		}
		entry.Embedding = embed
		entries = append(entries, entry)
	}

	return entries, nil
}
