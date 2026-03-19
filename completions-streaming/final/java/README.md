# Streaming AI Responses in Real Time — Java

Java 21 implementation of real-time SSE streaming with the Gloo AI completions API.

## Setup

```bash
mvn package
cp .env.example .env
# Edit .env with your credentials (or export env vars)
```

## Run

```bash
# Set credentials in environment
export GLOO_CLIENT_ID=your_client_id
export GLOO_CLIENT_SECRET=your_client_secret

# Run the fat jar
java -jar target/completions-streaming-1.0.0.jar
```

## Proxy server (Track B)

```bash
java -cp target/completions-streaming-1.0.0.jar com.gloo.streaming.proxy.ProxyServer
```

## Structure

```
java/
├── src/main/java/com/gloo/streaming/
│   ├── Main.java                         # Entry point
│   ├── auth/TokenManager.java            # OAuth2 token management
│   ├── streaming/StreamClient.java       # SSE parsing + accumulation
│   ├── browser/Renderer.java             # Typing-effect CLI demo
│   └── proxy/ProxyServer.java            # HttpExchange chunked SSE proxy
└── pom.xml
```
