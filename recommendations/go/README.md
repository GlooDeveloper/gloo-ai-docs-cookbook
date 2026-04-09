# Recommendations API - Go

Go implementation of the [Building a Smart Resource Recommender](https://developer.gloo.com/tutorials/recommendations) tutorial.

## Prerequisites

- Go 1.20+
- A Gloo AI account with API credentials
- Content uploaded to the Data Engine

## Setup

1. **Install dependencies**:
   ```bash
   go mod tidy
   ```

2. **Configure credentials**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your Gloo AI credentials:
   - `GLOO_CLIENT_ID` — from the API Credentials page in Studio
   - `GLOO_CLIENT_SECRET` — from the API Credentials page in Studio
   - `GLOO_TENANT` — your publisher tenant name
   - `GLOO_COLLECTION` — content collection (default: `GlooProd`)

## Usage

### Publisher Recommendations (metadata only)
```bash
go run . base "How do I deal with anxiety?"
go run . base "parenting teenagers" 3
```

### Publisher Recommendations (with snippet previews)
```bash
go run . verbose "How do I deal with anxiety?"
go run . verbose "parenting teenagers" 3
```

### Affiliate Network Discovery
```bash
go run . affiliates "How do I deal with anxiety?"
go run . affiliates "parenting teenagers" 3
```

### Proxy Server (for the frontend example)
```bash
go run . server
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

## File Structure

| File | Description |
|---|---|
| `auth.go` | OAuth2 token management with automatic refresh |
| `main.go` | Config, types, API clients, command functions, entry point |
| `server.go` | HTTP proxy server for the frontend |
| `go.mod` | Module definition and dependencies |
| `.env.example` | Environment variable template |
