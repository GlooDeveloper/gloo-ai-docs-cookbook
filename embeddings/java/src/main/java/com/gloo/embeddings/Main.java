package com.gloo.embeddings;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import io.github.cdimascio.dotenv.Dotenv;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * Embeddings Recipe - Java Implementation
 *
 * <p>End-to-end semantic search (mini-RAG) with your own vectors, using the Gloo AI
 * Embeddings API instead of the Data Engine:
 *
 * <p>chunk a small corpus -&gt; embed every chunk in one batched call -&gt; embed the query
 * with the same model -&gt; rank chunks by cosine similarity -&gt; take the top-k above a
 * relevance threshold -&gt; feed the labeled chunks into a Guarded Responses call for a
 * cited answer.
 *
 * <p>Endpoints:
 *
 * <ul>
 *   <li>POST /ai/v2/direct/embeddings -&gt; vectors for your own vector store
 *   <li>POST /ai/v2/guarded/responses -&gt; guarded generation over the retrieved context
 * </ul>
 */
public class Main {

    // --- Configuration -------------------------------------------------------

    private static String apiKey;

    private static final String API_ROOT = "https://platform.ai.gloo.com";
    private static final String EMBEDDINGS_URL = API_ROOT + "/ai/v2/direct/embeddings";
    private static final String RESPONSES_URL = API_ROOT + "/ai/v2/guarded/responses";

    // Stay on one embedding model for both the corpus and the query: vectors from
    // different models are not comparable.
    private static final String EMBEDDING_MODEL = "gloo-openai-text-embedding-3-small";
    private static final String GENERATION_MODEL = "gloo-openai-gpt-6-luna";

    // Tuning knobs for retrieval.
    private static final int TOP_K = 3;
    private static final double RELEVANCE_THRESHOLD = 0.30;

    // Chunking target (Goldilocks range from the learning center).
    private static final int TARGET_CHUNK_WORDS = 150;

    private static final String DEFAULT_QUERY = "How does Bezalel choose its artists?";

    // Bounded exponential backoff for retryable 503s (attempt 1, 2, 3 -> 1s, 2s, 4s).
    private static final int MAX_ATTEMPTS = 3;

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    // --- Data types ----------------------------------------------------------

    /** A corpus chunk with its retrieval score. */
    private static final class Chunk {
        final String chunkId;
        final String sourceFile;
        final int chunkIndex;
        final String text;
        double score;

        Chunk(String chunkId, String sourceFile, int chunkIndex, String text) {
            this.chunkId = chunkId;
            this.sourceFile = sourceFile;
            this.chunkIndex = chunkIndex;
            this.text = text;
        }
    }

    // --- HTTP helpers --------------------------------------------------------

    private static String firstString(JsonObject object, String... keys) {
        for (String key : keys) {
            if (object.has(key) && !object.get(key).isJsonNull()) {
                return object.get(key).getAsString();
            }
        }
        return null;
    }

    /** Pull a human-readable message (and param, when present) out of an error body. */
    private static String errorDetail(String body) {
        JsonElement parsed;
        try {
            parsed = JsonParser.parseString(body);
        } catch (RuntimeException e) {
            String text = body == null ? "" : body.trim();
            return text.isEmpty() ? "(no response body)" : text;
        }

        JsonElement detail = parsed;
        if (parsed.isJsonObject() && parsed.getAsJsonObject().has("detail")) {
            detail = parsed.getAsJsonObject().get("detail");
        }

        if (detail.isJsonObject()) {
            JsonObject object = detail.getAsJsonObject();
            String message = firstString(object, "msg", "message");
            if (message == null) {
                message = object.toString();
            }
            if (object.has("param") && !object.get("param").isJsonNull()) {
                String param = object.get("param").getAsString();
                if (!param.isEmpty()) {
                    message = message + " (parameter: " + param + ")";
                }
            }
            return message;
        }

        if (detail.isJsonArray() && detail.getAsJsonArray().size() > 0) {
            JsonElement first = detail.getAsJsonArray().get(0);
            if (first.isJsonObject()) {
                JsonObject object = first.getAsJsonObject();
                String message = firstString(object, "msg", "message");
                if (message == null) {
                    message = object.toString();
                }
                String param = null;
                if (object.has("param") && !object.get("param").isJsonNull()) {
                    param = object.get("param").getAsString();
                }
                if ((param == null || param.isEmpty())
                        && object.has("loc") && object.get("loc").isJsonArray()
                        && object.getAsJsonArray("loc").size() > 0) {
                    JsonArray loc = object.getAsJsonArray("loc");
                    JsonElement last = loc.get(loc.size() - 1);
                    if (last.isJsonPrimitive()) {
                        param = last.getAsString();
                    }
                }
                if (param != null && !param.isEmpty()) {
                    message = message + " (parameter: " + param + ")";
                }
                return message;
            }
            return first.toString();
        }

        return detail.toString();
    }

