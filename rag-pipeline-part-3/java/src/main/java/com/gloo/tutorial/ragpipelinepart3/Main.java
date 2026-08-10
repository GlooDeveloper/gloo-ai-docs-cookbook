package com.gloo.tutorial.ragpipelinepart3;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import io.github.cdimascio.dotenv.Dotenv;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Gloo AI RAG Pipeline - Part 3: Verification, Error Handling & Resilience (Java)
 *
 * <p>Builds a small resilient API client and demonstrates three production concerns against the
 * Gloo AI Data Engine: interpreting structured API error responses, retrying transient failures
 * with exponential backoff, and verifying ingestion health while handling missing items gracefully.
 *
 * <p>There are no monitoring or health-check endpoints — resilience here is built from the same item
 * APIs used in Parts 1 and 2, plus disciplined error handling.
 */
public class Main {

  private static final String API_ROOT = "https://platform.ai.gloo.com";
  private static final String UPLOAD_URL = API_ROOT + "/ingestion/v2/files";
  private static final String ITEMS_URL = API_ROOT + "/engine/v2/items";

  private static final Path SAMPLE_DIR = Path.of("..", "sample_files");
  private static final List<String[]> SEED_ITEMS = List.of(
      new String[] {"strengthening-feedback-loops.md", "rag-pipeline-part3-feedback-loops"},
      new String[] {"learning-from-incidents.md", "rag-pipeline-part3-incident-reviews"});

  // Retry policy: only transient failures are retried. Client errors (400, 401, 403, 404, 422) are
  // bugs in the request, not blips, so they fail fast.
  private static final Set<Integer> RETRYABLE_STATUSES = Set.of(500, 502, 503, 504);
  private static final int MAX_RETRIES = 4;
  private static final long BASE_DELAY_SECONDS = 1;

  private static final Duration POLL_INTERVAL = Duration.ofSeconds(15);
  private static final Duration POLL_TIMEOUT = Duration.ofSeconds(600);

  private static final Map<Integer, String> REASONS = Map.of(
      400, "Bad Request", 401, "Unauthorized", 403, "Forbidden", 404, "Not Found",
      422, "Unprocessable Entity", 500, "Internal Server Error", 502, "Bad Gateway",
      503, "Service Unavailable", 504, "Gateway Timeout");

  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final Gson GSON = new Gson();

  private static String apiKey;
  private static String publisherId;

  /** A normalized API error: HTTP status (null for network failures), code, and message. */
  static class ApiError extends RuntimeException {
    final Integer status;
    final String code;

    ApiError(Integer status, String code, String message) {
      super(message);
      this.status = status;
      this.code = code;
    }

    boolean isRetryable() {
      return status == null || RETRYABLE_STATUSES.contains(status);
    }
  }

  /** A unit of work that may be retried; can throw ApiError (unchecked). */
  @FunctionalInterface
  interface Operation<T> {
    T run() throws InterruptedException;
  }

  record RequestOptions(Object json, String token) {
    static RequestOptions none() {
      return new RequestOptions(null, null);
    }
  }

  /** A thin HTTP client with structured error parsing and retry-with-backoff. */
  static class ResilientClient {
    private final String apiKey;

    ResilientClient(String apiKey) {
      this.apiKey = apiKey;
    }

    /** Extract [code, message] from the API's error shapes. */
    private String[] parseError(int status, String body) {
      String reason = REASONS.getOrDefault(status, "HTTP " + status);
      JsonObject obj = null;
      try {
        obj = GSON.fromJson(body, JsonObject.class);
      } catch (RuntimeException ignored) {
        // not a JSON object
      }
      if (obj != null) {
        JsonElement detail = obj.get("detail");
        if (detail != null && detail.isJsonObject()) {
          JsonObject d = detail.getAsJsonObject();
          return new String[] {jsonString(d, "code"), orReason(jsonString(d, "message"), reason)};
        }
        if (detail != null && detail.isJsonPrimitive()) {
          return new String[] {null, detail.getAsString()};
        }
        if (obj.has("error") || obj.has("message")) {
          return new String[] {jsonString(obj, "error"), orReason(jsonString(obj, "message"), reason)};
        }
      }
      String text = body == null ? "" : body.trim();
      if (text.isEmpty()) {
        text = reason;
      } else if (text.length() > 200) {
        text = text.substring(0, 200);
      }
      return new String[] {null, text};
    }

    private void backoff(int attempt, Integer status, String code) throws InterruptedException {
      long delay = BASE_DELAY_SECONDS * (1L << attempt);
      String label = status == null ? "network error" : String.valueOf(status);
      System.out.printf(
          "    Attempt %d failed (%s: %s); retrying in %ds%n", attempt + 1, label, code, delay);
      Thread.sleep(delay * 1000);
    }

