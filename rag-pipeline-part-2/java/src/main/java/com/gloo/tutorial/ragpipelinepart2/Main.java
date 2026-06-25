package com.gloo.tutorial.ragpipelinepart2;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
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
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Gloo AI RAG Pipeline - Part 2: Content Lifecycle (Java)
 *
 * <p>Seeds a small set of items, then demonstrates the content lifecycle: update a single item,
 * bulk-edit several items, verify the changes, and delete the items (cleanup). Every mutation is
 * scoped to the exact item IDs this recipe created — captured from the upload responses — so it
 * never touches other content in the publisher.
 */
public class Main {

  private static final String API_ROOT = "https://platform.ai.gloo.com";
  private static final String TOKEN_URL = API_ROOT + "/oauth2/token";
  private static final String UPLOAD_URL = API_ROOT + "/ingestion/v2/files";
  private static final String ITEM_URL = API_ROOT + "/engine/v2/item"; // single-item update (PATCH)
  private static final String ITEMS_URL = API_ROOT + "/engine/v2/items"; // bulk patch, delete

  private static final Path SAMPLE_DIR = Path.of("..", "sample_files");

  // Ingestion is asynchronous and typically takes several minutes.
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(15);
  private static final Duration POLL_TIMEOUT = Duration.ofSeconds(600);

  // Edits succeed immediately, but the read path is eventually consistent: a freshly patched item
  // can take a few seconds to reflect the change on a subsequent GET. Verification re-fetches until
  // the change is visible.
  private static final int VERIFY_ATTEMPTS = 20;
  private static final Duration VERIFY_INTERVAL = Duration.ofSeconds(3);

  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final Gson GSON = new Gson();

  private static String clientId;
  private static String clientSecret;
  private static String publisherId;

  private static String accessToken;
  private static Instant tokenExpiresAt = Instant.EPOCH;

  /** One piece of content this recipe manages. */
  record SeedItem(
      String file,
      String producerId,
      String itemTitle,
      String itemSummary,
      List<String> author,
      List<String> itemTags) {}

  private static List<SeedItem> seedItems() {
    return List.of(
        new SeedItem(
            "volunteer-onboarding.md",
            "rag-pipeline-part2-volunteer-onboarding",
            "Onboarding New Volunteers",
            "How a warm, organized welcome turns newcomers into committed volunteers.",
            List.of("Gloo AI Docs Team"),
            List.of("volunteers", "rag-pipeline-series")),
        new SeedItem(
            "measuring-community-impact.md",
            "rag-pipeline-part2-measuring-impact",
            "Measuring Community Impact",
            "Why measuring outcomes, not activity, sustains community programs.",
            List.of("Gloo AI Docs Team"),
            List.of("measurement", "rag-pipeline-series")),
        new SeedItem(
            "sustaining-engagement.md",
            "rag-pipeline-part2-sustaining-engagement",
            "Sustaining Long-Term Engagement",
            "Practices that keep volunteers engaged through the long haul.",
            List.of("Gloo AI Docs Team"),
            List.of("engagement", "rag-pipeline-series")));
  }

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
      List<SeedItem> seeds = seedItems();

      System.out.println("Step 1: Seeding sample content...");
      // Capture each item's ID from its upload response — the authoritative handle we scope every
      // later operation to.
      Map<String, String> mapping = new LinkedHashMap<>();
      List<String> itemIds = new ArrayList<>();
      for (SeedItem item : seeds) {
        String itemId = uploadFile(SAMPLE_DIR.resolve(item.file()), item.producerId());
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("item_title", item.itemTitle());
        metadata.put("item_summary", item.itemSummary());
        metadata.put("author", item.author());
        metadata.put("item_tags", item.itemTags());
        setMetadata(itemId, metadata);
        mapping.put(item.producerId(), itemId);
        itemIds.add(itemId);
        System.out.printf("  Uploaded %s -> %s%n", item.producerId(), itemId);
      }
      System.out.println("  Waiting for ingestion to complete (this can take a few minutes)...");
      waitUntilIndexed(itemIds);
      System.out.println("  All seed items indexed.");

      System.out.println("\nStep 2: Updating a single item...");
      String targetProducer = "rag-pipeline-part2-volunteer-onboarding";
      Map<String, Object> singleUpdate = new LinkedHashMap<>();
      singleUpdate.put("item_title", "Onboarding New Volunteers: A First-Day Playbook");
      singleUpdate.put(
          "item_summary",
          "A practical first-day checklist for welcoming and retaining new volunteers.");
      setMetadata(mapping.get(targetProducer), singleUpdate);
      System.out.printf("  Updated title and summary for %s%n", targetProducer);

