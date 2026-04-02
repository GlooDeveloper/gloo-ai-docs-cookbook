package com.gloo.streaming.tests;

import com.gloo.streaming.auth.TokenManager;
import com.gloo.streaming.browser.Renderer;
import io.github.cdimascio.dotenv.Dotenv;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.nio.charset.StandardCharsets;

/**
 * Typing-Effect Renderer Test
 *
 * <p>Validates that renderStreamToTerminal() streams tokens to stdout
 * and prints a summary line with token count and finish_reason.
 *
 * <p>Usage: mvn -q compile exec:java -Dexec.mainClass=com.gloo.streaming.tests.Step5RendererTest
 */
public class Step5RendererTest {

    public static void main(String[] args) {
        System.out.println("🧪 Testing: Typing-Effect Renderer\n");

        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        if (dotenv.get("GLOO_CLIENT_ID", "").isBlank()) {
            System.err.println("❌ Missing GLOO_CLIENT_ID — run Step 1 first");
            System.exit(1);
        }

        try {
            String token = TokenManager.ensureValidToken();
            System.out.println("✓ Token obtained\n");

            // Tee stdout: write to both terminal (live) and a buffer (for validation)
            PrintStream originalOut = System.out;
            ByteArrayOutputStream captured = new ByteArrayOutputStream();
            OutputStream tee = new OutputStream() {
                @Override public void write(int b) throws IOException {
                    originalOut.write(b);
                    captured.write(b);
                }
                @Override public void write(byte[] b, int off, int len) throws IOException {
                    originalOut.write(b, off, len);
                    captured.write(b, off, len);
                }
                @Override public void flush() throws IOException { originalOut.flush(); }
            };
            System.setOut(new PrintStream(tee, true, StandardCharsets.UTF_8));

            System.out.println("Test 1: renderStreamToTerminal — streaming to terminal...");
            Renderer.renderStreamToTerminal("Reply with exactly: Hello streaming world", token);

            System.setOut(originalOut);
            String output = captured.toString(StandardCharsets.UTF_8);

            if (!output.contains("Prompt:")) {
                throw new RuntimeException("Output missing 'Prompt:' header");
            }
            System.out.println("✓ Prompt header printed");

            if (!output.contains("Response:")) {
                throw new RuntimeException("Output missing 'Response:' label");
            }
            System.out.println("✓ Response label printed");

            Pattern pattern = Pattern.compile("\\[(\\d+) tokens, finish_reason=(\\w+)\\]");
            Matcher matcher = pattern.matcher(output);
            if (!matcher.find()) {
                throw new RuntimeException("Output missing token summary '[N tokens, finish_reason=X]'");
            }

            int tokenCount = Integer.parseInt(matcher.group(1));
            String finishReason = matcher.group(2);

            if (tokenCount == 0) {
                throw new RuntimeException("token count is 0 — no tokens were streamed");
            }

            System.out.printf("✓ Token summary found: %d tokens, finish_reason=%s%n", tokenCount, finishReason);

            System.out.println("\n✅ Typing-effect renderer working.");
            System.out.println("   Next: Server-Side Proxy\n");

        } catch (Exception e) {
            System.err.println("\n❌ Typing-Effect Renderer Test Failed");
            System.err.println("Error: " + e.getMessage());
            System.err.println("\n💡 Hints:");
            System.err.println("   - renderStreamToTerminal should use System.out.print for each token");
            System.err.println("   - Print '[N tokens, finish_reason=X]' summary at end");
            System.err.println("   - Check that the streaming loop correctly extracts token content\n");
            System.exit(1);
        }
    }
}
