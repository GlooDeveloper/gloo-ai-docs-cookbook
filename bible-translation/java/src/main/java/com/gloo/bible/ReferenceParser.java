package com.gloo.bible;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parse human-readable scripture references into USFM components.
 */
public final class ReferenceParser {

    private ReferenceParser() {}

    private static final Pattern REFERENCE_PATTERN = Pattern.compile(
        "^(\\d?\\s*(?:[A-Za-z]+\\s+){0,3}[A-Za-z]+)\\s+(\\d+)(?::(\\d+)(?:\\s*-\\s*(\\d+))?)?$"
    );

    private static final Pattern FIRST_PATTERN = Pattern.compile("\\bFirst\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern SECOND_PATTERN = Pattern.compile("\\bSecond\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern THIRD_PATTERN = Pattern.compile("\\bThird\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern NUMERIC_PREFIX_PATTERN = Pattern.compile("\\b([1-3])\\s+");

    /**
     * Normalize whitespace and Roman numerals in a reference string.
     */
    public static String normalizeReference(String rawReference) {
        String reference = rawReference.strip();
        reference = reference.replaceAll("\\s+", " ");
        reference = FIRST_PATTERN.matcher(reference).replaceAll("1");
        reference = SECOND_PATTERN.matcher(reference).replaceAll("2");
        reference = THIRD_PATTERN.matcher(reference).replaceAll("3");
        reference = NUMERIC_PREFIX_PATTERN.matcher(reference).replaceAll("$1");
        return reference;
    }

    /**
     * Parse a reference into (bookId, chapter, verseList).
     * If no verses are specified, verseList is empty (whole chapter sentinel).
     */
    public static Reference parse(String reference) {
        String normalized = normalizeReference(reference);

        Matcher matcher = REFERENCE_PATTERN.matcher(normalized);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("Could not parse reference: '" + reference + "'");
        }

        String bookPart = matcher.group(1).replaceAll("\\s+", " ").strip();
        int chapter = Integer.parseInt(matcher.group(2));
        String startVerse = matcher.group(3);
        String endVerse = matcher.group(4);

        String bookId = BookLookup.lookup(bookPart);
        if (bookId == null) {
            bookId = BookLookup.lookup(bookPart.replace(" ", ""));
        }
        if (bookId == null) {
            throw new IllegalArgumentException("Unknown book name: " + bookPart);
        }

        List<Integer> verses = new ArrayList<>();
        if (startVerse == null) {
            return new Reference(bookId, chapter, verses);
        }

        int start = Integer.parseInt(startVerse);
        int end = endVerse != null ? Integer.parseInt(endVerse) : start;
        if (end < start) {
            throw new IllegalArgumentException("Invalid verse range: " + start + "-" + end);
        }
        for (int i = start; i <= end; i++) {
            verses.add(i);
        }
        return new Reference(bookId, chapter, verses);
    }

    public record Reference(String bookId, int chapter, List<Integer> verses) {}
}
