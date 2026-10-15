// Embeddings Recipe - Go Implementation
//
// End-to-end semantic search (mini-RAG) with your own vectors, using the Gloo AI
// Embeddings API instead of the Data Engine:
//
//	chunk a small corpus  ->  embed every chunk in one batched call  ->
//	embed the query with the same model  ->  rank chunks by cosine similarity  ->
//	take the top-k above a relevance threshold  ->  feed the labeled chunks into
//	a Guarded Responses call for a cited answer.
//
// Endpoints:
//
//	POST /ai/v2/direct/embeddings   -> vectors for your own vector store
//	POST /ai/v2/guarded/responses   -> guarded generation over the retrieved context
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// --- Configuration -----------------------------------------------------------

var apiKey string

const (
	apiRoot       = "https://platform.ai.gloo.com"
	embeddingsURL = apiRoot + "/ai/v2/direct/embeddings"
	responsesURL  = apiRoot + "/ai/v2/guarded/responses"

	// Stay on one embedding model for both the corpus and the query: vectors from
	// different models are not comparable.
	embeddingModel  = "gloo-openai-text-embedding-3-small"
	generationModel = "gloo-openai-gpt-6-luna"

	// Tuning knobs for retrieval.
	topK               = 3
	relevanceThreshold = 0.30

	// Chunking target (Goldilocks range from the learning center).
	targetChunkWords = 150

	defaultQuery = "How does Bezalel choose its artists?"

	// Bounded exponential backoff for retryable 503s (attempt 1, 2, 3 -> 1s, 2s, 4s).
	maxAttempts = 3
)

var httpClient = &http.Client{Timeout: 60 * time.Second}

// --- HTTP helpers ------------------------------------------------------------

func errorDetail(body []byte) string {
	var parsed interface{}
	if err := json.Unmarshal(body, &parsed); err != nil {
		text := strings.TrimSpace(string(body))
		if text == "" {
			return "(no response body)"
		}
		return text
	}

	detail := parsed
	if m, ok := parsed.(map[string]interface{}); ok {
		if d, ok := m["detail"]; ok {
			detail = d
		}
	}

	switch d := detail.(type) {
	case map[string]interface{}:
		message := firstString(d["msg"], d["message"])
		if message == "" {
			message = fmt.Sprintf("%v", d)
		}
		if param, ok := d["param"].(string); ok && param != "" {
			message = fmt.Sprintf("%s (parameter: %s)", message, param)
		}
		return message
	case []interface{}:
		if len(d) > 0 {
			if first, ok := d[0].(map[string]interface{}); ok {
				message := firstString(first["msg"], first["message"])
				if message == "" {
					message = fmt.Sprintf("%v", first)
				}
				param, _ := first["param"].(string)
				if param == "" {
					if loc, ok := first["loc"].([]interface{}); ok && len(loc) > 0 {
						param = fmt.Sprintf("%v", loc[len(loc)-1])
					}
				}
				if param != "" {
					message = fmt.Sprintf("%s (parameter: %s)", message, param)
				}
				return message
			}
			return fmt.Sprintf("%v", d[0])
		}
	}
	return fmt.Sprintf("%v", detail)
}