    /** Send a request, retrying transient failures. Throws ApiError on non-retryable failures or exhausted retries. */
    JsonObject request(String method, String url, RequestOptions opts) throws InterruptedException {
      String payload = opts.json() != null ? GSON.toJson(opts.json()) : null;

      for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        String bearer = opts.token() != null ? opts.token() : apiKey;
        HttpRequest.Builder builder =
            HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + bearer)
                .header("Content-Type", "application/json")
                .method(method, payload != null
                    ? HttpRequest.BodyPublishers.ofString(payload)
                    : HttpRequest.BodyPublishers.noBody());

        HttpResponse<String> response;
        try {
          response = HTTP.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
          if (attempt < MAX_RETRIES) {
            backoff(attempt, null, "connection");
            continue;
          }
          throw new ApiError(null, "network_error", e.getMessage());
        }

        int status = response.statusCode();
        if (RETRYABLE_STATUSES.contains(status) && attempt < MAX_RETRIES) {
          String[] parsed = parseError(status, response.body());
          backoff(attempt, status, parsed[0]);
          continue;
        }
        if (status >= 400) {
          String[] parsed = parseError(status, response.body());
          throw new ApiError(status, parsed[0], parsed[1]);
        }
        return response.body().isEmpty() ? new JsonObject() : GSON.fromJson(response.body(), JsonObject.class);
      }
      throw new ApiError(null, "retries_exhausted", "Exhausted retries");
    }

    /** Run an operation, retrying it on retryable ApiError with backoff. */
    <T> T callWithRetry(Operation<T> operation, String label) throws InterruptedException {
      for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          return operation.run();
        } catch (ApiError e) {
          if (e.isRetryable() && attempt < MAX_RETRIES) {
            backoff(attempt, e.status, e.code);
            continue;
          }
          throw e;
        }
      }
      throw new ApiError(null, "retries_exhausted", "Exhausted retries for " + label);
    }

    /** Upload a single file, retrying transient failures (5xx or network blips). */
    String uploadFile(Path filePath, String producerId) throws IOException, InterruptedException {
      byte[] fileBytes = Files.readAllBytes(filePath);
      Operation<JsonObject> operation = () -> {
        try {
          String boundary = "----GlooBoundary" + UUID.randomUUID();
          ByteArrayOutputStream body = new ByteArrayOutputStream();
          body.write(("--" + boundary + "\r\n"
              + "Content-Disposition: form-data; name=\"publisher_id\"\r\n\r\n"
              + publisherId + "\r\n").getBytes(StandardCharsets.UTF_8));
          body.write(("--" + boundary + "\r\n"
              + "Content-Disposition: form-data; name=\"files\"; filename=\""
              + filePath.getFileName() + "\"\r\n"
              + "Content-Type: text/markdown\r\n\r\n").getBytes(StandardCharsets.UTF_8));
          body.write(fileBytes);
          body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

          HttpRequest request =
              HttpRequest.newBuilder()
                  .uri(URI.create(UPLOAD_URL + "?producer_id="
                      + URLEncoder.encode(producerId, StandardCharsets.UTF_8)))
                  .header("Authorization", "Bearer " + apiKey)
                  .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                  .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()))
                  .build();
          HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
          if (response.statusCode() >= 400) {
            String[] parsed = parseError(response.statusCode(), response.body());
            throw new ApiError(response.statusCode(), parsed[0], parsed[1]);
          }
          return GSON.fromJson(response.body(), JsonObject.class);
        } catch (IOException e) {
          throw new ApiError(null, "network_error", e.getMessage());
        }
      };
      JsonObject result = callWithRetry(operation, "upload");
      JsonArray ingesting = result.getAsJsonArray("ingesting");
      JsonArray ids = (ingesting != null && ingesting.size() > 0)
          ? ingesting : result.getAsJsonArray("duplicates");
      return ids.get(0).getAsString();
    }

    JsonObject getItem(String itemId) throws InterruptedException {
      return request("GET", ITEMS_URL + "/" + itemId, RequestOptions.none());
    }

    JsonObject deleteItems(List<String> itemIds) throws InterruptedException {
      return request("DELETE", ITEMS_URL, new RequestOptions(Map.of("item_ids", itemIds), null));
    }

    void waitUntilIndexed(List<String> itemIds) throws InterruptedException {
      Instant deadline = Instant.now().plus(POLL_TIMEOUT);
      List<String> pending = new ArrayList<>(itemIds);
      while (!pending.isEmpty() && Instant.now().isBefore(deadline)) {
        pending.removeIf(itemId -> {
          try {
            String status = getItem(itemId).get("status").getAsString().toUpperCase();
            if (status.equals("FAILED") || status.equals("ERROR")) {
              throw new ApiError(null, "ingestion_failed", itemId + ": " + status);
            }
            return status.equals("COMPLETED");
          } catch (InterruptedException e) {
            throw new RuntimeException(e);
          }
        });
        if (!pending.isEmpty()) {
          System.out.printf("  Waiting for %d item(s) to finish indexing...%n", pending.size());
          Thread.sleep(POLL_INTERVAL.toMillis());
        }
      }
      if (!pending.isEmpty()) {
        throw new ApiError(null, "ingestion_timeout", "Not indexed within timeout");
      }
    }
  }

  /** Trigger representative error responses and show the parsed result. */
  static void demoErrorHandling(ResilientClient client) throws InterruptedException {
    record Case(String label, String method, String url, RequestOptions opts) {}
    List<Case> cases = List.of(
        new Case("Missing item (random UUID)", "GET", ITEMS_URL + "/" + UUID.randomUUID(), RequestOptions.none()),
        new Case("Malformed item ID", "GET", ITEMS_URL + "/not-a-valid-uuid", RequestOptions.none()),
        new Case("Rejected bearer token", "GET", ITEMS_URL + "/" + UUID.randomUUID(),
            new RequestOptions(null, "invalid-token")));
    for (Case tc : cases) {
      try {
        client.request(tc.method(), tc.url(), tc.opts());
        System.out.println("  " + tc.label() + ": unexpectedly succeeded");
      } catch (ApiError e) {
        System.out.printf("  %s: status=%s code='%s' message='%s'%n",
            tc.label(), e.status, e.code, e.getMessage());
      }
    }
  }

  /** Show the backoff policy recovering from transient failures (simulated 503 twice). */
  static void demoRetry(ResilientClient client) throws InterruptedException {
    int[] calls = {0};
    Operation<JsonObject> flaky = () -> {
      calls[0]++;
      if (calls[0] < 3) {
        throw new ApiError(503, "service_unavailable", "Service temporarily unavailable");
      }
      JsonObject ok = new JsonObject();
      ok.addProperty("ok", true);
      return ok;
    };
    client.callWithRetry(flaky, "sample operation");
    System.out.println("  Succeeded after " + calls[0] + " attempts");
  }

  /** Upload a batch, confirm each item indexed, and report a health summary. */
  static void demoHealthCheck(ResilientClient client) throws IOException, InterruptedException {
    System.out.println("  Uploading and indexing a batch...");
    List<String> itemIds = new ArrayList<>();
    for (String[] seed : SEED_ITEMS) {
      itemIds.add(client.uploadFile(SAMPLE_DIR.resolve(seed[0]), seed[1]));
    }
    client.waitUntilIndexed(itemIds);

    List<String> toCheck = new ArrayList<>(itemIds);
    toCheck.add(UUID.randomUUID().toString());
    int completed = 0, pending = 0, failed = 0, notFound = 0;
    for (String itemId : toCheck) {
      try {
        String status = client.getItem(itemId).get("status").getAsString().toUpperCase();
        if (status.equals("COMPLETED")) {
          completed++;
        } else if (status.equals("FAILED") || status.equals("ERROR")) {
          failed++;
        } else {
          pending++;
        }
      } catch (ApiError e) {
        if (e.status != null && e.status == 404) {
          notFound++;
        } else {
          throw e;
        }
      }
    }
    System.out.printf("  Health: %d completed, %d pending, %d failed, %d not found%n",
        completed, pending, failed, notFound);

    client.deleteItems(itemIds);
    System.out.printf("  Cleaned up %d item(s)%n", itemIds.size());
  }

  public static void main(String[] args) {
    Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
    apiKey = dotenv.get("GLOO_API_KEY", "");
    publisherId = dotenv.get("GLOO_PUBLISHER_ID", "");

    for (Map.Entry<String, String> entry :
        Map.of("GLOO_API_KEY", apiKey,
                "GLOO_PUBLISHER_ID", publisherId).entrySet()) {
      if (entry.getValue().isEmpty()) {
        System.err.printf(
            "Error: %s must be set. Copy .env.example to .env and fill in your values.%n",
            entry.getKey());
        System.exit(1);
      }
    }

    try {
      ResilientClient client = new ResilientClient(apiKey);

      System.out.println("Step 1: Resilient client ready (error parsing, retry/backoff).");

      System.out.println("\nStep 2: Interpreting API error responses...");
      demoErrorHandling(client);

      System.out.println("\nStep 3: Retrying transient failures with backoff...");
      demoRetry(client);

      System.out.println("\nStep 4: Verifying ingestion health...");
      demoHealthCheck(client);

      System.out.println("\nDone. The resilient client handled errors, retries, and verification end to end.");
    } catch (ApiError e) {
      System.err.println("API error: " + e.getMessage());
      System.exit(1);
    } catch (Exception e) {
      System.err.println("Error: " + e.getMessage());
      System.exit(1);
    }
  }

  private static String jsonString(JsonObject obj, String key) {
    JsonElement el = obj.get(key);
    return el == null || el.isJsonNull() ? null : el.getAsString();
  }

  private static String orReason(String value, String reason) {
    return value == null || value.isEmpty() ? reason : value;
  }
}
