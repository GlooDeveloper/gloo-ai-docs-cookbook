# Recommendations API - Java

Java implementation of the [Building a Smart Resource Recommender](https://developer.gloo.com/tutorials/recommendations) tutorial.

## Prerequisites

- Java 17+
- Maven 3.6+
- A Gloo AI account with API credentials
- Content uploaded to the Data Engine

## Setup

1. **Configure credentials**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your Gloo AI credentials:
   - `GLOO_CLIENT_ID` — from the API Credentials page in Studio
   - `GLOO_CLIENT_SECRET` — from the API Credentials page in Studio
   - `GLOO_TENANT` — your publisher tenant name
   - `GLOO_COLLECTION` — content collection (default: `GlooProd`)

2. **Compile**:
   ```bash
   mvn compile
   ```

## Usage

### Publisher Recommendations (metadata only)
```bash
mvn -q exec:java -Dexec.args='base "How do I deal with anxiety?"'
mvn -q exec:java -Dexec.args='base "parenting teenagers" 3'
```

### Publisher Recommendations (with snippet previews)
```bash
mvn -q exec:java -Dexec.args='verbose "How do I deal with anxiety?"'
mvn -q exec:java -Dexec.args='verbose "parenting teenagers" 3'
```

### Affiliate Network Discovery
```bash
mvn -q exec:java -Dexec.args='affiliates "How do I deal with anxiety?"'
mvn -q exec:java -Dexec.args='affiliates "parenting teenagers" 3'
```

### Proxy Server (for the frontend example)
```bash
mvn -q exec:java -Dexec.args='server'
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

## File Structure

| File | Description |
|---|---|
| `src/.../TokenManager.java` | OAuth2 token management with automatic refresh |
| `src/.../AppConfig.java` | Environment variable loading and URL constants |
| `src/.../Main.java` | API clients, command functions, and entry point |
| `src/.../Server.java` | HTTP proxy server for the frontend |
| `pom.xml` | Maven build configuration and dependencies |
| `.env.example` | Environment variable template |
