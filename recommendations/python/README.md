# Recommendations API - Python

Python implementation of the [Building a Smart Resource Recommender](https://developer.gloo.com/tutorials/recommendations) tutorial.

## Prerequisites

- Python 3.9+
- A Gloo AI account with API credentials
- Content uploaded to the Data Engine

## Setup

1. **Create a virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure credentials**:
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
python recommend_base.py "How do I deal with anxiety?"
python recommend_base.py "parenting teenagers" 3
```

### Publisher Recommendations (with snippet previews)
```bash
python recommend_verbose.py "How do I deal with anxiety?"
python recommend_verbose.py "parenting teenagers" 3
```

### Affiliate Network Discovery
```bash
python recommend_affiliates.py "How do I deal with anxiety?"
python recommend_affiliates.py "parenting teenagers" 3
```

### Proxy Server (for the frontend example)
```bash
python server.py
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

## File Structure

| File | Description |
|---|---|
| `auth.py` | OAuth2 token management with automatic refresh |
| `config.py` | Environment variable loading and URL constants |
| `recommend_base.py` | Base recommendations CLI (no snippet text) |
| `recommend_verbose.py` | Verbose recommendations CLI (with snippet text) |
| `recommend_affiliates.py` | Affiliate network discovery CLI |
| `server.py` | Flask proxy server for the frontend |
| `requirements.txt` | Python dependencies |
| `.env.example` | Environment variable template |
