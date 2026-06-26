package memory

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
)

// Float32SliceToBytes chuyển đổi []float32 sang []byte nhị phân để lưu vào SQLite BLOB
func Float32SliceToBytes(slice []float32) ([]byte, error) {
	buf := new(bytes.Buffer)
	err := binary.Write(buf, binary.LittleEndian, slice)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// BytesToFloat32Slice chuyển đổi []byte nhị phân từ SQLite BLOB sang []float32
func BytesToFloat32Slice(b []byte) ([]float32, error) {
	if len(b) == 0 {
		return nil, nil
	}
	if len(b)%4 != 0 {
		return nil, fmt.Errorf("invalid byte slice length for float32: %d", len(b))
	}
	count := len(b) / 4
	slice := make([]float32, count)
	buf := bytes.NewReader(b)
	err := binary.Read(buf, binary.LittleEndian, &slice)
	if err != nil {
		return nil, err
	}
	return slice, nil
}

// GetEmbedding sinh vector embedding (768 chiều) cho một chuỗi văn bản
func GetEmbedding(text string) ([]float32, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return getOfflineFallbackEmbedding(text), nil
	}

	// Định dạng URL và payload của Gemini Embedding API (text-embedding-004)
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=%s", apiKey)
	
	type Part struct {
		Text string `json:"text"`
	}
	type Content struct {
		Parts []Part `json:"parts"`
	}
	type RequestBody struct {
		Model   string  `json:"model"`
		Content Content `json:"content"`
	}

	reqBody := RequestBody{
		Model: "models/text-embedding-004",
		Content: Content{
			Parts: []Part{{Text: text}},
		},
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		fmt.Fprintf(os.Stderr, "[Loomiss Memory] Warning: Gemini API request failed: %v. Using offline fallback embedding...\n", err)
		return getOfflineFallbackEmbedding(text), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBodyBytes, _ := io.ReadAll(resp.Body)
		fmt.Fprintf(os.Stderr, "[Loomiss Memory] Warning: Gemini API returned status %d: %s. Using offline fallback embedding...\n", resp.StatusCode, string(respBodyBytes))
		return getOfflineFallbackEmbedding(text), nil
	}

	type EmbeddingResponse struct {
		Embedding struct {
			Values []float32 `json:"values"`
		} `json:"embedding"`
	}

	var embedResp EmbeddingResponse
	err = json.NewDecoder(resp.Body).Decode(&embedResp)
	if err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Đảm bảo trả về vector đúng 768 chiều (Gemini text-embedding-004 mặc định là 768)
	return embedResp.Embedding.Values, nil
}

// getOfflineFallbackEmbedding tạo một vector 768 chiều dựa trên thuật toán Bag-of-Words băm từ.
// Các văn bản có nhiều từ giống nhau sẽ có độ tương đồng cosine rất cao, giúp test ngoại tuyến dễ dàng.
func getOfflineFallbackEmbedding(text string) []float32 {
	vectorSize := 768
	vector := make([]float32, vectorSize)

	// Chuẩn hóa văn bản thành chữ thường
	words := strings.Fields(strings.ToLower(text))
	if len(words) == 0 {
		return vector
	}

	var sumSq float64
	for _, word := range words {
		// Bỏ qua các từ nối/dừng phổ biến tiếng Việt/Anh để tăng tính đặc trưng
		if word == "và" || word == "là" || word == "có" || word == "cho" || word == "tôi" || word == "đang" || word == "the" || word == "a" || word == "to" || word == "in" {
			continue
		}

		// Hàm băm từ thành index từ 0 đến 767
		var hash int = 0
		for _, char := range word {
			hash = 31*hash + int(char)
		}
		idx := (hash ^ (hash >> 16)) % vectorSize
		if idx < 0 {
			idx = -idx
		}

		vector[idx] += 1.0
	}

	// Tính norm bình phương
	for i := 0; i < vectorSize; i++ {
		sumSq += float64(vector[i] * vector[i])
	}

	// Chuẩn hóa vector thành Unit Vector (độ dài 1)
	if sumSq > 0 {
		norm := math.Sqrt(sumSq)
		for i := 0; i < vectorSize; i++ {
			vector[i] = float32(float64(vector[i]) / norm)
		}
	}

	return vector
}
