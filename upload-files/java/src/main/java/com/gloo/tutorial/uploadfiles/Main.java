package com.gloo.tutorial.uploadfiles;

import io.github.cdimascio.dotenv.Dotenv;
import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.io.*;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Gloo AI Upload Files - Java Example
 *
 * This program demonstrates how to use the Gloo AI Data Engine Files API
 * to upload files directly for processing and AI-powered search.
 */
public class Main {

    // --- Configuration ---
    private static final Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
    private static final String CLIENT_ID = dotenv.get("GLOO_CLIENT_ID", "YOUR_CLIENT_ID");
    private static final String CLIENT_SECRET = dotenv.get("GLOO_CLIENT_SECRET", "YOUR_CLIENT_SECRET");
    private static final String PUBLISHER_ID = dotenv.get("GLOO_PUBLISHER_ID", "your-publisher-id");

    private static final String TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
    private static final String UPLOAD_URL = "https://platform.ai.gloo.com/ingestion/v2/files";
    private static final String METADATA_URL = "https://platform.ai.gloo.com/engine/v2/item";

    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(".txt", ".md", ".pdf", ".doc", ".docx");

    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    private static final Gson gson = new Gson();

    // --- State Management ---
    private static TokenInfo tokenInfo;

    static {
        // Validate credentials
        if ("YOUR_CLIENT_ID".equals(CLIENT_ID) || "YOUR_CLIENT_SECRET".equals(CLIENT_SECRET) ||
                CLIENT_ID == null || CLIENT_ID.isEmpty() ||
                CLIENT_SECRET == null || CLIENT_SECRET.isEmpty()) {
            System.err.println("Error: GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be set");
            System.out.println("Create a .env file with your credentials:");
            System.out.println("GLOO_CLIENT_ID=your_client_id_here");
            System.out.println("GLOO_CLIENT_SECRET=your_client_secret_here");
            System.out.println("GLOO_PUBLISHER_ID=your_publisher_id_here");
            System.exit(1);
        }
    }

    // --- Types ---
    static class TokenInfo {
        String access_token;
        int expires_in;
        long expires_at;
        String token_type;
    }

    static class UploadResponse {
        boolean success;
        String message;
        List<String> ingesting;
        List<String> duplicates;
    }

    static class MetadataResponse {
        boolean success;
        String message;
    }

