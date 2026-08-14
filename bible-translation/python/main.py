#!/usr/bin/env python3
"""
Working with Bible Translations, Reliably — Python Implementation

Demonstrates the output transform method: the model emits {{SCRIPTURE:reference}}
placeholders, and this harness deterministically fetches and substitutes the
actual verse text from bible.helloao.org. This guarantees exact quotation
accuracy because the model never writes verse text from memory.
"""

import argparse
import json
import os
import re
import sys
from typing import Iterable, List, Match, Optional, Tuple

import requests
from dotenv import load_dotenv

load_dotenv()

# Gloo AI API endpoint for chat completions.
GLOO_API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions"

# Bible API endpoint template: translation / USFM book ID / chapter.
BIBLE_API_URL_TEMPLATE = "https://bible.helloao.org/api/{translation}/{book}/{chapter}.json"

# System prompt that instructs the model to use placeholders instead of quoting.
SYSTEM_PROMPT = (
    "Never quote Bible verses directly from memory. When you want to reference "
    "a passage of Scripture, use the placeholder format {{SCRIPTURE:reference}} "
    "(e.g., {{SCRIPTURE:John 3:16}}, {{SCRIPTURE:Romans 8:28-30}}). The system "
    "will replace these placeholders with the actual verse text from the "
    "specified Bible translation. You may still discuss, explain, and comment "
    "on Scripture, but the actual verse text must always come through the "
    "placeholder mechanism."
)

# Regex for complete placeholders emitted by the model.
PLACEHOLDER_RE = re.compile(r"\{\{SCRIPTURE:([^}]+)\}\}")