func firstString(values ...interface{}) string {
	for _, v := range values {
		if s, ok := v.(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// post sends a POST with the recipe's shared error handling and 503 backoff.
//
// It returns the raw response body, or an error with a clear message. When
// guardrail403 is set, a 403 is surfaced as a guardrails hard-block (the guarded
// surface can refuse content) rather than an auth failure.
func post(url string, payload interface{}, context string, guardrail403 bool) ([]byte, error) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("%s: could not encode request: %w", context, err)
	}

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		req, err := http.NewRequest("POST", url, bytes.NewReader(encoded))
		if err != nil {
			return nil, fmt.Errorf("%s request failed: %w", context, err)
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("%s request failed: %w", context, err)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		status := resp.StatusCode

		if status == 503 {
			retryable := false
			var m map[string]interface{}
			if json.Unmarshal(body, &m) == nil {
				if r, ok := m["retryable"].(bool); ok {
					retryable = r
				}
			}
			if retryable && attempt < maxAttempts {
				delay := 1 << (attempt - 1) // 1s, 2s, 4s
				fmt.Printf("  %s: provider unavailable (503, retryable) — retrying in %ds (attempt %d/%d)\n",
					context, delay, attempt, maxAttempts)
				time.Sleep(time.Duration(delay) * time.Second)
				continue
			}
			return nil, fmt.Errorf("%s: provider unavailable (503) after %d attempt(s): %s",
				context, attempt, strings.TrimSpace(string(body)))
		}

		if status == 400 {
			return nil, fmt.Errorf("%s: bad request (400) — fix the request. %s",
				context, errorDetail(body))
		}

		if status == 403 && guardrail403 {
			return nil, fmt.Errorf("%s: guardrails hard-blocked this request (403). %s",
				context, errorDetail(body))
		}

		if status == 401 || status == 403 {
			return nil, fmt.Errorf("%s: authentication/permission error (%d) — check GLOO_API_KEY and organization access. %s",
				context, status, errorDetail(body))
		}

		if status == 402 || status == 429 {
			return nil, fmt.Errorf("%s: spending limit or rate limit reached (%d). %s",
				context, status, errorDetail(body))
		}

		if status < 200 || status >= 300 {
			return nil, fmt.Errorf("%s: request failed with status %d: %s",
				context, status, errorDetail(body))
		}

		return body, nil
	}

	// Unreachable: the loop either returns or raises.
	return nil, fmt.Errorf("%s: request failed after %d attempts", context, maxAttempts)
}

// --- Corpus + chunking -------------------------------------------------------

type chunk struct {
	ChunkID    string
	SourceFile string
	ChunkIndex int
	Text       string
	Score      float64
}

func loadParagraphs(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	paragraphs := []string{}
	for _, block := range strings.Split(string(data), "\n\n") {
		text := strings.Join(strings.Fields(block), " ")
		if text != "" {
			paragraphs = append(paragraphs, text)
		}
	}
	return paragraphs, nil
}

// chunkFile greedily packs consecutive paragraphs into ~targetChunkWords-word
// chunks. Paragraphs are kept whole, so a dense paragraph can push a chunk over
// the target; that is expected and visible in the output.
func chunkFile(path, sourceFile string) ([]chunk, error) {
	paragraphs, err := loadParagraphs(path)
	if err != nil {
		return nil, err
	}

	chunks := []chunk{}
	currentWords := 0
	currentParts := []string{}
	chunkIndex := 0

	for _, paragraph := range paragraphs {
		wordCount := len(strings.Fields(paragraph))
		if len(currentParts) > 0 && currentWords+wordCount > targetChunkWords {
			chunks = append(chunks, chunk{
				ChunkID:    fmt.Sprintf("%s::%d", sourceFile, chunkIndex),
				SourceFile: sourceFile,
				ChunkIndex: chunkIndex,
				Text:       strings.Join(currentParts, "\n\n"),
			})
			chunkIndex++
			currentParts = []string{}
			currentWords = 0
		}
		currentParts = append(currentParts, paragraph)
		currentWords += wordCount
	}

	if len(currentParts) > 0 {
		chunks = append(chunks, chunk{
			ChunkID:    fmt.Sprintf("%s::%d", sourceFile, chunkIndex),
			SourceFile: sourceFile,
			ChunkIndex: chunkIndex,
			Text:       strings.Join(currentParts, "\n\n"),
		})
	}

	return chunks, nil
}

// buildCorpus chunks every .txt file in the content directory, in stable filename order.
func buildCorpus(contentDir string) ([]chunk, [][2]interface{}, error) {
	entries, err := os.ReadDir(contentDir)
	if err != nil {
		return nil, nil, err
	}

	names := []string{}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".txt") {
			names = append(names, entry.Name())
		}
	}
	sort.Strings(names)

	if len(names) == 0 {
		return nil, nil, fmt.Errorf("No .txt files found in %s", contentDir)
	}

	corpus := []chunk{}
	perFileCounts := [][2]interface{}{}
	for _, name := range names {
		fileChunks, err := chunkFile(filepath.Join(contentDir, name), name)
		if err != nil {
			return nil, nil, err
		}
		perFileCounts = append(perFileCounts, [2]interface{}{name, len(fileChunks)})
		corpus = append(corpus, fileChunks...)
	}
	return corpus, perFileCounts, nil
}

// --- Embeddings --------------------------------------------------------------

type usage struct {
	PromptTokens *int `json:"prompt_tokens"`
	TotalTokens  *int `json:"total_tokens"`
}

type embeddingsResponse struct {
	Data []struct {
		Index     int       `json:"index"`
		Embedding []float64 `json:"embedding"`
	} `json:"data"`
	Usage *usage `json:"usage"`
}

