package domain

// EmbeddingClient là interface trừu tượng hóa dịch vụ tạo vector embeddings (Gemini API vs ONNX)
type EmbeddingClient interface {
	GetEmbeddings(text string) ([]float32, error)
}

// MemoryRepository quản lý việc lưu trữ và truy vấn facts kiến trúc lâu dài
type MemoryRepository interface {
	SaveFact(fact string, embedding []float32) error
	SearchFacts(embedding []float32, limit int) ([]string, error)
}

// CacheRepository quản lý lớp cache ngữ nghĩa cho các câu hỏi của Agent
type CacheRepository interface {
	GetCache(embedding []float32) (string, error)
	SetCache(prompt string, embedding []float32, response string) error
}