# Book name → USFM identifier mapping for all 66 Protestant canon books plus
# common variations. The full USFM list is at
# https://ubsicap.github.io/usfm/identification/books.html
BOOK_IDS = {
    # Old Testament
    "Genesis": "GEN",
    "Exodus": "EXO",
    "Leviticus": "LEV",
    "Numbers": "NUM",
    "Deuteronomy": "DEU",
    "Joshua": "JOS",
    "Judges": "JDG",
    "Ruth": "RUT",
    "1 Samuel": "1SA",
    "1Samuel": "1SA",
    "1 Sam": "1SA",
    "1Sam": "1SA",
    "I Samuel": "1SA",
    "ISamuel": "1SA",
    "I Sam": "1SA",
    "ISam": "1SA",
    "2 Samuel": "2SA",
    "2Samuel": "2SA",
    "2 Sam": "2SA",
    "2Sam": "2SA",
    "II Samuel": "2SA",
    "IISamuel": "2SA",
    "II Sam": "2SA",
    "IISam": "2SA",
    "1 Kings": "1KI",
    "1Kings": "1KI",
    "1 Kgs": "1KI",
    "1Kgs": "1KI",
    "I Kings": "1KI",
    "IKings": "1KI",
    "I Kgs": "1KI",
    "IKgs": "1KI",
    "2 Kings": "2KI",
    "2Kings": "2KI",
    "2 Kgs": "2KI",
    "2Kgs": "2KI",
    "II Kings": "2KI",
    "IIKings": "2KI",
    "II Kgs": "2KI",
    "IIKgs": "2KI",
    "1 Chronicles": "1CH",
    "1Chronicles": "1CH",
    "1 Chr": "1CH",
    "1Chr": "1CH",
    "I Chronicles": "1CH",
    "IChronicles": "1CH",
    "I Chr": "1CH",
    "IChr": "1CH",
    "2 Chronicles": "2CH",
    "2Chronicles": "2CH",
    "2 Chr": "2CH",
    "2Chr": "2CH",
    "II Chronicles": "2CH",
    "IIChronicles": "2CH",
    "II Chr": "2CH",
    "IIChr": "2CH",
    "Ezra": "EZR",
    "Nehemiah": "NEH",
    "Esther": "EST",
    "Job": "JOB",
    "Psalm": "PSA",
    "Psalms": "PSA",
    "Proverbs": "PRO",
    "Ecclesiastes": "ECC",
    "Song of Songs": "SNG",
    "Song of Solomon": "SNG",
    "Canticles": "SNG",
    "Isaiah": "ISA",
    "Jeremiah": "JER",
    "Lamentations": "LAM",
    "Ezekiel": "EZK",
    "Daniel": "DAN",
    "Hosea": "HOS",
    "Joel": "JOL",
    "Amos": "AMO",
    "Obadiah": "OBA",
    "Jonah": "JON",
    "Micah": "MIC",
    "Nahum": "NAM",
    "Habakkuk": "HAB",
    "Zephaniah": "ZEP",
    "Haggai": "HAG",
    "Zechariah": "ZEC",
    "Malachi": "MAL",
    # New Testament
    "Matthew": "MAT",
    "Matt": "MAT",
    "Mark": "MRK",
    "Luke": "LUK",
    "John": "JHN",
    "Acts": "ACT",
    "Romans": "ROM",
    "Rom": "ROM",
    "1 Corinthians": "1CO",
    "1Corinthians": "1CO",
    "1 Cor": "1CO",
    "1Cor": "1CO",
    "I Corinthians": "1CO",
    "ICorinthians": "1CO",
    "I Cor": "1CO",
    "ICor": "1CO",
    "2 Corinthians": "2CO",
    "2Corinthians": "2CO",
    "2 Cor": "2CO",
    "2Cor": "2CO",
    "II Corinthians": "2CO",
    "IICorinthians": "2CO",
    "II Cor": "2CO",
    "IICor": "2CO",
    "Galatians": "GAL",
    "Ephesians": "EPH",
    "Philippians": "PHP",
    "Colossians": "COL",
    "1 Thessalonians": "1TH",
    "1Thessalonians": "1TH",
    "1 Thess": "1TH",
    "1Thess": "1TH",
    "I Thessalonians": "1TH",
    "IThessalonians": "1TH",
    "I Thess": "1TH",
    "IThess": "1TH",
    "2 Thessalonians": "2TH",
    "2Thessalonians": "2TH",
    "2 Thess": "2TH",
    "2Thess": "2TH",
    "II Thessalonians": "2TH",
    "IIThessalonians": "2TH",
    "II Thess": "2TH",
    "IIThess": "2TH",
    "1 Timothy": "1TI",
    "1Timothy": "1TI",
    "1 Tim": "1TI",
    "1Tim": "1TI",
    "I Timothy": "1TI",
    "ITimothy": "1TI",
    "I Tim": "1TI",
    "ITim": "1TI",
    "2 Timothy": "2TI",
    "2Timothy": "2TI",
    "2 Tim": "2TI",
    "2Tim": "2TI",
    "II Timothy": "2TI",
    "IITimothy": "2TI",
    "II Tim": "2TI",
    "IITim": "2TI",
    "Titus": "TIT",
    "Philemon": "PHM",
    "Hebrews": "HEB",
    "James": "JAS",
    "Jms": "JAS",
    "1 Peter": "1PE",
    "1Peter": "1PE",
    "1 Pet": "1PE",
    "1Pet": "1PE",
    "I Peter": "1PE",
    "IPeter": "1PE",
    "I Pet": "1PE",
    "IPet": "1PE",
    "2 Peter": "2PE",
    "2Peter": "2PE",
    "2 Pet": "2PE",
    "2Pet": "2PE",
    "II Peter": "2PE",
    "IIPeter": "2PE",
    "II Pet": "2PE",
    "IIPet": "2PE",
    "1 John": "1JN",
    "1John": "1JN",
    "1 Jn": "1JN",
    "1Jn": "1JN",
    "I John": "1JN",
    "IJohn": "1JN",
    "I Jn": "1JN",
    "IJn": "1JN",
    "2 John": "2JN",
    "2John": "2JN",
    "2 Jn": "2JN",
    "2Jn": "2JN",
    "II John": "2JN",
    "IIJohn": "2JN",
    "II Jn": "2JN",
    "IIJn": "2JN",
    "3 John": "3JN",
    "3John": "3JN",
    "3 Jn": "3JN",
    "3Jn": "3JN",
    "III John": "3JN",
    "IIIJohn": "3JN",
    "III Jn": "3JN",
    "IIIJn": "3JN",
    "Jude": "JUD",
    "Revelation": "REV",
    "Rev": "REV",
    "Apocalypse": "REV",
}


def normalize_reference(raw_reference: str) -> str:
    """Normalize whitespace and Roman numerals in a reference string.

    Collapses multiple spaces, strips leading/trailing whitespace, and converts
    common numeric prefixes so "1 John", "I John", and "First John" all share
    a canonical key for lookup.
    """
    reference = " ".join(raw_reference.strip().split())
    reference = re.sub(r"\bFirst\b", "1", reference, flags=re.IGNORECASE)
    reference = re.sub(r"\bSecond\b", "2", reference, flags=re.IGNORECASE)
    reference = re.sub(r"\bThird\b", "3", reference, flags=re.IGNORECASE)
    reference = re.sub(r"\b([1-3])\s+", r"\1", reference)
    return reference


