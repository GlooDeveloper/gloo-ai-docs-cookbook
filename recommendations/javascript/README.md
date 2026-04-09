# Recommendations API - JavaScript

JavaScript implementation of the [Building a Smart Resource Recommender](https://developer.gloo.com/tutorials/recommendations) tutorial.

## Prerequisites

- Node.js 18+
- A Gloo AI account with API credentials
- Content uploaded to the Data Engine

## Setup

1. **Install dependencies**:
   ```bash
   npm install
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
node recommend-base.js "How do I deal with anxiety?"
node recommend-base.js "parenting teenagers" 3
```

### Publisher Recommendations (with snippet previews)
```bash
node recommend-verbose.js "How do I deal with anxiety?"
node recommend-verbose.js "parenting teenagers" 3
```

### Affiliate Network Discovery
```bash
node recommend-affiliates.js "How do I deal with anxiety?"
node recommend-affiliates.js "parenting teenagers" 3
```

### Proxy Server (for the frontend example)
```bash
node server.js
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

## File Structure

| File | Description |
|---|---|
| `auth.js` | OAuth2 token management with automatic refresh |
| `config.js` | Environment variable loading and URL constants |
| `recommend-base.js` | Base recommendations CLI (no snippet text) |
| `recommend-verbose.js` | Verbose recommendations CLI (with snippet text) |
| `recommend-affiliates.js` | Affiliate network discovery CLI |
| `server.js` | Express proxy server for the frontend |
| `package.json` | Dependencies and npm scripts |
| `.env.example` | Environment variable template |
