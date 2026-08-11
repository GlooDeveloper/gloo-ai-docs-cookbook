package com.gloo.ai;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import io.github.cdimascio.dotenv.Dotenv;
import io.methvin.watcher.DirectoryChangeEvent;
import io.methvin.watcher.DirectoryWatcher;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Stream;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Gloo AI Realtime Content Ingestion - Java Example
 *
 * This application demonstrates how to use the Gloo AI Realtime Ingestion API
 * to automatically upload content and make it available for search and AI interaction.
 */
public class RealtimeIngestionApp {

    private static final Logger logger = LoggerFactory.getLogger(
        RealtimeIngestionApp.class
    );
    private static final Gson gson = new GsonBuilder()
        .setPrettyPrinting()
        .create();

    // Configuration constants
    private static final String API_URL =
        "https://platform.ai.gloo.com/ingestion/v1/real_time_upload";
    private static final String PUBLISHER_ID = "your-publisher-id"; // Replace with your publisher ID
    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
        ".txt",
        ".md"
    );
    private static final Duration API_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration RATE_LIMIT_DELAY = Duration.ofSeconds(1);

    public static void main(String[] args) {
        try {
            RealtimeIngestionApp app = new RealtimeIngestionApp();
            app.run(args);
        } catch (Exception e) {
            logger.error("Application failed: {}", e.getMessage(), e);
            System.exit(1);
        }
    }

    private void run(String[] args) throws Exception {
        if (args.length < 1) {
            printUsage();
            System.exit(1);
        }

        String command = args[0].toLowerCase();

        switch (command) {
            case "single":
                if (args.length < 2) {
                    System.err.println(
                        "Error: Please specify a file to process"
                    );
                    printUsage();
                    System.exit(1);
                }
                processSingleFile(args[1]);
                break;
            case "batch":
                if (args.length < 2) {
                    System.err.println(
                        "Error: Please specify a directory to process"
                    );
                    printUsage();
                    System.exit(1);
                }
                batchProcessDirectory(args[1]);
                break;
            case "watch":
                if (args.length < 2) {
                    System.err.println(
                        "Error: Please specify a directory to watch"
                    );
                    printUsage();
                    System.exit(1);
                }
                watchDirectory(args[1]);
                break;
            default:
                System.err.println("Error: Invalid command '" + command + "'");
                printUsage();
                System.exit(1);
        }
    }

    private void printUsage() {
        System.out.println("Usage:");
        System.out.println(
            "  java -jar target/realtime-ingestion-1.0.0.jar watch <directory>     # Monitor directory for new files"
        );
        System.out.println(
            "  java -jar target/realtime-ingestion-1.0.0.jar batch <directory>     # Process all files in directory"
        );
        System.out.println(
            "  java -jar target/realtime-ingestion-1.0.0.jar single <file_path>    # Process single file"
        );
        System.out.println();
        System.out.println("Maven execution:");
        System.out.println(
            "  mvn exec:java -Dexec.args=\"single ./sample_content/article.txt\""
        );
        System.out.println(
            "  mvn exec:java -Dexec.args=\"batch ./sample_content\""
        );
        System.out.println(
            "  mvn exec:java -Dexec.args=\"watch ./sample_content\""
        );
        System.out.println();
        System.out.println("Profile shortcuts:");
        System.out.println(
            "  mvn exec:java -Psingle    # Process sample article"
        );
        System.out.println(
            "  mvn exec:java -Pbatch     # Process sample_content directory"
        );
        System.out.println(
            "  mvn exec:java -Pwatch     # Monitor sample_content directory"
        );
    }

    private void processSingleFile(String filePath) throws Exception {
        ContentProcessor processor = new ContentProcessor();
        boolean success = processor.processFile(Paths.get(filePath));
        if (!success) {
            System.exit(1);
        }
    }

    private void batchProcessDirectory(String directoryPath) throws Exception {
        BatchProcessor batchProcessor = new BatchProcessor();
        batchProcessor.processDirectory(Paths.get(directoryPath));
    }

    private void watchDirectory(String directoryPath) throws Exception {
        FileWatcher watcher = new FileWatcher();
        watcher.watch(Paths.get(directoryPath));
    }

    // Content processing and upload management
    static class ContentProcessor {

        private final String apiKey;
        private final OkHttpClient httpClient;

        public ContentProcessor() {
            Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
            this.apiKey = dotenv.get("GLOO_API_KEY", "");

            if (apiKey.isEmpty()) {
                throw new IllegalStateException(
                    "Error: GLOO_API_KEY must be set\n" +
                    "Create a .env file with your API key:\n" +
                    "GLOO_API_KEY=your_api_key_here"
                );
            }

            this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(API_TIMEOUT)
                .readTimeout(API_TIMEOUT)
                .writeTimeout(API_TIMEOUT)
                .build();
        }

        public boolean processFile(Path filePath) {
            try {
                // Validate file
                if (!Files.exists(filePath)) {
                    logger.error("❌ File does not exist: {}", filePath);
                    return false;
                }

                if (!Files.isReadable(filePath)) {
                    logger.error("❌ File is not readable: {}", filePath);
                    return false;
                }

                if (!isSupportedFile(filePath)) {
                    logger.error("❌ Unsupported file type: {}", filePath);
                    return false;
                }

                // Read file content
                String content = Files.readString(filePath);
                if (content.trim().isEmpty()) {
                    logger.error("❌ File is empty: {}", filePath);
                    return false;
                }

                // Extract metadata and create content data
                String title = extractTitleFromFilename(
                    filePath.getFileName().toString()
                );
                ContentData contentData = createContentData(content, title);

                // Upload content
                ApiResponse result = uploadContent(contentData);

                System.out.println("✅ Successfully uploaded: " + title);
                System.out.println("   Response: " + result.message);
                logger.info("Successfully processed file: {}", filePath);
                return true;
            } catch (Exception e) {
                System.err.println(
                    "❌ Failed to process " + filePath + ": " + e.getMessage()
                );
                logger.error("Failed to process file: {}", filePath, e);
                return false;
            }
        }

        private boolean isSupportedFile(Path filePath) {
            String fileName = filePath.getFileName().toString().toLowerCase();
            return SUPPORTED_EXTENSIONS.stream().anyMatch(fileName::endsWith);
        }

        private String extractTitleFromFilename(String filename) {
            String name = filename.replaceAll("\\.(txt|md)$", "");
            name = name.replaceAll("[_-]", " ");

            // Simple title case implementation
            String[] words = name.split("\\s+");
            StringBuilder result = new StringBuilder();

            for (int i = 0; i < words.length; i++) {
                if (i > 0) result.append(" ");
                String word = words[i];
                if (!word.isEmpty()) {
                    result.append(Character.toUpperCase(word.charAt(0)));
                    if (word.length() > 1) {
                        result.append(word.substring(1).toLowerCase());
                    }
                }
            }

            return result.toString();
        }

        private ContentData createContentData(String content, String title) {
            ContentData data = new ContentData();
            data.content = content;
            data.publisherId = PUBLISHER_ID;
            data.itemTitle = title;
            data.author = new String[] { "Automated Ingestion" };
            data.publicationDate = LocalDate.now().toString();
            data.type = "Article";
            data.pubType = "technical";
            data.itemTags = new String[] { "automated", "ingestion" };
            data.evergreen = true;
            data.drm = new String[] { "aspen", "kallm" };
            return data;
        }

        private ApiResponse uploadContent(ContentData contentData)
            throws IOException {
            String jsonPayload = gson.toJson(contentData);
            RequestBody body = RequestBody.create(
                jsonPayload,
                MediaType.get("application/json")
            );

            Request request = new Request.Builder()
                .url(API_URL)
                .post(body)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    throw new IOException(
                        "Upload failed: " +
                        response.code() +
                        " - " +
                        response.message()
                    );
                }

                String responseBody = response.body().string();
                return gson.fromJson(responseBody, ApiResponse.class);
            }
        }
    }

    // Batch processing for multiple files
    static class BatchProcessor {

        private final ContentProcessor processor;

        public BatchProcessor() {
            this.processor = new ContentProcessor();
        }

        public void processDirectory(Path directoryPath) throws IOException {
            if (!Files.exists(directoryPath)) {
                System.err.println(
                    "Directory does not exist: " + directoryPath
                );
                return;
            }

            if (!Files.isDirectory(directoryPath)) {
                System.err.println("Path is not a directory: " + directoryPath);
                return;
            }

            List<Path> supportedFiles = findSupportedFiles(directoryPath);

            if (supportedFiles.isEmpty()) {
                System.out.println(
                    "No supported files found in: " + directoryPath
                );
                return;
            }

            System.out.println(
                "Found " + supportedFiles.size() + " files to process"
            );

            int processed = 0;
            int failed = 0;

            for (Path file : supportedFiles) {
                if (processor.processFile(file)) {
                    processed++;
                } else {
                    failed++;
                }

                // Rate limiting - avoid overwhelming the API
                try {
                    Thread.sleep(RATE_LIMIT_DELAY.toMillis());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    logger.warn("Processing interrupted");
                    break;
                }
            }

            System.out.println("\n📊 Batch processing complete:");
            System.out.println("   ✅ Processed: " + processed + " files");
            System.out.println("   ❌ Failed: " + failed + " files");
        }

        private List<Path> findSupportedFiles(Path directory)
            throws IOException {
            List<Path> supportedFiles = new ArrayList<>();

            try (Stream<Path> files = Files.walk(directory, 1)) {
                files
                    .filter(Files::isRegularFile)
                    .filter(this::isSupportedFile)
                    .forEach(supportedFiles::add);
            }

            supportedFiles.sort(Comparator.comparing(Path::toString));
            return supportedFiles;
        }

        private boolean isSupportedFile(Path filePath) {
            String fileName = filePath.getFileName().toString().toLowerCase();
            return SUPPORTED_EXTENSIONS.stream().anyMatch(fileName::endsWith);
        }
    }

    // File system monitoring using directory-watcher
    static class FileWatcher {

        private final ContentProcessor processor;

        public FileWatcher() {
            this.processor = new ContentProcessor();
        }

        public void watch(Path watchDirectory) throws IOException {
            if (!Files.exists(watchDirectory)) {
                Files.createDirectories(watchDirectory);
                System.out.println(
                    "Created watch directory: " + watchDirectory
                );
            }

            System.out.println("🔍 Monitoring directory: " + watchDirectory);
            System.out.println(
                "   Supported file types: " +
                String.join(", ", SUPPORTED_EXTENSIONS)
            );
            System.out.println("   Press Ctrl+C to stop");

            DirectoryWatcher watcher = DirectoryWatcher.builder()
                .path(watchDirectory)
                .listener(this::handleDirectoryChange)
                .build();

            // Add shutdown hook for graceful cleanup
            Runtime.getRuntime().addShutdownHook(
                    new Thread(() -> {
                        try {
                            System.out.println("\n👋 Stopping file monitor...");
                            watcher.close();
                        } catch (IOException e) {
                            logger.error("Error closing directory watcher", e);
                        }
                    })
                );

            try {
                watcher.watchAsync();

                // Keep the main thread alive
                while (!Thread.currentThread().isInterrupted()) {
                    Thread.sleep(1000);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                logger.info("Directory watching interrupted");
            } finally {
                try {
                    watcher.close();
                } catch (IOException e) {
                    logger.error("Error closing directory watcher", e);
                }
            }
        }

        private void handleDirectoryChange(DirectoryChangeEvent event) {
            if (event.eventType() == DirectoryChangeEvent.EventType.CREATE) {
                Path filePath = event.path();

                if (isSupportedFile(filePath)) {
                    System.out.println("📄 New file detected: " + filePath);

                    // Small delay to ensure file write is complete
                    try {
                        Thread.sleep(1000);
                        processor.processFile(filePath);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        logger.warn(
                            "File processing interrupted for: {}",
                            filePath
                        );
                    }
                }
            }
        }

        private boolean isSupportedFile(Path filePath) {
            String fileName = filePath.getFileName().toString().toLowerCase();
            return SUPPORTED_EXTENSIONS.stream().anyMatch(fileName::endsWith);
        }
    }

    // Data classes for JSON serialization
    static class ContentData {

        public String content;
        public String publisherId;

        @com.google.gson.annotations.SerializedName("item_title")
        public String itemTitle;

        public String[] author;

        @com.google.gson.annotations.SerializedName("publication_date")
        public String publicationDate;

        public String type;

        @com.google.gson.annotations.SerializedName("pub_type")
        public String pubType;

        @com.google.gson.annotations.SerializedName("item_tags")
        public String[] itemTags;

        public boolean evergreen;
        public String[] drm;
    }

    static class ApiResponse {

        public boolean success;
        public String message;
        public String taskId;
        public String batchId;
        public Object processingDetails;
    }
}