def parse_reference(reference: str) -> Tuple[str, int, List[int]]:
    """Parse a human-readable scripture reference into USFM components.

    Args:
        reference: e.g. "John 3:16", "Romans 8:28-30", "1 John 4:8", "Psalm 23".

    Returns:
        A tuple of (book_id, chapter, list_of_verses).

    Raises:
        ValueError: if the reference cannot be parsed or the book is unknown.
    """
    normalized = normalize_reference(reference)

    # Match book name (possibly starting with a number), chapter, and optional verses.
    match = re.match(r"^(\d?\s*(?:[A-Za-z]+\s+){0,3}[A-Za-z]+)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$", normalized)
    if not match:
        raise ValueError(f"Could not parse reference: {reference!r}")

    book_part = " ".join(match.group(1).split())
    chapter = int(match.group(2))
    start_verse = match.group(3)
    end_verse = match.group(4)

    # Try the cleaned book name first, then progressively looser forms.
    book_id = BOOK_IDS.get(book_part)
    if book_id is None:
        # Remove spaces entirely for compact forms like "1John".
        book_id = BOOK_IDS.get(book_part.replace(" ", ""))
    if book_id is None:
        raise ValueError(f"Unknown book name: {book_part}")

    if start_verse is None:
        # Whole-chapter reference; we'll return an empty verse list as a sentinel.
        return book_id, chapter, []

    start = int(start_verse)
    end = int(end_verse) if end_verse else start
    if end < start:
        raise ValueError(f"Invalid verse range: {start}-{end}")
    return book_id, chapter, list(range(start, end + 1))


def fetch_bible_verse(reference: str, translation: str = "BSB") -> str:
    """Fetch verse text from bible.helloao.org and return a formatted citation.

    Args:
        reference: Human-readable reference such as "John 3:16" or "Romans 8:28-30".
        translation: Bible translation ID (default "BSB").

    Returns:
        Formatted text ending with "(reference, translation)" citation.
    """
    book_id, chapter, verses = parse_reference(reference)

    url = BIBLE_API_URL_TEMPLATE.format(
        translation=translation, book=book_id, chapter=chapter
    )
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    data = response.json()

    chapter_content = data.get("chapter", {}).get("content", [])

    def extract_text(content):
        """Recursively collect text fragments from verse content."""
        texts = []
        for fragment in content:
            if isinstance(fragment, str):
                texts.append(fragment)
            elif isinstance(fragment, dict):
                text = fragment.get("text")
                if isinstance(text, str):
                    texts.append(text)
            elif isinstance(fragment, list):
                texts.append(extract_text(fragment))
        return " ".join(texts)

    verse_map: dict[int, str] = {}
    for item in chapter_content:
        if item.get("type") == "verse" and "number" in item:
            # Recursively extract strings and dict "text" fields, ignoring footnotes/notes.
            verse_map[item["number"]] = extract_text(item.get("content", [])).strip()

    if not verses:
        # Whole chapter: return all verses found, sorted.
        verses = sorted(verse_map.keys())

    missing = [v for v in verses if v not in verse_map]
    if missing:
        raise ValueError(f"Verse(s) not found in {reference}: {missing}")

    selected = " ".join(verse_map[v] for v in verses)
    return f"{selected} ({reference}, {translation})"


def extract_sse_content_lines(response: requests.Response) -> Iterable[str]:
    """Yield content deltas from a Gloo AI streaming SSE response.

    Handles the `data: ` prefix, the `[DONE]` sentinel, and JSON parsing of
    each chunk. Invalid lines are skipped so one malformed chunk does not
    terminate the stream.
    """
    for line in response.iter_lines():
        if not line:
            continue
        text = line.decode("utf-8")
        if not text.startswith("data: "):
            continue
        payload = text[len("data: "):]
        if payload == "[DONE]":
            break
        try:
            chunk = json.loads(payload)
        except json.JSONDecodeError:
            continue
        delta = chunk.get("choices", [{}])[0].get("delta", {})
        content = delta.get("content")
        if content:
            yield content