// embed makes one batched call: embed a list of strings with the shared model.
func embed(texts []string, context string) ([][]float64, *usage, error) {
	if len(texts) == 0 {
		return nil, nil, fmt.Errorf("%s: refusing to embed an empty input", context)
	}
	for _, t := range texts {
		if strings.TrimSpace(t) == "" {
			return nil, nil, fmt.Errorf("%s: input contains an empty or whitespace string", context)
		}
	}

	payload := map[string]interface{}{
		"model":           embeddingModel,
		"input":           texts,
		"encoding_format": "float",
	}
	body, err := post(embeddingsURL, payload, context, false)
	if err != nil {
		return nil, nil, err
	}

	var result embeddingsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, nil, fmt.Errorf("%s: could not parse response: %w", context, err)
	}

	// The API returns one embedding per input, in order; sort by index to be safe.
	sort.SliceStable(result.Data, func(i, j int) bool {
		return result.Data[i].Index < result.Data[j].Index
	})
	if len(result.Data) != len(texts) {
		return nil, nil, fmt.Errorf("%s: expected %d embeddings, got %d",
			context, len(texts), len(result.Data))
	}

	vectors := make([][]float64, len(result.Data))
	for i, item := range result.Data {
		vectors[i] = item.Embedding
	}
	return vectors, result.Usage, nil
}

// --- Retrieval ---------------------------------------------------------------

// cosineSimilarity is dot(a, b) / (||a|| * ||b||). Explicitly normalized:
// vectors aren't unit length.
func cosineSimilarity(a, b []float64) float64 {
	dot := 0.0
	normA := 0.0
	normB := 0.0
	n := len(a)
	if len(b) < n {
		n = len(b)
	}
	for i := 0; i < n; i++ {
		dot += a[i] * b[i]
	}
	for _, x := range a {
		normA += x * x
	}
	for _, y := range b {
		normB += y * y
	}
	normA = math.Sqrt(normA)
	normB = math.Sqrt(normB)
	if normA == 0 || normB == 0 {
		return 0.0
	}
	return dot / (normA * normB)
}

func rankChunks(queryVector []float64, corpus []chunk, vectors [][]float64) []chunk {
	ranked := make([]chunk, len(corpus))
	for i, c := range corpus {
		c.Score = cosineSimilarity(queryVector, vectors[i])
		ranked[i] = c
	}
	sort.SliceStable(ranked, func(i, j int) bool {
		return ranked[i].Score > ranked[j].Score
	})
	return ranked
}

// --- Augmentation ------------------------------------------------------------

// buildPrompt builds the labeled-chunks prompt: instructions, then [Source: ...]
// context, then the question.
func buildPrompt(question string, selected []chunk) (string, string) {
	contextBlocks := []string{}
	for _, c := range selected {
		label := fmt.Sprintf("[Source: %s, chunk %d]", c.SourceFile, c.ChunkIndex)
		contextBlocks = append(contextBlocks, label+"\n"+c.Text)
	}
	context := strings.Join(contextBlocks, "\n\n")

	instructions := "You are an assistant for Bezalel Ministries. Answer the user's question " +
		"using only the context below. If the context does not contain enough " +
		"information to answer fully, say so. Cite the sources you use by their " +
		"[Source: ...] labels."
	userInput := "Context:\n---\n" +
		context + "\n" +
		"---\n" +
		"Question: " + question
	return instructions, userInput
}

// --- Generation --------------------------------------------------------------

