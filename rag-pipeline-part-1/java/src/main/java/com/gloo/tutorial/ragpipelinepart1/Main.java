package com.gloo.tutorial.ragpipelinepart1;

import com.google.gson.Gson;
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
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Gloo AI RAG Pipeline - Part 1: Set Up the Pipeline (Java)
 *
 * <p>Uploads sample content to a publisher, enriches it with metadata, and polls the Data Engine
 * until the item is fully indexed.
 */
public class Main {

  private static final String API_ROOT = "https://platform.ai.gloo.com";
  private static final String TOKEN_URL = API_ROOT + "/oauth2/token";
  private static final String UPLOAD_URL = API_ROOT + "/ingestion/v2/files";
  private static final String ITEM_METADATA_URL = API_ROOT + "/engine/v2/item";
  private static final String ITEM_STATUS_URL = API_ROOT + "/engine/v2/items";

  private static final Path SAMPLE_FILE =
      Path.of("..", "sample_files", "building-stronger-communities.md");
  private static final String PRODUCER_ID = "rag-pipeline-part1-building-stronger-communities";

  // Polling configuration: ingestion is asynchronous and typically
  // takes several minutes (observed ~6 minutes for a small file).
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(15);
  private static final Duration POLL_TIMEOUT = Duration.ofSeconds(600);

  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final Gson GSON = new Gson();

  private static String clientId;
  private static String clientSecret;
  private static String publisherId;

  private static String accessToken;
  private static Instant tokenExpiresAt = Instant.EPOCH;

  public static void main(String[] args) {
    Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
    clientId = dotenv.get("GLOO_CLIENT_ID", "");
    clientSecret = dotenv.get("GLOO_CLIENT_SECRET", "");
    publisherId = dotenv.get("GLOO_PUBLISHER_ID", "");

    for (Map.Entry<String, String> entry :
        Map.of(
                "GLOO_CLIENT_ID", clientId,
                "GLOO_CLIENT_SECRET", clientSecret,
                "GLOO_PUBLISHER_ID", publisherId)
            .entrySet()) {
      if (entry.getValue().isEmpty()) {
        System.err.printf(
            "Error: %s must be set. Copy .env.example to .env and fill in your values.%n",
            entry.getKey());
        System.exit(1);
      }
    }

    try {
      System.out.println("Step 1: Uploading sample content...");
      String itemId = uploadFile(SAMPLE_FILE);

      System.out.println("\nStep 2: Setting item metadata...");
      setMetadata(itemId);

      System.out.println("\nStep 3: Verifying indexing (polling)...");
      JsonObject item = waitUntilIndexed(itemId);

      System.out.println("\nPipeline content is indexed and ready.");
      System.out.printf("  Item ID:  %s%n", item.get("item_id").getAsString());
      System.out.printf("  Title:    %s%n", item.get("item_title").getAsString());
      System.out.printf("  Author:   %s%n", joinJsonArray(item, "author"));
      System.out.printf("  Tags:     %s%n", joinJsonArray(item, "item_tags"));
      System.out.printf("  Status:   %s%n", item.get("status").getAsString());
      System.out.println(
          "\nNext: query this content with the Search API, or ask questions about it");
      System.out.println("with Grounded Completions (see the deep-dive recipes).");
    } catch (Exception e) {
      System.err.println("Error: " + e.getMessage());
      System.exit(1);
    }
  }

  /** Returns a valid access token, fetching a new one if needed. */
  private static String getToken() throws IOException, InterruptedException {
    if (Instant.now().isBefore(tokenExpiresAt.minusSeconds(60))) {
      return accessToken;
    }

    String basicAuth =
        Base64.getEncoder()
            .encodeToString((clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(TOKEN_URL))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("Authorization", "Basic " + basicAuth)
            .POST(
                HttpRequest.BodyPublishers.ofString(
                    "grant_type=client_credentials&scope=api/access"))
            .build();

    JsonObject token = sendChecked(request, "Token request");
    accessToken = token.get("access_token").getAsString();
    tokenExpiresAt = Instant.now().plusSeconds(token.get("expires_in").getAsLong());
    return accessToken;
  }

  /**
   * Uploads a single file and returns its item ID.
   *
   * <p>A stable producer_id makes re-runs idempotent: if the same content was already uploaded,
   * the API reports it as a duplicate and we reuse the existing item instead of creating a new
   * one.
   */
  private static String uploadFile(Path filePath) throws IOException, InterruptedException {
    String boundary = "----GlooBoundary" + UUID.randomUUID();
    byte[] body = buildMultipartBody(boundary, filePath);

    String url =
        UPLOAD_URL + "?producer_id=" + URLEncoder.encode(PRODUCER_ID, StandardCharsets.UTF_8);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + getToken())
            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
            .build();

    JsonObject result = sendChecked(request, "Upload");

    if (result.getAsJsonArray("ingesting").size() > 0) {
      String itemId = result.getAsJsonArray("ingesting").get(0).getAsString();
      System.out.println("  Queued for ingestion: " + itemId);
      return itemId;
    }
    if (result.getAsJsonArray("duplicates").size() > 0) {
      String itemId = result.getAsJsonArray("duplicates").get(0).getAsString();
      System.out.println("  Already ingested (duplicate detected), reusing item: " + itemId);
      return itemId;
    }
    throw new IOException("Unexpected upload response: " + result);
  }

