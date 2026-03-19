# Streaming AI Responses in Real Time — PHP

PHP implementation of real-time SSE streaming with the Gloo AI completions API.

## Setup

```bash
composer install
cp .env.example .env
# Edit .env with your credentials
```

## Run

```bash
composer start
# or: php src/index.php
```

## Proxy server (Track B)

```bash
composer proxy
# or: php -S localhost:3001 src/Proxy/Server.php
```

## Structure

```
php/
├── src/
│   ├── index.php                 # Entry point
│   ├── Auth/TokenManager.php     # OAuth2 token management
│   ├── Streaming/StreamClient.php  # SSE parsing + accumulation
│   ├── Browser/Renderer.php      # Typing-effect CLI demo
│   └── Proxy/Server.php          # ob_flush SSE proxy
└── composer.json
```