    /**
     * POST with the recipe's shared error handling and 503 backoff.
     *
     * <p>Throws {@link RuntimeException} with a clear message. Returns the raw response body.
     * When {@code guardrail403} is set, a 403 is surfaced as a guardrails hard-block (the
     * guarded surface can refuse content) rather than an auth failure.
     */
    private static String post(String url, String jsonPayload, String context, boolean guardrail403)
            throws Exception {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .timeout(Duration.ofSeconds(60))
                    .build();

            HttpResponse<String> response;
            try {
                response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            } catch (Exception e) {
                throw new RuntimeException(context + " request failed: " + e.getMessage(), e);
            }

            int status = response.statusCode();
            String body = response.body() == null ? "" : response.body();

            if (status == 503) {
                boolean retryable = false;
                try {
                    JsonElement parsed = JsonParser.parseString(body);
                    if (parsed.isJsonObject() && parsed.getAsJsonObject().has("retryable")) {
                        retryable = parsed.getAsJsonObject().get("retryable").getAsBoolean();
                    }
                } catch (RuntimeException ignored) {
                    // Non-JSON body: treat as not retryable.
                }
                if (retryable && attempt < MAX_ATTEMPTS) {
                    int delay = 1 << (attempt - 1); // 1s, 2s, 4s
                    System.out.println("  " + context + ": provider unavailable (503, retryable) — "
                            + "retrying in " + delay + "s (attempt " + attempt + "/" + MAX_ATTEMPTS + ")");
                    Thread.sleep(delay * 1000L);
                    continue;
                }
                throw new RuntimeException(context + ": provider unavailable (503) after " + attempt
                        + " attempt(s): " + body.trim());
            }

            if (status == 400) {
                throw new RuntimeException(context + ": bad request (400) — fix the request. "
                        + errorDetail(body));
            }

            if (status == 403 && guardrail403) {
                throw new RuntimeException(context
                        + ": guardrails hard-blocked this request (403). " + errorDetail(body));
            }

            if (status == 401 || status == 403) {
                throw new RuntimeException(context + ": authentication/permission error (" + status
                        + ") — check GLOO_API_KEY and organization access. " + errorDetail(body));
            }

            if (status == 402 || status == 429) {
                throw new RuntimeException(context + ": spending limit or rate limit reached ("
                        + status + "). " + errorDetail(body));
            }

            if (status < 200 || status >= 300) {
                throw new RuntimeException(context + ": request failed with status " + status + ": "
                        + errorDetail(body));
            }

            return body;
        }