    /**
     * Get a new access token from the OAuth2 endpoint.
     */
    private static TokenInfo getAccessToken() throws IOException, InterruptedException {
        String auth = CLIENT_ID + ":" + CLIENT_SECRET;
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
        String requestBody = "grant_type=client_credentials&scope=api/access";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_URL))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Authorization", "Basic " + encodedAuth)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new IOException("Failed to obtain access token: " + response.body());
        }

        TokenInfo token = gson.fromJson(response.body(), TokenInfo.class);
        token.expires_at = Instant.now().getEpochSecond() + token.expires_in;
        return token;
    }

    /**
     * Check if the current token is expired.
     */
    private static boolean isTokenExpired(TokenInfo token) {
        if (token == null || token.expires_at == 0) {
            return true;
        }
        return Instant.now().getEpochSecond() > (token.expires_at - 60);
    }

    /**
     * Ensure we have a valid access token.
     */
    private static String ensureValidToken() throws IOException, InterruptedException {
        if (isTokenExpired(tokenInfo)) {
            System.out.println("Token is expired or missing. Fetching a new one...");
            tokenInfo = getAccessToken();
        }
        return tokenInfo.access_token;
    }

    /**
     * Check if a file extension is supported.
     */
    private static boolean isSupportedFile(String filePath) {
        String ext = getFileExtension(filePath).toLowerCase();
        return SUPPORTED_EXTENSIONS.contains(ext);
    }

    /**
     * Get file extension including the dot.
     */
    private static String getFileExtension(String filePath) {
        int lastDot = filePath.lastIndexOf('.');
        return lastDot > 0 ? filePath.substring(lastDot) : "";
    }

    /**
     * Upload a single file to the Data Engine.
     */
    private static UploadResponse uploadSingleFile(String filePath, String producerId)
            throws IOException, InterruptedException {
        Path path = Path.of(filePath);

        if (!Files.exists(path)) {
            throw new FileNotFoundException("File not found: " + filePath);
        }

        if (!isSupportedFile(filePath)) {
            throw new IllegalArgumentException("Unsupported file type: " + getFileExtension(filePath));
        }

        String token = ensureValidToken();
        String boundary = UUID.randomUUID().toString();

        // Build multipart body
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PrintWriter writer = new PrintWriter(new OutputStreamWriter(baos, StandardCharsets.UTF_8), true);

        String fileName = path.getFileName().toString();
        byte[] fileContent = Files.readAllBytes(path);

        // Add publisher_id field
        writer.append("--").append(boundary).append("\r\n");
        writer.append("Content-Disposition: form-data; name=\"publisher_id\"\r\n\r\n");
        writer.append(PUBLISHER_ID).append("\r\n");

        // Add file field
        writer.append("--").append(boundary).append("\r\n");
        writer.append("Content-Disposition: form-data; name=\"files\"; filename=\"")
                .append(fileName).append("\"\r\n");
        writer.append("Content-Type: application/octet-stream\r\n\r\n");
        writer.flush();
        baos.write(fileContent);
        writer.append("\r\n--").append(boundary).append("--\r\n");
        writer.flush();

        String url = UPLOAD_URL;
        if (producerId != null && !producerId.isEmpty()) {
            url += "?producer_id=" + URLEncoder.encode(producerId, StandardCharsets.UTF_8);
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(baos.toByteArray()))
                .timeout(Duration.ofSeconds(120))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 300) {
            throw new IOException("Upload failed: " + response.statusCode() + " - " + response.body());
        }

        return gson.fromJson(response.body(), UploadResponse.class);
    }

    /**
     * Update metadata for an uploaded item.
     */
    private static MetadataResponse updateMetadata(String itemId, String producerId, Map<String, Object> metadata)
            throws IOException, InterruptedException {
        if ((itemId == null || itemId.isEmpty()) && (producerId == null || producerId.isEmpty())) {
            throw new IllegalArgumentException("Either itemId or producerId must be provided");
        }

        String token = ensureValidToken();

        JsonObject data = new JsonObject();
        data.addProperty("publisher_id", PUBLISHER_ID);
        if (itemId != null && !itemId.isEmpty()) {
            data.addProperty("item_id", itemId);
        }
        if (producerId != null && !producerId.isEmpty()) {
            data.addProperty("producer_id", producerId);
        }

        for (Map.Entry<String, Object> entry : metadata.entrySet()) {
            if (entry.getValue() instanceof String) {
                data.addProperty(entry.getKey(), (String) entry.getValue());
            } else if (entry.getValue() instanceof List) {
                data.add(entry.getKey(), gson.toJsonTree(entry.getValue()));
            }
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(METADATA_URL))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(data)))
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 300) {
            throw new IOException("Metadata update failed: " + response.statusCode() + " - " + response.body());
        }

        return gson.fromJson(response.body(), MetadataResponse.class);
    }

    /**
     * Handle the single file upload command.
     */
    private static void cmdUploadSingle(String filePath, String producerId) {
        try {
            System.out.println("Uploading: " + filePath);
            if (producerId != null && !producerId.isEmpty()) {
                System.out.println("  Producer ID: " + producerId);
            }

            UploadResponse result = uploadSingleFile(filePath, producerId);

            System.out.println("Upload successful!");
            System.out.println("  Message: " + (result.message != null ? result.message : "N/A"));

            if (result.ingesting != null && !result.ingesting.isEmpty()) {
                System.out.println("  Ingesting: " + result.ingesting.size() + " file(s)");
                for (String id : result.ingesting) {
                    System.out.println("    - " + id);
                }
            }

            if (result.duplicates != null && !result.duplicates.isEmpty()) {
                System.out.println("  Duplicates: " + result.duplicates.size() + " file(s)");
                for (String id : result.duplicates) {
                    System.out.println("    - " + id);
                }
            }
        } catch (Exception e) {
            System.err.println("Upload failed: " + e.getMessage());
            System.exit(1);
        }
    }

    /**
     * Handle the batch upload command.
     */
    private static void cmdUploadBatch(String directoryPath) {
        try {
            Path dirPath = Path.of(directoryPath);

            if (!Files.exists(dirPath)) {
                System.err.println("Directory does not exist: " + directoryPath);
                System.exit(1);
            }

            if (!Files.isDirectory(dirPath)) {
                System.err.println("Path is not a directory: " + directoryPath);
                System.exit(1);
            }

            List<Path> supportedFiles = Files.list(dirPath)
                    .filter(p -> !Files.isDirectory(p) && isSupportedFile(p.toString()))
                    .collect(Collectors.toList());

            if (supportedFiles.isEmpty()) {
                System.out.println("No supported files found in: " + directoryPath);
                return;
            }

            System.out.println("Found " + supportedFiles.size() + " file(s) to upload");

            int processed = 0;
            int failed = 0;

            for (Path file : supportedFiles) {
                String fileName = file.getFileName().toString();
                System.out.println("\nUploading: " + fileName);

                try {
                    UploadResponse result = uploadSingleFile(file.toString(), null);

                    if (result.ingesting != null && !result.ingesting.isEmpty()) {
                        System.out.println("  Ingesting: " + result.ingesting.get(0));
                    } else if (result.duplicates != null && !result.duplicates.isEmpty()) {
                        System.out.println("  Duplicate detected: " + result.duplicates.get(0));
                    } else {
                        System.out.println("  Result: " + (result.message != null ? result.message : "Unknown"));
                    }
                    processed++;
                } catch (Exception e) {
                    System.err.println("  Failed: " + e.getMessage());
                    failed++;
                }

                // Rate limiting
                Thread.sleep(1000);
            }

            System.out.println("\nBatch upload complete:");
            System.out.println("  Processed: " + processed + " file(s)");
            System.out.println("  Failed: " + failed + " file(s)");

        } catch (Exception e) {
            System.err.println("Batch upload failed: " + e.getMessage());
            System.exit(1);
        }
    }

    /**
     * Handle the upload with metadata command.
     */
    private static void cmdUploadWithMetadata(String filePath, Map<String, Object> metadata) {
        try {
            String producerId = "upload-" + Instant.now().getEpochSecond();
            System.out.println("Uploading: " + filePath);
            System.out.println("  Producer ID: " + producerId);

            UploadResponse result = uploadSingleFile(filePath, producerId);

            if (result.ingesting != null && !result.ingesting.isEmpty()) {
                String itemId = result.ingesting.get(0);
                System.out.println("  Item ID: " + itemId);

                if (!metadata.isEmpty()) {
                    System.out.println("Updating metadata...");
                    MetadataResponse metaResult = updateMetadata(itemId, null, metadata);
                    System.out.println("  Metadata updated: " + (metaResult.message != null ? metaResult.message : "Success"));
                }
            } else {
                System.out.println("  Result: " + (result.message != null ? result.message : "Unknown"));
            }
        } catch (Exception e) {
            System.err.println("Operation failed: " + e.getMessage());
            System.exit(1);
        }
    }

    /**
     * Print usage information.
     */
    private static void printUsage() {
        System.out.println("Usage:");
        System.out.println("  mvn exec:java -Dexec.args=\"single <file_path> [producer_id]\"  # Upload single file");
        System.out.println("  mvn exec:java -Dexec.args=\"batch <directory>\"                  # Upload all files in directory");
        System.out.println("  mvn exec:java -Dexec.args=\"meta <file_path> --title <title>\"   # Upload with metadata");
        System.out.println("");
        System.out.println("Examples:");
        System.out.println("  mvn exec:java -Dexec.args=\"single ../sample_files/developer_happiness.txt\"");
        System.out.println("  mvn exec:java -Dexec.args=\"single ../sample_files/developer_happiness.txt my-doc-001\"");
        System.out.println("  mvn exec:java -Dexec.args=\"batch ../sample_files\"");
        System.out.println("  mvn exec:java -Dexec.args=\"meta ../sample_files/developer_happiness.txt --title 'Developer Happiness'\"");
    }

    /**
     * Parse metadata arguments from command line.
     */
    private static Map<String, Object> parseMetadataArgs(String[] args, int startIndex) {
        Map<String, Object> metadata = new HashMap<>();
        for (int i = startIndex; i < args.length; i++) {
            if ("--title".equals(args[i]) && i + 1 < args.length) {
                metadata.put("item_title", args[i + 1]);
                i++;
            } else if ("--author".equals(args[i]) && i + 1 < args.length) {
                metadata.put("author", List.of(args[i + 1]));
                i++;
            } else if ("--tags".equals(args[i]) && i + 1 < args.length) {
                metadata.put("item_tags", Arrays.asList(args[i + 1].split(",")));
                i++;
            }
        }
        return metadata;
    }

    public static void main(String[] args) {
        if (args.length < 1) {
            printUsage();
            System.exit(1);
        }

        String command = args[0].toLowerCase();

        switch (command) {
            case "single":
                if (args.length < 2) {
                    System.err.println("Error: Please specify a file to upload");
                    printUsage();
                    System.exit(1);
                }
                String producerId = args.length > 2 ? args[2] : null;
                cmdUploadSingle(args[1], producerId);
                break;

            case "batch":
                if (args.length < 2) {
                    System.err.println("Error: Please specify a directory");
                    printUsage();
                    System.exit(1);
                }
                cmdUploadBatch(args[1]);
                break;

            case "meta":
                if (args.length < 2) {
                    System.err.println("Error: Please specify a file to upload");
                    printUsage();
                    System.exit(1);
                }
                Map<String, Object> metadata = parseMetadataArgs(args, 2);
                cmdUploadWithMetadata(args[1], metadata);
                break;

            default:
                System.err.println("Error: Invalid command '" + command + "'");
                printUsage();
                System.exit(1);
        }
    }
}
