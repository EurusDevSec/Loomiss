package memory

import (
	"os"
	"testing"
)

func TestVectorSimilarity(t *testing.T) {
	// Test CosineSimilarity với 2 vector vuông góc
	a := []float32{1.0, 0.0, 0.0}
	b := []float32{0.0, 1.0, 0.0}
	sim := CosineSimilarity(a, b)
	if sim != 0.0 {
		t.Errorf("expected orthogonal vectors similarity to be 0.0, got %f", sim)
	}

	// Test CosineSimilarity với 2 vector cùng hướng
	a2 := []float32{1.0, 2.0, 3.0}
	b2 := []float32{2.0, 4.0, 6.0} // Tỉ lệ 1:2
	sim2 := CosineSimilarity(a2, b2)
	if sim2 < 0.999 || sim2 > 1.001 {
		t.Errorf("expected parallel vectors similarity to be ~1.0, got %f", sim2)
	}

	// Test CosineSimilarity với vector rỗng hoặc lệch kích thước
	if CosineSimilarity(nil, nil) != 0.0 {
		t.Error("expected nil vector similarity to be 0.0")
	}
	if CosineSimilarity([]float32{1.0}, []float32{1.0, 2.0}) != 0.0 {
		t.Error("expected size mismatch vector similarity to be 0.0")
	}
}

func TestBinaryConversion(t *testing.T) {
	slice := []float32{0.15, -0.99, 3.1415, 42.0}
	bytes, err := Float32SliceToBytes(slice)
	if err != nil {
		t.Fatalf("failed to convert float32 to bytes: %v", err)
	}

	if len(bytes) != 16 { // 4 float32 * 4 bytes/float32 = 16 bytes
		t.Errorf("expected 16 bytes, got %d", len(bytes))
	}

	recovered, err := BytesToFloat32Slice(bytes)
	if err != nil {
		t.Fatalf("failed to convert bytes back to float32: %v", err)
	}

	if len(recovered) != 4 {
		t.Fatalf("expected recovered slice size 4, got %d", len(recovered))
	}

	for i := range slice {
		if recovered[i] != slice[i] {
			t.Errorf("mismatch at index %d: expected %f, got %f", i, slice[i], recovered[i])
		}
	}
}

func TestOfflineFallbackEmbedding(t *testing.T) {
	text1 := "vẽ sơ đồ docker-compose"
	text2 := "xem sơ đồ docker-compose"
	text3 := "bảo mật cơ sở dữ liệu postgresql"

	emb1 := getOfflineFallbackEmbedding(text1)
	emb2 := getOfflineFallbackEmbedding(text2)
	emb3 := getOfflineFallbackEmbedding(text3)

	if len(emb1) != 768 || len(emb2) != 768 || len(emb3) != 768 {
		t.Errorf("expected dimension 768, got %d, %d, %d", len(emb1), len(emb2), len(emb3))
	}

	// Tính tương đồng giữa text1 và text2 (nên cao vì chung nhiều từ "sơ", "đồ", "docker-compose")
	sim12 := CosineSimilarity(emb1, emb2)
	// Tính tương đồng giữa text1 và text3 (nên thấp vì khác nội dung hoàn toàn)
	sim13 := CosineSimilarity(emb1, emb3)

	t.Logf("Similarity ('%s' vs '%s'): %f", text1, text2, sim12)
	t.Logf("Similarity ('%s' vs '%s'): %f", text1, text3, sim13)

	if sim12 < 0.60 {
		t.Errorf("expected similarity of similar texts to be high (> 0.60), got %f", sim12)
	}

	if sim13 > 0.40 {
		t.Errorf("expected similarity of different texts to be low (< 0.40), got %f", sim13)
	}
}

func TestSQLiteMemoryDatabase(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "loomiss-db-*")
	if err != nil {
		t.Fatalf("failed to create tmp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Khởi tạo DB trong thư mục tạm
	err = InitDB(tmpDir)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer CloseDB()

	// 1. Kiểm tra lưu trữ và tải cache
	prompt := "vẽ sơ đồ docker-compose"
	response := "{\"nodes\": []}"
	vector := getOfflineFallbackEmbedding(prompt)

	err = SavePromptCache("test-cache-id", prompt, vector, response)
	if err != nil {
		t.Fatalf("SavePromptCache failed: %v", err)
	}

	caches, err := LoadAllPromptCache()
	if err != nil {
		t.Fatalf("LoadAllPromptCache failed: %v", err)
	}

	if len(caches) != 1 {
		t.Fatalf("expected 1 cached entry, got %d", len(caches))
	}

	if caches[0].Prompt != prompt || caches[0].Response != response {
		t.Errorf("cache content mismatch")
	}

	if len(caches[0].Embedding) != 768 {
		t.Errorf("expected cached vector size 768, got %d", len(caches[0].Embedding))
	}

	// 2. Kiểm tra lưu trữ và tải memories
	fact := "cơ sở dữ liệu postgresql chỉ dùng cho môi trường nội bộ"
	factVector := getOfflineFallbackEmbedding(fact)

	err = SaveMemory("test-memory-id", fact, factVector)
	if err != nil {
		t.Fatalf("SaveMemory failed: %v", err)
	}

	memories, err := LoadAllMemories()
	if err != nil {
		t.Fatalf("LoadAllMemories failed: %v", err)
	}

	if len(memories) != 1 {
		t.Fatalf("expected 1 memory entry, got %d", len(memories))
	}

	if memories[0].Fact != fact {
		t.Errorf("memory fact mismatch: expected '%s', got '%s'", fact, memories[0].Fact)
	}
}