      System.out.println("\nStep 3: Bulk-editing all seeded items...");
      String reviewTag = "reviewed-q2-2026";
      JsonObject result =
          bulkPatch(
              itemIds,
              List.of(
                  Map.of("op", "append", "field", "item_tags", "value", List.of(reviewTag)),
                  Map.of(
                      "op", "replace", "field", "author", "value",
                      List.of("Community Programs Team"))));
      System.out.printf(
          "  Matched %d, patched %d, failed %d%n",
          result.get("total_matched").getAsInt(),
          result.get("total_patched").getAsInt(),
          result.get("total_failed").getAsInt());

      System.out.println("\nStep 4: Verifying changes...");
      for (SeedItem item : seeds) {
        JsonObject got = getItemWithTag(mapping.get(item.producerId()), reviewTag);
        System.out.printf("  %s%n", got.get("item_title").getAsString());
        System.out.printf("    author: %s%n", joinJsonArray(got, "author"));
        System.out.printf("    tags:   %s%n", joinJsonArray(got, "item_tags"));
      }

      System.out.println("\nStep 5: Deleting items (cleanup)...");
      JsonObject deletion = deleteItems(itemIds);
      System.out.printf(
          "  Requested %d, deleted %d, failed %d%n",
          deletion.get("total_requested").getAsInt(),
          deletion.get("total_deleted").getAsInt(),
          deletion.get("total_failed").getAsInt());
      boolean allGone = true;
      for (String id : itemIds) {
        allGone = waitUntilDeleted(id) && allGone;
      }
      System.out.printf("  All items confirmed deleted: %b%n", allGone);
      System.out.println("\nLifecycle complete. The publisher is back to its pre-recipe state.");
    } catch (Exception e) {
      System.err.println("Error: " + e.getMessage());
      System.exit(1);
    }
  }

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
            .POST(HttpRequest.BodyPublishers.ofString("grant_type=client_credentials&scope=api/access"))
            .build();
    JsonObject token = sendForObject(request, "Token request");
    accessToken = token.get("access_token").getAsString();
    tokenExpiresAt = Instant.now().plusSeconds(token.get("expires_in").getAsLong());
    return accessToken;
  }

  /**
   * Upload a single file under a stable producer ID; return its item ID. The upload response is the
   * authoritative source of the item ID — keep it.
   */
  private static String uploadFile(Path filePath, String producerId)
      throws IOException, InterruptedException {
    String boundary = "----GlooBoundary" + UUID.randomUUID();
    ByteArrayOutputStream body = new ByteArrayOutputStream();
    body.write(("--" + boundary + "\r\n"
            + "Content-Disposition: form-data; name=\"publisher_id\"\r\n\r\n"
            + publisherId + "\r\n").getBytes(StandardCharsets.UTF_8));
    body.write(("--" + boundary + "\r\n"
            + "Content-Disposition: form-data; name=\"files\"; filename=\""
            + filePath.getFileName() + "\"\r\n"
            + "Content-Type: text/markdown\r\n\r\n").getBytes(StandardCharsets.UTF_8));
    body.write(Files.readAllBytes(filePath));
    body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(UPLOAD_URL + "?producer_id="
                + URLEncoder.encode(producerId, StandardCharsets.UTF_8)))
            .header("Authorization", "Bearer " + getToken())
            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()))
            .build();

    JsonObject result = sendForObject(request, "Upload");
    JsonArray ingesting = result.getAsJsonArray("ingesting");
    JsonArray ids = (ingesting != null && ingesting.size() > 0)
        ? ingesting
        : result.getAsJsonArray("duplicates");
    if (ids == null || ids.size() == 0) {
      throw new IOException("Unexpected upload response: " + result);
    }
    return ids.get(0).getAsString();
  }

  /** Set metadata on a single item via PATCH /engine/v2/item. */
  private static void setMetadata(String itemId, Map<String, Object> fields)
      throws IOException, InterruptedException {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("publisher_id", publisherId);
    payload.put("item_id", itemId);
    payload.putAll(fields);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(ITEM_URL))
            .header("Authorization", "Bearer " + getToken())
            .header("Content-Type", "application/json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(GSON.toJson(payload)))
            .build();
    sendForObject(request, "Metadata update");
  }

  /** Fetch current item metadata, including ingestion status. */
  private static JsonObject getItem(String itemId) throws IOException, InterruptedException {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(ITEMS_URL + "/" + itemId))
            .header("Authorization", "Bearer " + getToken())
            .GET()
            .build();
    return sendForObject(request, "Get item");
  }

  /** Return true while the item can still be fetched (false once deleted). */
  private static boolean itemExists(String itemId) throws IOException, InterruptedException {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(ITEMS_URL + "/" + itemId))
            .header("Authorization", "Bearer " + getToken())
            .GET()
            .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() == 404) {
      return false;
    }
    if (response.statusCode() >= 400) {
      throw new IOException("Get item failed: HTTP " + response.statusCode() + " " + response.body());
    }
    return true;
  }

  /** Poll until every item reaches COMPLETED or the timeout elapses. */
  private static void waitUntilIndexed(List<String> itemIds)
      throws IOException, InterruptedException {
    Instant deadline = Instant.now().plus(POLL_TIMEOUT);
    List<String> pending = new ArrayList<>(itemIds);

    while (!pending.isEmpty() && Instant.now().isBefore(deadline)) {
      pending.removeIf(
          itemId -> {
            try {
              String status = getItem(itemId).get("status").getAsString().toUpperCase();
              if (status.equals("FAILED") || status.equals("ERROR")) {
                throw new IllegalStateException("Ingestion failed for " + itemId + ": " + status);
              }
              return status.equals("COMPLETED");
            } catch (IOException | InterruptedException e) {
              throw new RuntimeException(e);
            }
          });
      if (!pending.isEmpty()) {
        System.out.printf("  Waiting for %d item(s) to finish indexing...%n", pending.size());
        Thread.sleep(POLL_INTERVAL.toMillis());
      }
    }
    if (!pending.isEmpty()) {
      throw new IOException("Items not indexed within timeout: " + pending);
    }
  }

  /** Apply patch operations to a specific set of items (scoped by item_ids). */
  private static JsonObject bulkPatch(List<String> itemIds, List<Map<String, Object>> ops)
      throws IOException, InterruptedException {
    Map<String, Object> payload =
        Map.of("filter", Map.of("item_ids", itemIds), "ops", ops);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(ITEMS_URL + "?publisher_id="
                + URLEncoder.encode(publisherId, StandardCharsets.UTF_8)))
            .header("Authorization", "Bearer " + getToken())
            .header("Content-Type", "application/json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(GSON.toJson(payload)))
            .build();
    return sendForObject(request, "Bulk patch");
  }

  /** Delete a specific set of items by ID. */
  private static JsonObject deleteItems(List<String> itemIds)
      throws IOException, InterruptedException {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(ITEMS_URL))
            .header("Authorization", "Bearer " + getToken())
            .header("Content-Type", "application/json")
            .method("DELETE", HttpRequest.BodyPublishers.ofString(
                GSON.toJson(Map.of("item_ids", itemIds))))
            .build();
    return sendForObject(request, "Delete");
  }

  /** Re-fetch an item until the given tag is visible (read-after-write retry). */
  private static JsonObject getItemWithTag(String itemId, String tag)
      throws IOException, InterruptedException {
    JsonObject item = getItem(itemId);
    for (int attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
      if (joinJsonArray(item, "item_tags").contains(tag)) {
        return item;
      }
      Thread.sleep(VERIFY_INTERVAL.toMillis());
      item = getItem(itemId);
    }
    return item;
  }

  /** Re-check until the item is gone (GET returns 404), or attempts run out. */
  private static boolean waitUntilDeleted(String itemId) throws IOException, InterruptedException {
    for (int attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
      if (!itemExists(itemId)) {
        return true;
      }
      Thread.sleep(VERIFY_INTERVAL.toMillis());
    }
    return false;
  }

  /** Send a request and parse the JSON object response, treating HTTP >= 400 as an error. */
  private static JsonObject sendForObject(HttpRequest request, String label)
      throws IOException, InterruptedException {
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 400) {
      throw new IOException(
          String.format("%s failed: HTTP %d %s", label, response.statusCode(), response.body()));
    }
    return GSON.fromJson(response.body(), JsonObject.class);
  }

  private static String joinJsonArray(JsonObject item, String field) {
    JsonArray array = item.getAsJsonArray(field);
    if (array == null) {
      return "";
    }
    List<String> values = new ArrayList<>();
    array.forEach(element -> values.add(element.getAsString()));
    return String.join(", ", values);
  }
}
