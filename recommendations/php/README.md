# Recommendations API - PHP

PHP implementation of the [Building a Smart Resource Recommender](https://developer.gloo.com/tutorials/recommendations) tutorial.

## Prerequisites

- PHP 8.1+
- Composer
- A Gloo AI account with API credentials
- Content uploaded to the Data Engine

## Setup

1. **Install dependencies**:
   ```bash
   composer install
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
php recommend_base.php "How do I deal with anxiety?"
php recommend_base.php "parenting teenagers" 3
```

### Publisher Recommendations (with snippet previews)
```bash
php recommend_verbose.php "How do I deal with anxiety?"
php recommend_verbose.php "parenting teenagers" 3
```

### Affiliate Network Discovery
```bash
php recommend_affiliates.php "How do I deal with anxiety?"
php recommend_affiliates.php "parenting teenagers" 3
```

### Proxy Server (for the frontend example)
```bash
php -S localhost:3000 server.php
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

## File Structure

| File | Description |
|---|---|
| `auth.php` | OAuth2 token management with automatic refresh |
| `config.php` | Environment variable loading and URL constants |
| `recommend_base.php` | Base recommendations CLI (no snippet text) |
| `recommend_verbose.php` | Verbose recommendations CLI (with snippet text) |
| `recommend_affiliates.php` | Affiliate network discovery CLI |
| `server.php` | PHP built-in server proxy for the frontend |
| `composer.json` | Dependencies |
| `.env.example` | Environment variable template |
