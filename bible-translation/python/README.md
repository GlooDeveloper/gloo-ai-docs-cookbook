# Working with Bible Translations, Reliably — Python

Python reference implementation for the Gloo AI docs cookbook recipe.

This CLI streams a response from the Gloo AI completions API and replaces every
`{{SCRIPTURE:reference}}` placeholder with the actual verse text from
[bible.helloao.org](https://bible.helloao.org). This is the **output transform**
approach: the model never writes verse text from memory, so the quoted text is
always the text returned by the Bible API.

## Prerequisites

- Python 3.7+
- A [Gloo AI API key](https://studio.ai.gloo.com/api-keys)
- A free Bible API from [bible.helloao.org](https://bible.helloao.org) (no key required)

## Setup

```bash
cd gloo-ai-docs-cookbook/bible-translation/python

# Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure credentials
cp .env.example .env
# Edit .env and set GLOO_API_KEY
```

## Usage

Basic usage with default translation (BSB):

```bash
python main.py "Give me a short devotional reflection on John 3:16."
```

Specify a translation:

```bash
python main.py "Did Jesus come to condemn the world?" --translation BSB
```

Optionally specify a tradition (may conflict with the placeholder instructions):

```bash
python main.py "Did Jesus come to condemn the world?" --tradition mainline --translation BSB
```

## How the Output Transform Works

1. The system prompt instructs the model to emit placeholders such as
   `{{SCRIPTURE:John 3:16}}` instead of quoting directly.
2. The CLI streams the Gloo AI response using Server-Sent Events (SSE).
3. A buffer accumulates the streaming text.
4. Whenever a complete placeholder is found, the harness:
   - emits the text before the placeholder,
   - fetches the verse(s) from `bible.helloao.org`,
   - emits the verse text with a citation,
   - removes the consumed text from the buffer and continues.
5. If the buffer ends with a possible placeholder prefix (for example, `{{`),
   that prefix is held back until the next chunk either completes or disproves
   the placeholder. After the stream ends, any leftover content is emitted
   as-is, so an incomplete placeholder remains visible rather than becoming
   corrupted scripture text.

## Sibling Implementations

This recipe is also available in other languages:

- [JavaScript](../javascript/)
- [TypeScript](../typescript/)
- [PHP](../php/)
- [Go](../go/)
- [Java](../java/)
