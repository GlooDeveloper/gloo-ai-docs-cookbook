package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: go run . <prompt> [--tradition <value>] [--translation <id>]")
		os.Exit(1)
	}
	prompt := os.Args[1]
	var tradition, translation string
	for i := 2; i < len(os.Args); i++ {
		switch os.Args[i] {
		case "--tradition":
			if i+1 < len(os.Args) {
				tradition = os.Args[i+1]
				i++
			}
		case "--translation":
			if i+1 < len(os.Args) {
				translation = os.Args[i+1]
				i++
			}
		}
	}
	if translation == "" {
		translation = "BSB"
	}

	if err := godotenv.Load(); err != nil {
		// .env file is optional; environment variables take precedence.
	}
	apiKey := os.Getenv("GLOO_API_KEY")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "Error: GLOO_API_KEY is not set. Get your API key from https://studio.ai.gloo.com/api-keys and add it to your environment or .env file.")
		os.Exit(1)
	}

	bodyBytes, err := BuildRequestBody(prompt, tradition)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to build request body: %v\n", err)
		os.Exit(1)
	}

	req, err := http.NewRequest(http.MethodPost, glooAPIURL, bytes.NewReader(bodyBytes))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to build request: %v\n", err)
		os.Exit(1)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to connect to Gloo AI API: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		// Surface the API's own reason, e.g. "Unknown model ..." for a bad model.
		raw, _ := io.ReadAll(resp.Body)
		detail := string(raw)
		var apiErr struct {
			Detail struct {
				Message string `json:"message"`
			} `json:"detail"`
		}
		if json.Unmarshal(raw, &apiErr) == nil && apiErr.Detail.Message != "" {
			detail = apiErr.Detail.Message
		}
		fmt.Fprintf(os.Stderr, "Error: Gloo AI API returned HTTP %d: %s\n", resp.StatusCode, detail)
		os.Exit(1)
	}

	if err := StreamWithSubstitution(resp.Body, translation,
		func(reference, translation string) (string, error) {
			return FetchBibleVerse(reference, translation, http.DefaultClient)
		},
		func(s string) {
			fmt.Print(s)
		},
		func(s string) {
			fmt.Fprint(os.Stderr, s)
		},
	); err != nil {
		fmt.Fprintf(os.Stderr, "\nError: streaming failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println()
}