type responsesResponse struct {
	Output []struct {
		Type    string `json:"type"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	} `json:"output"`
}

// extractText extracts the assistant text from a Responses payload's output[] array.
func extractText(result responsesResponse) string {
	parts := []string{}
	for _, item := range result.Output {
		if item.Type != "message" {
			continue
		}
		for _, content := range item.Content {
			if content.Type == "output_text" {
				parts = append(parts, content.Text)
			}
		}
	}
	return strings.Join(parts, "\n")
}

// generateAnswer makes one Guarded Responses call over the retrieved context.
func generateAnswer(instructions, userInput string) (responsesResponse, error) {
	payload := map[string]interface{}{
		"model":             generationModel,
		"instructions":      instructions,
		"input":             userInput,
		"max_output_tokens": 500,
		"temperature":       0.2,
		// Uncomment to request a values-aligned answer for a specific tradition —
		// a Gloo capability the direct surface can't offer:
		// "tradition": "evangelical",
	}
	// A 403 here is surfaced as a guardrails hard-block, not an auth failure:
	// the guarded surface can refuse content.
	body, err := post(responsesURL, payload, "Guarded Responses", true)
	if err != nil {
		return responsesResponse{}, err
	}
	var result responsesResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return responsesResponse{}, fmt.Errorf("Guarded Responses: could not parse response: %w", err)
	}
	return result, nil
}

// --- Main --------------------------------------------------------------------

func resolveQuery() string {
	if len(os.Args) > 1 && strings.TrimSpace(os.Args[1]) != "" {
		return strings.TrimSpace(os.Args[1])
	}
	info, err := os.Stdin.Stat()
	if err != nil || (info.Mode()&os.ModeCharDevice) == 0 {
		return defaultQuery
	}
	fmt.Printf("Query [%s]: ", defaultQuery)
	line, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	line = strings.TrimSpace(line)
	if line == "" {
		return defaultQuery
	}
	return line
}

func main() {
	if err := godotenv.Load(); err != nil {
		fmt.Println("Warning: .env file not found, using system environment variables")
	}
	apiKey = os.Getenv("GLOO_API_KEY")
	if strings.TrimSpace(apiKey) == "" || apiKey == "your_gloo_api_key_here" {
		fmt.Fprintln(os.Stderr, "Missing GLOO_API_KEY. Set it in your environment or in a .env file "+
			"(see .env.example).")
		os.Exit(1)
	}

	fmt.Println(strings.Repeat("=", 80))
	fmt.Println("  EMBEDDINGS RECIPE — semantic search with your own vector store")
	fmt.Println(strings.Repeat("=", 80))

	// Step 0/1: corpus + chunking.
	corpus, perFileCounts, err := buildCorpus(filepath.Join("..", "content"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("\nCorpus: %d chunks from %d files\n", len(corpus), len(perFileCounts))
	for _, entry := range perFileCounts {
		fmt.Printf("  %s: %d chunks\n", entry[0], entry[1])
	}

	// Step 2: index every chunk in one batched embeddings call.
	fmt.Printf("\nEmbedding %d chunks in one batched call (%s)...\n", len(corpus), embeddingModel)
	chunkTexts := make([]string, len(corpus))
	for i, c := range corpus {
		chunkTexts[i] = c.Text
	}
	vectors, corpusUsage, err := embed(chunkTexts, "Embeddings (corpus)")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
	if corpusUsage != nil {
		fmt.Printf("  usage: prompt_tokens=%s total_tokens=%s\n",
			tokenString(corpusUsage.PromptTokens), tokenString(corpusUsage.TotalTokens))
	}

	question := resolveQuery()
	fmt.Printf("\nQuery: %s\n", question)

	// Step 3: embed the query with the same model, then rank by cosine similarity.
	queryVectors, queryUsage, err := embed([]string{question}, "Embeddings (query)")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
	queryVector := queryVectors[0]
	if queryUsage != nil {
		fmt.Printf("  query usage: prompt_tokens=%s\n", tokenString(queryUsage.PromptTokens))
	}

	ranked := rankChunks(queryVector, corpus, vectors)

	fmt.Println("\nAll chunks ranked by cosine similarity:")
	for position, c := range ranked {
		fmt.Printf("  %3d. %.4f  %s chunk %d\n", position+1, c.Score, c.SourceFile, c.ChunkIndex)
	}

	top := ranked
	if len(top) > topK {
		top = top[:topK]
	}
	fmt.Printf("\nTop %d chunks (threshold %v):\n", topK, relevanceThreshold)
	for _, c := range top {
		fmt.Printf("  %.4f  %s chunk %d\n", c.Score, c.SourceFile, c.ChunkIndex)
	}

	// Relevance gate: don't confidently answer from irrelevant matches.
	if len(top) == 0 || top[0].Score < relevanceThreshold {
		fmt.Println("\nNo sufficiently relevant chunks found")
		return
	}

	// Step 4 + 5: augment and generate.
	instructions, userInput := buildPrompt(question, top)
	fmt.Print("\nGenerating a grounded answer (Guarded Responses)...\n\n")
	result, err := generateAnswer(instructions, userInput)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
	answer := extractText(result)
	if answer == "" {
		answer = "(no text returned)"
	}

	fmt.Println(strings.Repeat("=", 80))
	fmt.Println("ANSWER")
	fmt.Println(strings.Repeat("=", 80))
	fmt.Println(answer)
	fmt.Println("\nSources used:")
	for _, c := range top {
		fmt.Printf("  - %s chunk %d\n", c.SourceFile, c.ChunkIndex)
	}
}

func tokenString(t *int) string {
	if t == nil {
		return "None"
	}
	return fmt.Sprintf("%d", *t)
}