def find_incomplete_prefix(buffer: str) -> Optional[int]:
    """Return the index at which a placeholder prefix begins, if any.

    We hold back any trailing substring that could be the start of a
    {{SCRIPTURE:...}} placeholder. Specifically, we look for an unmatched
    '{{' anywhere in the last (max placeholder prefix length) characters.
    If found, we return the index of that opening brace so content before it
    can be emitted and the rest kept in the buffer.
    """
    # The longest meaningful incomplete prefix we need to retain is the full
    # marker start "{{SCRIPTURE:". Anything before that can safely be emitted.
    if "{{" not in buffer:
        return None

    # Find the last occurrence of '{{' that is not part of a complete placeholder.
    idx = buffer.rfind("{{")
    if idx == -1:
        return None

    # If this '{{' is already closed before the end of the buffer, it is complete.
    if buffer.find("}}", idx) != -1 and buffer.find("}}", idx) < len(buffer):
        return None

    return idx


def stream_with_substitution(
    response: requests.Response,
    translation: str,
) -> None:
    """Stream Gloo AI response to stdout, substituting scripture placeholders.

    This is the core output transform. We accumulate content in a buffer,
    scan for complete {{SCRIPTURE:reference}} placeholders, fetch the actual
    verse text from bible.helloao.org, substitute it inline, and emit the
    result. If the buffer ends with a possible placeholder prefix, we hold
    those characters back until the next chunk either completes or disproves
    the placeholder.
    """
    buffer = ""

    for delta in extract_sse_content_lines(response):
        buffer += delta

        # Process every complete placeholder currently in the buffer.
        while True:
            match: Optional[Match[str]] = PLACEHOLDER_RE.search(buffer)
            if not match:
                break

            # Emit everything before the placeholder immediately.
            print(buffer[: match.start()], end="", flush=True)

            reference = match.group(1).strip()
            try:
                verse_text = fetch_bible_verse(reference, translation)
            except Exception as exc:  # pylint: disable=broad-except
                # Graceful failure: leave the placeholder visible so the reader
                # sees a reference rather than corrupted scripture text.
                verse_text = f"{{{{SCRIPTURE:{reference}}}}}"
                print(f"\n[Bible API error for {reference}: {exc}]\n", end="", flush=True)

            print(verse_text, end="", flush=True)

            # Drop the consumed portion and keep scanning the remainder.
            buffer = buffer[match.end():]

        # Hold back a trailing placeholder prefix so we do not split a marker.
        prefix_idx = find_incomplete_prefix(buffer)
        if prefix_idx is not None:
            print(buffer[:prefix_idx], end="", flush=True)
            buffer = buffer[prefix_idx:]
        else:
            print(buffer, end="", flush=True)
            buffer = ""

    # Stream ended: emit any leftover content (incomplete placeholders will
    # appear as-is, which is a graceful failure mode).
    print(buffer, end="", flush=True)


def build_request_body(prompt: str, tradition: Optional[str]) -> dict:
    """Construct the JSON body for the Gloo AI streaming completion request."""
    body: dict = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "auto_routing": True,
        "stream": True,
    }
    if tradition is not None:
        body["tradition"] = tradition
    return body


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Stream a Gloo AI response with Bible verse substitution."
    )
    parser.add_argument("prompt", help="Your question or request")
    parser.add_argument(
        "--tradition",
        default=None,
        help="Gloo tradition parameter (optional; may conflict with placeholders)",
    )
    parser.add_argument(
        "--translation",
        default="BSB",
        help="Bible translation ID from bible.helloao.org (default: BSB)",
    )
    args = parser.parse_args()

    api_key = os.getenv("GLOO_API_KEY")
    if not api_key:
        print(
            "Error: GLOO_API_KEY is not set. "
            "Get your API key from https://studio.ai.gloo.com/api-keys "
            "and add it to your environment or .env file.",
            file=sys.stderr,
        )
        sys.exit(1)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = build_request_body(args.prompt, args.tradition)

    try:
        response = requests.post(
            GLOO_API_URL,
            headers=headers,
            json=body,
            stream=True,
            timeout=60,
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        print(f"Error: failed to connect to Gloo AI API: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        stream_with_substitution(response, args.translation)
    except Exception as exc:  # pylint: disable=broad-except
        print(f"\nError: streaming failed: {exc}", file=sys.stderr)
        sys.exit(1)

    # Preserve the user's terminal formatting by ending with a newline.
    print()


if __name__ == "__main__":
    main()
