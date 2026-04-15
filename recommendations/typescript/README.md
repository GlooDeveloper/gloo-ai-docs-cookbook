# Recommendations API - TypeScript

TypeScript implementation of the [Building a Smart Resource Recommender](https://developer.gloo.com/tutorials/recommendations) tutorial.

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
npx ts-node recommend-base.ts "How do I deal with anxiety?"
npx ts-node recommend-base.ts "parenting teenagers" 3
```

### Publisher Recommendations (with snippet previews)
```bash
npx ts-node recommend-verbose.ts "How do I deal with anxiety?"
npx ts-node recommend-verbose.ts "parenting teenagers" 3
```

### Affiliate Network Discovery
```bash
npx ts-node recommend-affiliates.ts "How do I deal with anxiety?"
npx ts-node recommend-affiliates.ts "parenting teenagers" 3
```

### Proxy Server (for the frontend example)
```bash
npx ts-node server.ts
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

## File Structure

| File | Description |
|---|---|
| `auth.ts` | OAuth2 token management with automatic refresh |
| `config.ts` | Environment variable loading and URL constants |
| `recommend-base.ts` | Base recommendations CLI (no snippet text) |
| `recommend-verbose.ts` | Verbose recommendations CLI (with snippet text) |
| `recommend-affiliates.ts` | Affiliate network discovery CLI |
| `server.ts` | Express proxy server for the frontend |
| `package.json` | Dependencies and npm scripts |
| `tsconfig.json` | TypeScript compiler configuration |
| `.env.example` | Environment variable template |
