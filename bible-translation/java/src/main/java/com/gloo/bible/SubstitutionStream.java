package com.gloo.bible;

import java.util.function.Consumer;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Buffer + substitution loop for {{SCRIPTURE:reference}} placeholders.
 * Pure logic; the Bible API fetcher is injectable for testing.
 */
public final class SubstitutionStream {

    private SubstitutionStream() {}

    public static final String PLACEHOLDER_START = "{{SCRIPTURE:";
    private static final Pattern PLACEHOLDER_RE = Pattern.compile(
        "\\{\\{SCRIPTURE:([^}]+)\\}\\}"
    );

    // Matches substituted text whose verse already ends a sentence, e.g.
    // "...through Him. (John 3:17, BSB)", so a period the model writes after
    // the placeholder can be dropped instead of doubling up as "...BSB).".
    private static final Pattern ENDS_SENTENCE_RE = Pattern.compile(
        "[.!?][\"'”’)]*\\s*\\([^()]*\\)$"
    );

    /** Incremental processor that substitutes placeholders as deltas arrive. */
    public static final class Processor {
        private final StringBuilder buffer = new StringBuilder();
        private final StringBuilder stderr = new StringBuilder();
        private final Function<String, String> fetchBibleVerse;
        private final Consumer<String> write;
        // True after a substituted verse that already ends a sentence, until we
        // see the next character and know whether it is a redundant period.
        private boolean dropPeriod = false;

        public Processor(Function<String, String> fetchBibleVerse, Consumer<String> write) {
            this.fetchBibleVerse = fetchBibleVerse;
            this.write = write;
        }

        /** Feed one decoded content delta into the buffer. */
        public void onDelta(String delta) {
            buffer.append(delta);
            skipRedundantPeriod();

            // Process every complete placeholder currently in the buffer.
            while (true) {
                Matcher matcher = PLACEHOLDER_RE.matcher(buffer.toString());
                if (!matcher.find()) {
                    break;
                }

                write.accept(buffer.substring(0, matcher.start()));

                String reference = matcher.group(1).strip();
                String verseText;
                boolean substituted;
                try {
                    verseText = fetchBibleVerse.apply(reference);
                    substituted = true;
                } catch (Exception exc) {
                    verseText = "{{SCRIPTURE:" + reference + "}}";
                    substituted = false;
                    stderr.append(
                        "\n[Bible API error for " + reference + ": " + exc.getMessage() + "]\n"
                    );
                }

                write.accept(verseText);
                dropPeriod = substituted && ENDS_SENTENCE_RE.matcher(verseText).find();
                buffer.delete(0, matcher.end());
                skipRedundantPeriod();
            }

            // Hold back a trailing placeholder prefix so we do not split a marker.
            int prefixIdx = findIncompletePrefix(buffer.toString());
            if (prefixIdx >= 0) {
                write.accept(buffer.substring(0, prefixIdx));
                buffer.delete(0, prefixIdx);
            } else {
                write.accept(buffer.toString());
                buffer.setLength(0);
            }
        }

        /**
         * Drop a single leading period when the previous substituted verse
         * already ended a sentence. Clears the flag once there is text to inspect.
         */
        private void skipRedundantPeriod() {
            if (dropPeriod && buffer.length() > 0) {
                dropPeriod = false;
                if (buffer.charAt(0) == '.') {
                    buffer.deleteCharAt(0);
                }
            }
        }

        /** Flush leftover content (incomplete placeholders stay visible). */
        public void onEnd() {
            write.accept(buffer.toString());
            buffer.setLength(0);
        }

        public String getStderr() {
            return stderr.toString();
        }
    }

    /**
     * Return the index at which a placeholder prefix begins, or -1 if none.
     */
    static int findIncompletePrefix(String buffer) {
        int markerIndex = buffer.lastIndexOf(PLACEHOLDER_START);
        if (markerIndex != -1) {
            int referenceStart = markerIndex + PLACEHOLDER_START.length();
            if (!buffer.substring(referenceStart).contains("}}")) {
                return markerIndex;
            }
        }

        int maxPrefixLength = Math.min(buffer.length(), PLACEHOLDER_START.length() - 1);
        for (int prefixLength = maxPrefixLength; prefixLength > 0; prefixLength--) {
            if (buffer.endsWith(PLACEHOLDER_START.substring(0, prefixLength))) {
                return buffer.length() - prefixLength;
            }
        }

        return -1;
    }
}