  /** Builds a multipart/form-data body with the publisher ID field and one file part. */
  private static byte[] buildMultipartBody(String boundary, Path filePath) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    String lineEnd = "\r\n";

    out.write(("--" + boundary + lineEnd).getBytes(StandardCharsets.UTF_8));
    out.write(
        ("Content-Disposition: form-data; name=\"publisher_id\"" + lineEnd + lineEnd)
            .getBytes(StandardCharsets.UTF_8));
    out.write((publisherId + lineEnd).getBytes(StandardCharsets.UTF_8));

    out.write(("--" + boundary + lineEnd).getBytes(StandardCharsets.UTF_8));
    out.write(
        ("Content-Disposition: form-data; name=\"files\"; filename=\""
                + filePath.getFileName()
                + "\""
                + lineEnd)
            .getBytes(StandardCharsets.UTF_8));
    out.write(("Content-Type: text/markdown" + lineEnd + lineEnd).getBytes(StandardCharsets.UTF_8));
    out.write(Files.readAllBytes(filePath));
    out.write((lineEnd + "--" + boundary + "--" + lineEnd).getBytes(StandardCharsets.UTF_8));

    return out.toByteArray();
  }

  /** Attaches descriptive metadata to the uploaded item. */
  private static void setMetadata(String itemId) throws IOException, InterruptedException {
    List<String> tags = List.of("community", "service", "rag-pipeline-series");
    Map<String, Object> metadata =
        Map.of(
            "publisher_id", publisherId,
            "item_id", itemId,
            "item_title", "Building Stronger Communities Through Service",
            "item_summary",
                "Practical guidance for starting and sustaining community service efforts.",
            "author", List.of("Gloo AI Docs Team"),
            "item_tags", tags);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(ITEM_METADATA_URL))
            .header("Authorization", "Bearer " + getToken())
            .header("Content-Type", "application/json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(GSON.toJson(metadata)))
            .build();

    sendChecked(request, "Metadata update");
    System.out.printf("  Metadata set: title, summary, author, %d tags%n", tags.size());
  }

  /** Fetches current item metadata, including ingestion status. */
  private static JsonObject getItem(String itemId) throws IOException, InterruptedException {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(ITEM_STATUS_URL + "/" + itemId))
            .header("Authorization", "Bearer " + getToken())
            .GET()
            .build();
    return sendChecked(request, "Status check");
  }

  /** Polls item status until indexing completes or the timeout elapses. */
  private static JsonObject waitUntilIndexed(String itemId)
      throws IOException, InterruptedException {
    Instant deadline = Instant.now().plus(POLL_TIMEOUT);
    String lastStatus = null;

    while (Instant.now().isBefore(deadline)) {
      JsonObject item = getItem(itemId);
      String status = item.has("status") ? item.get("status").getAsString() : "unknown";

      if (!status.equals(lastStatus)) {
        System.out.println("  Status: " + status);
        lastStatus = status;
      }

      // Terminal states (observed: CHUNKING while processing, COMPLETED when done).
      if (status.equalsIgnoreCase("COMPLETED")) {
        return item;
      }
      if (status.equalsIgnoreCase("FAILED") || status.equalsIgnoreCase("ERROR")) {
        throw new IOException("Ingestion failed with status: " + status);
      }

      Thread.sleep(POLL_INTERVAL.toMillis());
    }

    throw new IOException(
        String.format(
            "Item %s not indexed within %ds (last status: %s)",
            itemId, POLL_TIMEOUT.toSeconds(), lastStatus));
  }

  /** Sends a request and parses the JSON response, treating HTTP >= 400 as an error. */
  private static JsonObject sendChecked(HttpRequest request, String label)
      throws IOException, InterruptedException {
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 400) {
      throw new IOException(
          String.format("%s failed: HTTP %d %s", label, response.statusCode(), response.body()));
    }
    return GSON.fromJson(response.body(), JsonObject.class);
  }

  private static String joinJsonArray(JsonObject item, String field) {
    StringBuilder sb = new StringBuilder();
    item.getAsJsonArray(field)
        .forEach(
            element -> {
              if (sb.length() > 0) {
                sb.append(", ");
              }
              sb.append(element.getAsString());
            });
    return sb.toString();
  }
}
