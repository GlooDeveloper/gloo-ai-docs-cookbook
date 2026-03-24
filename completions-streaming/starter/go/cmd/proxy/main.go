package main

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"

	"completions-streaming/pkg/proxy"
)

func main() {
	if err := godotenv.Load(); err != nil {
		fmt.Println("⚠️  No .env file found, using existing environment variables")
	}

	port := os.Getenv("PROXY_PORT")
	if port == "" {
		port = "3001"
	}

	addr := "127.0.0.1:" + port
	fmt.Printf("Proxy server starting at http://%s\n", addr)
	if err := proxy.StartServer(addr); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}