        // Unreachable: the loop either returns or throws.
        throw new RuntimeException(context + ": request failed after " + MAX_ATTEMPTS + " attempts");
    }

    // --- Corpus + chunking ---------------------------------------------------

    /** Split a file into paragraphs on blank-line boundaries. */
    private static List<String> loadParagraphs(Path path) throws Exception {
        List<String> paragraphs = new ArrayList<>();
        String content = Files.readString(path);
        for (String block : content.split("\n\n")) {
            String text = block.trim().replaceAll("\\s+", " ");
            if (!text.isEmpty()) {
                paragraphs.add(text);
            }
        }
        return paragraphs;
    }

    /**
     * Greedily pack consecutive paragraphs into ~TARGET_CHUNK_WORDS-word chunks.
     *
     * <p>Paragraphs are kept whole, so a dense paragraph can push a chunk over the target;
     * that is expected and visible in the output.
     */
    private static List<Chunk> chunkFile(Path path, String sourceFile) throws Exception {
        List<Chunk> chunks = new ArrayList<>();
        int currentWords = 0;
        List<String> currentParts = new ArrayList<>();
        int chunkIndex = 0;

        for (String paragraph : loadParagraphs(path)) {
            int wordCount = paragraph.isEmpty() ? 0 : paragraph.split("\\s+").length;
            if (!currentParts.isEmpty() && currentWords + wordCount > TARGET_CHUNK_WORDS) {
                chunks.add(new Chunk(sourceFile + "::" + chunkIndex, sourceFile, chunkIndex,
                        String.join("\n\n", currentParts)));
                chunkIndex++;
                currentParts = new ArrayList<>();
                currentWords = 0;
            }
            currentParts.add(paragraph);
            currentWords += wordCount;
        }

        if (!currentParts.isEmpty()) {
            chunks.add(new Chunk(sourceFile + "::" + chunkIndex, sourceFile, chunkIndex,
                    String.join("\n\n", currentParts)));
        }

        return chunks;
    }

    /** Chunk every .txt file in the content directory, in stable filename order. */
    private static List<Chunk> buildCorpus(Path contentDir, List<int[]> perFileCountsOut,
            List<String> perFileNamesOut) throws Exception {
        List<Path> files = new ArrayList<>();
        try (Stream<Path> stream = Files.list(contentDir)) {
            stream.filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().endsWith(".txt"))
                    .forEach(files::add);
        }
        files.sort(Comparator.comparing(p -> p.getFileName().toString()));

        if (files.isEmpty()) {
            throw new RuntimeException("No .txt files found in " + contentDir);
        }

        List<Chunk> corpus = new ArrayList<>();
        for (Path path : files) {
            String sourceFile = path.getFileName().toString();
            List<Chunk> fileChunks = chunkFile(path, sourceFile);
            perFileNamesOut.add(sourceFile);
            perFileCountsOut.add(new int[] {fileChunks.size()});
            corpus.addAll(fileChunks);
        }
        return corpus;
    }

    // --- Embeddings ----------------------------------------------------------

    private static final class EmbedResult {
        final List<double[]> vectors;
        final Integer promptTokens;
        final Integer totalTokens;

        EmbedResult(List<double[]> vectors, Integer promptTokens, Integer totalTokens) {
            this.vectors = vectors;
            this.promptTokens = promptTokens;
            this.totalTokens = totalTokens;
        }
    }

    /** One batched call: embed a list of strings with the shared model. */
    private static EmbedResult embed(List<String> texts, String context) throws Exception {
        if (texts.isEmpty()) {
            throw new RuntimeException(context + ": refusing to embed an empty input");
        }
        for (String text : texts) {
            if (text.trim().isEmpty()) {
                throw new RuntimeException(context + ": input contains an empty or whitespace string");
            }
        }

        JsonObject payload = new JsonObject();
        payload.addProperty("model", EMBEDDING_MODEL);
        JsonArray input = new JsonArray();
        for (String text : texts) {
            input.add(text);
        }
        payload.add("input", input);
        payload.addProperty("encoding_format", "float");

        String body = post(EMBEDDINGS_URL, payload.toString(), context, false);
        JsonObject result = JsonParser.parseString(body).getAsJsonObject();

        // The API returns one embedding per input, in order; sort by index to be safe.
        List<JsonObject> items = new ArrayList<>();
        JsonArray data = result.has("data") ? result.getAsJsonArray("data") : new JsonArray();
        for (JsonElement element : data) {
            items.add(element.getAsJsonObject());
        }
        items.sort(Comparator.comparingInt(item -> item.has("index") ? item.get("index").getAsInt() : 0));

        if (items.size() != texts.size()) {
            throw new RuntimeException(context + ": expected " + texts.size() + " embeddings, got "
                    + items.size());
        }

        List<double[]> vectors = new ArrayList<>();
        for (JsonObject item : items) {
            JsonArray embedding = item.getAsJsonArray("embedding");
            double[] vector = new double[embedding.size()];
            for (int i = 0; i < embedding.size(); i++) {
                vector[i] = embedding.get(i).getAsDouble();
            }
            vectors.add(vector);
        }

        Integer promptTokens = null;
        Integer totalTokens = null;
        if (result.has("usage") && !result.get("usage").isJsonNull()) {
            JsonObject usage = result.getAsJsonObject("usage");
            if (usage.has("prompt_tokens") && !usage.get("prompt_tokens").isJsonNull()) {
                promptTokens = usage.get("prompt_tokens").getAsInt();
            }
            if (usage.has("total_tokens") && !usage.get("total_tokens").isJsonNull()) {
                totalTokens = usage.get("total_tokens").getAsInt();
            }
        }
        return new EmbedResult(vectors, promptTokens, totalTokens);
    }

    // --- Retrieval -----------------------------------------------------------

    /** Dot(a, b) / (||a|| * ||b||). Explicitly normalized: vectors aren't unit length. */
    private static double cosineSimilarity(double[] a, double[] b) {
        double dot = 0.0;
        int n = Math.min(a.length, b.length);
        for (int i = 0; i < n; i++) {
            dot += a[i] * b[i];
        }
        double normA = 0.0;
        for (double x : a) {
            normA += x * x;
        }
        double normB = 0.0;
        for (double y : b) {
            normB += y * y;
        }
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        if (normA == 0 || normB == 0) {
            return 0.0;
        }
        return dot / (normA * normB);
    }

    private static List<Chunk> rankChunks(double[] queryVector, List<Chunk> corpus,
            List<double[]> vectors) {
        List<Chunk> ranked = new ArrayList<>(corpus);
        for (int i = 0; i < ranked.size(); i++) {
            ranked.get(i).score = cosineSimilarity(queryVector, vectors.get(i));
        }
        ranked.sort(Comparator.comparingDouble((Chunk c) -> c.score).reversed());
        return ranked;
    }

    // --- Augmentation --------------------------------------------------------

    /** Build the labeled-chunks prompt: instructions, then [Source: ...] context, then the question. */
    private static String[] buildPrompt(String question, List<Chunk> selected) {
        List<String> contextBlocks = new ArrayList<>();
        for (Chunk chunk : selected) {
            String label = "[Source: " + chunk.sourceFile + ", chunk " + chunk.chunkIndex + "]";
            contextBlocks.add(label + "\n" + chunk.text);
        }
        String context = String.join("\n\n", contextBlocks);

        String instructions = "You are an assistant for Bezalel Ministries. Answer the user's question "
                + "using only the context below. If the context does not contain enough "
                + "information to answer fully, say so. Cite the sources you use by their "
                + "[Source: ...] labels.";
        String userInput = "Context:\n---\n"
                + context + "\n"
                + "---\n"
                + "Question: " + question;
        return new String[] {instructions, userInput};
    }

    // --- Generation ----------------------------------------------------------

    /** Extract the assistant text from a Responses payload's output[] array. */
    private static String extractText(JsonObject result) {
        List<String> parts = new ArrayList<>();
        JsonArray output = result.has("output") ? result.getAsJsonArray("output") : new JsonArray();
        for (JsonElement element : output) {
            JsonObject item = element.getAsJsonObject();
            if (!item.has("type") || !"message".equals(item.get("type").getAsString())) {
                continue;
            }
            JsonArray content = item.has("content") ? item.getAsJsonArray("content") : new JsonArray();
            for (JsonElement contentElement : content) {
                JsonObject part = contentElement.getAsJsonObject();
                if (part.has("type") && "output_text".equals(part.get("type").getAsString())) {
                    parts.add(part.has("text") ? part.get("text").getAsString() : "");
                }
            }
        }
        return String.join("\n", parts);
    }

    /** One Guarded Responses call over the retrieved context. */
    private static JsonObject generateAnswer(String instructions, String userInput) throws Exception {
        JsonObject payload = new JsonObject();
        payload.addProperty("model", GENERATION_MODEL);
        payload.addProperty("instructions", instructions);
        payload.addProperty("input", userInput);
        payload.addProperty("max_output_tokens", 500);
        payload.addProperty("temperature", 0.2);
        // Uncomment to request a values-aligned answer for a specific tradition —
        // a Gloo capability the direct surface can't offer:
        // payload.addProperty("tradition", "evangelical");

        // A 403 here is surfaced as a guardrails hard-block, not an auth failure:
        // the guarded surface can refuse content.
        String body = post(RESPONSES_URL, payload.toString(), "Guarded Responses", true);
        return JsonParser.parseString(body).getAsJsonObject();
    }

    // --- Main ----------------------------------------------------------------

    private static String resolveQuery(String[] args) {
        if (args.length > 0) {
            // exec-maven-plugin splits -Dexec.args on whitespace, so rejoin every
            // token into a single query instead of using just the first word.
            String joined = String.join(" ", args).trim();
            if (!joined.isEmpty()) {
                return joined;
            }
        }
        if (System.console() == null) {
            return DEFAULT_QUERY;
        }
        String entered = System.console().readLine("Query [%s]: ", DEFAULT_QUERY);
        if (entered == null || entered.trim().isEmpty()) {
            return DEFAULT_QUERY;
        }
        return entered.trim();
    }

    private static String tokenString(Integer tokens) {
        return tokens == null ? "None" : String.valueOf(tokens);
    }

    public static void main(String[] args) throws Exception {
        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        apiKey = dotenv.get("GLOO_API_KEY");
        if (apiKey == null || apiKey.trim().isEmpty() || apiKey.equals("your_gloo_api_key_here")) {
            System.err.println("Missing GLOO_API_KEY. Set it in your environment or in a .env file "
                    + "(see .env.example).");
            System.exit(1);
        }

        System.out.println("=".repeat(80));
        System.out.println("  EMBEDDINGS RECIPE — semantic search with your own vector store");
        System.out.println("=".repeat(80));

        // Step 0/1: corpus + chunking.
        Path contentDir = Paths.get("..", "content");
        List<int[]> perFileCounts = new ArrayList<>();
        List<String> perFileNames = new ArrayList<>();
        List<Chunk> corpus = buildCorpus(contentDir, perFileCounts, perFileNames);

        System.out.printf("%nCorpus: %d chunks from %d files%n", corpus.size(), perFileNames.size());
        for (int i = 0; i < perFileNames.size(); i++) {
            System.out.printf("  %s: %d chunks%n", perFileNames.get(i), perFileCounts.get(i)[0]);
        }

        // Step 2: index every chunk in one batched embeddings call.
        System.out.printf("%nEmbedding %d chunks in one batched call (%s)...%n",
                corpus.size(), EMBEDDING_MODEL);
        List<String> chunkTexts = new ArrayList<>();
        for (Chunk chunk : corpus) {
            chunkTexts.add(chunk.text);
        }
        EmbedResult corpusEmbedding = embed(chunkTexts, "Embeddings (corpus)");
        if (corpusEmbedding.promptTokens != null || corpusEmbedding.totalTokens != null) {
            System.out.printf("  usage: prompt_tokens=%s total_tokens=%s%n",
                    tokenString(corpusEmbedding.promptTokens), tokenString(corpusEmbedding.totalTokens));
        }

        String question = resolveQuery(args);
        System.out.printf("%nQuery: %s%n", question);

        // Step 3: embed the query with the same model, then rank by cosine similarity.
        EmbedResult queryEmbedding = embed(Arrays.asList(question), "Embeddings (query)");
        double[] queryVector = queryEmbedding.vectors.get(0);
        if (queryEmbedding.promptTokens != null) {
            System.out.printf("  query usage: prompt_tokens=%s%n", tokenString(queryEmbedding.promptTokens));
        }

        List<Chunk> ranked = rankChunks(queryVector, corpus, corpusEmbedding.vectors);

        System.out.println("\nAll chunks ranked by cosine similarity:");
        for (int i = 0; i < ranked.size(); i++) {
            Chunk chunk = ranked.get(i);
            System.out.printf("  %3d. %.4f  %s chunk %d%n",
                    i + 1, chunk.score, chunk.sourceFile, chunk.chunkIndex);
        }

        List<Chunk> top = ranked.subList(0, Math.min(TOP_K, ranked.size()));
        System.out.printf("%nTop %d chunks (threshold %s):%n", TOP_K, RELEVANCE_THRESHOLD);
        for (Chunk chunk : top) {
            System.out.printf("  %.4f  %s chunk %d%n", chunk.score, chunk.sourceFile, chunk.chunkIndex);
        }

        // Relevance gate: don't confidently answer from irrelevant matches.
        if (top.isEmpty() || top.get(0).score < RELEVANCE_THRESHOLD) {
            System.out.println("\nNo sufficiently relevant chunks found");
            return;
        }

        // Step 4 + 5: augment and generate.
        String[] prompt = buildPrompt(question, top);
        System.out.print("\nGenerating a grounded answer (Guarded Responses)...\n\n");
        JsonObject result = generateAnswer(prompt[0], prompt[1]);
        String answer = extractText(result);
        if (answer.isEmpty()) {
            answer = "(no text returned)";
        }

        System.out.println("=".repeat(80));
        System.out.println("ANSWER");
        System.out.println("=".repeat(80));
        System.out.println(answer);
        System.out.println("\nSources used:");
        for (Chunk chunk : top) {
            System.out.printf("  - %s chunk %d%n", chunk.sourceFile, chunk.chunkIndex);
        }
    }
}
