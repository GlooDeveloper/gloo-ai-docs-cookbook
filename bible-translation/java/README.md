# Working with Bible Translations, Reliably — Java

Java reference implementation for the Gloo AI docs cookbook recipe.

This CLI streams a response from the Gloo AI
[Guarded Responses API](https://docs.gloo.com/api-guides/responses) and replaces every
`{{SCRIPTURE:reference}}` placeholder with the actual verse text from
[bible.helloao.org](https://bible.helloao.org). This is the **output transform**
approach: every successfully substituted placeholder contains text returned by
the selected Bible API.

The placeholder instruction is still a system prompt, not a hard constraint.
A model could ignore it and include memorized Scripture in its commentary. For
high-assurance applications, validate responses before displaying them, reject
unexpected direct quotations, retry failures, or use schema-constrained output.

## Prerequisites

- Java 17+
- Maven 3.9+
- A [Gloo AI API key](https://studio.ai.gloo.com/api-keys)
- A free Bible API from [bible.helloao.org](https://bible.helloao.org) (no key required)

## Setup

```bash
cd gloo-ai-docs-cookbook/bible-translation/java

# Build the project
mvn compile

# Configure credentials
cp .env.example .env
# Edit .env and set GLOO_API_KEY
```

## Usage

Basic usage with default translation (BSB):

```bash
mvn exec:java -Dexec.args="Write a three-paragraph devotional reflection on John 3:16."
```

Specify a translation:

```bash
mvn exec:java -Dexec.args="Did Jesus come to condemn the world? --translation BSB"
```

Optionally specify a tradition (may conflict with the placeholder instructions):

```bash
mvn exec:java -Dexec.args="Did Jesus come to condemn the world? --tradition mainline --translation BSB"
```

## Choosing a Model

The Guarded Responses API takes a pinned model. This implementation uses
`gloo-openai-gpt-6-luna`, set in `Main.MODEL` in `src/main/java/com/gloo/bible/Main.java`.
To use a different model, change `Main.MODEL` to any generation model ID from
[Supported Models](https://docs.gloo.com/api-guides/supported-models), then
re-run the examples: how reliably a model follows the placeholder instruction
varies from model to model.

## How the Output Transform Works

1. The system prompt instructs the model to emit placeholders such as
   `{{SCRIPTURE:John 3:16}}` instead of quoting directly.
2. The CLI streams the Gloo AI response using Server-Sent Events (SSE), reading
   text from `response.output_text.delta` events.
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
- [Python](../python/)
- [PHP](../php/)
- [Go](../go/)
