import "dotenv/config";
import { stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";

// Gloo AI Guarded Responses endpoint.
const GLOO_API_URL = "https://platform.ai.gloo.com/ai/v2/guarded/responses";

// Responses takes a pinned model. Swap in any generation model ID from
// https://docs.gloo.com/api-guides/supported-models.
const MODEL = "gloo-openai-gpt-6-luna";

// Bible API endpoint template: translation / USFM book ID / chapter.
const BIBLE_API_URL_TEMPLATE = "https://bible.helloao.org/api/{translation}/{book}/{chapter}.json";

// System prompt that instructs the model to use placeholders instead of quoting.
const SYSTEM_PROMPT =
  "Never quote Bible verses directly from memory. When you want to reference " +
  "a passage of Scripture, use the placeholder format {{SCRIPTURE:reference}} " +
  "(e.g., {{SCRIPTURE:John 3:16}}, {{SCRIPTURE:Romans 8:28-30}}). The system " +
  "will replace these placeholders with the actual verse text from the " +
  "specified Bible translation. You may still discuss, explain, and comment " +
  "on Scripture, but the actual verse text must always come through the " +
  "placeholder mechanism. Place each placeholder where the full verse can " +
  "stand on its own, such as after a colon or on its own line. Don't use a " +
  "placeholder as part of a sentence or inside parentheses.";

// Marker and regex for placeholders emitted by the model.
const PLACEHOLDER_START = "{{SCRIPTURE:";
const PLACEHOLDER_RE = /\{\{SCRIPTURE:([^}]+)\}\}/g;

// Matches substituted text whose verse already ends a sentence, e.g.
// "...through Him. (John 3:17, BSB)", so a period the model writes after the
// placeholder can be dropped instead of doubling up as "...BSB).".
const ENDS_SENTENCE_RE = /[.!?]["'”’)]*\s*\([^()]*\)$/;

// Book name → USFM identifier mapping for all 66 Protestant canon books plus
// common variations. The full USFM list is at
// https://ubsicap.github.io/usfm/identification/books.html
const BOOK_IDS: Record<string, string> = {
  // Old Testament
  Genesis: "GEN",
  Exodus: "EXO",
  Leviticus: "LEV",
  Numbers: "NUM",
  Deuteronomy: "DEU",
  Joshua: "JOS",
  Judges: "JDG",
  Ruth: "RUT",
  "1 Samuel": "1SA",
  "1Samuel": "1SA",
  "1 Sam": "1SA",
  "1Sam": "1SA",
  "I Samuel": "1SA",
  ISamuel: "1SA",
  "I Sam": "1SA",
  ISam: "1SA",
  "2 Samuel": "2SA",
  "2Samuel": "2SA",
  "2 Sam": "2SA",
  "2Sam": "2SA",
  "II Samuel": "2SA",
  IISamuel: "2SA",
  "II Sam": "2SA",
  IISam: "2SA",
  "1 Kings": "1KI",
  "1Kings": "1KI",
  "1 Kgs": "1KI",
  "1Kgs": "1KI",
  "I Kings": "1KI",
  IKings: "1KI",
  "I Kgs": "1KI",
  IKgs: "1KI",
  "2 Kings": "2KI",
  "2Kings": "2KI",
  "2 Kgs": "2KI",
  "2Kgs": "2KI",
  "II Kings": "2KI",
  IIKings: "2KI",
  "II Kgs": "2KI",
  IIKgs: "2KI",
  "1 Chronicles": "1CH",
  "1Chronicles": "1CH",
  "1 Chr": "1CH",
  "1Chr": "1CH",
  "I Chronicles": "1CH",
  IChronicles: "1CH",
  "I Chr": "1CH",
  "IChr": "1CH",
  "2 Chronicles": "2CH",
  "2Chronicles": "2CH",
  "2 Chr": "2CH",
  "2Chr": "2CH",
  "II Chronicles": "2CH",
  IIChronicles: "2CH",
  "II Chr": "2CH",
  "IIChr": "2CH",
  Ezra: "EZR",
  Nehemiah: "NEH",
  Esther: "EST",
  Job: "JOB",
  Psalm: "PSA",
  Psalms: "PSA",
  Proverbs: "PRO",
  Ecclesiastes: "ECC",
  "Song of Songs": "SNG",
  "Song of Solomon": "SNG",
  Canticles: "SNG",
  Isaiah: "ISA",
  Jeremiah: "JER",
  Lamentations: "LAM",
  Ezekiel: "EZK",
  Daniel: "DAN",
  Hosea: "HOS",
  Joel: "JOL",
  Amos: "AMO",
  Obadiah: "OBA",
  Jonah: "JON",
  Micah: "MIC",
  Nahum: "NAM",
  Habakkuk: "HAB",
  Zephaniah: "ZEP",
  Haggai: "HAG",
  Zechariah: "ZEC",
  Malachi: "MAL",
  // New Testament
  Matthew: "MAT",
  Matt: "MAT",
  Mark: "MRK",
  Luke: "LUK",
  John: "JHN",
  Acts: "ACT",
  Romans: "ROM",
  Rom: "ROM",
  "1 Corinthians": "1CO",
  "1Corinthians": "1CO",
  "1 Cor": "1CO",
  "1Cor": "1CO",
  "I Corinthians": "1CO",
  ICorinthians: "1CO",
  "I Cor": "1CO",
  "ICor": "1CO",
  "2 Corinthians": "2CO",
  "2Corinthians": "2CO",
  "2 Cor": "2CO",
  "2Cor": "2CO",
  "II Corinthians": "2CO",
  IICorinthians: "2CO",
  "II Cor": "2CO",
  "IICor": "2CO",
  Galatians: "GAL",
  Ephesians: "EPH",
  Philippians: "PHP",
  Colossians: "COL",
  "1 Thessalonians": "1TH",
  "1Thessalonians": "1TH",
  "1 Thess": "1TH",
  "1Thess": "1TH",
  "I Thessalonians": "1TH",
  IThessalonians: "1TH",
  "I Thess": "1TH",
  "IThess": "1TH",
  "2 Thessalonians": "2TH",
  "2Thessalonians": "2TH",
  "2 Thess": "2TH",
  "2Thess": "2TH",
  "II Thessalonians": "2TH",
  IIThessalonians: "2TH",
  "II Thess": "2TH",
  "IIThess": "2TH",
  "1 Timothy": "1TI",
  "1Timothy": "1TI",
  "1 Tim": "1TI",
  "1Tim": "1TI",
  "I Timothy": "1TI",
  ITimothy: "1TI",
  "I Tim": "1TI",
  "ITim": "1TI",
  "2 Timothy": "2TI",
  "2Timothy": "2TI",
  "2 Tim": "2TI",
  "2Tim": "2TI",
  "II Timothy": "2TI",
  IITimothy: "2TI",
  "II Tim": "2TI",
  "IITim": "2TI",
  Titus: "TIT",
  Philemon: "PHM",
  Hebrews: "HEB",
  James: "JAS",
  Jms: "JAS",
  "1 Peter": "1PE",
  "1Peter": "1PE",
  "1 Pet": "1PE",
  "1Pet": "1PE",
  "I Peter": "1PE",
  IPeter: "1PE",
  "I Pet": "1PE",
  "IPet": "1PE",
  "2 Peter": "2PE",
  "2Peter": "2PE",
  "2 Pet": "2PE",
  "2Pet": "2PE",
  "II Peter": "2PE",
  IIPeter: "2PE",
  "II Pet": "2PE",
  "IIPet": "2PE",
  "1 John": "1JN",
  "1John": "1JN",
  "1 Jn": "1JN",
  "1Jn": "1JN",
  "I John": "1JN",
  IJohn: "1JN",
  "I Jn": "1JN",
  "IJn": "1JN",
  "2 John": "2JN",
  "2John": "2JN",
  "2 Jn": "2JN",
  "2Jn": "2JN",
  "II John": "2JN",
  IIJohn: "2JN",
  "II Jn": "2JN",
  "IIJn": "2JN",
  "3 John": "3JN",
  "3John": "3JN",
  "3 Jn": "3JN",
  "3Jn": "3JN",
  "III John": "3JN",
  IIIJohn: "3JN",
  "III Jn": "3JN",
  "IIIJn": "3JN",
  Jude: "JUD",
  Revelation: "REV",
  Rev: "REV",
  Apocalypse: "REV",
};

// References originate in model output, so capitalization should not affect
// whether a valid book name can be resolved.
const CASEFOLDED_BOOK_IDS: Record<string, string> = Object.fromEntries(
  Object.entries(BOOK_IDS).map(([name, id]) => [name.toLowerCase(), id]),
);

type BibleContent = string | { text?: unknown; content?: BibleContent[] } | BibleContent[];

interface BibleChapter {
  chapter?: {
    content?: Array<{
      type?: unknown;
      number?: unknown;
      content?: BibleContent;
    }>;
  };
}

interface ResponsesEventData {
  delta?: string;
}

function normalizeReference(rawReference: string): string {
  let reference = rawReference.trim().split(/\s+/).join(" ");
  reference = reference.replace(/\bFirst\b/gi, "1");
  reference = reference.replace(/\bSecond\b/gi, "2");
  reference = reference.replace(/\bThird\b/gi, "3");
  reference = reference.replace(/\b([1-3])\s+/g, "$1");
  return reference;
}

function parseReference(reference: string): { bookId: string; chapter: number; verses: number[] } {
  const normalized = normalizeReference(reference);
  const match = normalized.match(/^(\d?\s*(?:[A-Za-z]+\s+){0,3}[A-Za-z]+)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/);
  if (!match) {
    throw new Error(`Could not parse reference: ${JSON.stringify(reference)}`);
  }

  const bookPart = match[1].split(/\s+/).join(" ");
  const chapter = Number.parseInt(match[2], 10);
  const startVerse = match[3];
  const endVerse = match[4];

  let bookId = CASEFOLDED_BOOK_IDS[bookPart.toLowerCase()];
  if (bookId === undefined) {
    bookId = CASEFOLDED_BOOK_IDS[bookPart.replace(/\s+/g, "").toLowerCase()];
  }
  if (bookId === undefined) {
    throw new Error(`Unknown book name: ${bookPart}`);
  }

  if (startVerse === undefined) {
    return { bookId, chapter, verses: [] };
  }

  const start = Number.parseInt(startVerse, 10);
  const end = endVerse !== undefined ? Number.parseInt(endVerse, 10) : start;
  if (end < start) {
    throw new Error(`Invalid verse range: ${start}-${end}`);
  }
  return { bookId, chapter, verses: Array.from({ length: end - start + 1 }, (_, i) => start + i) };
}

function extractText(content: BibleContent): string {
  const parts: string[] = [];
  const walk = (fragment: BibleContent): void => {
    if (typeof fragment === "string") {
      parts.push(fragment);
      return;
    }
    if (Array.isArray(fragment)) {
      for (const item of fragment) walk(item);
      return;
    }
    if (typeof fragment === "object" && fragment !== null) {
      if (typeof fragment.text === "string") {
        parts.push(fragment.text);
      }
      if (Array.isArray(fragment.content)) {
        for (const item of fragment.content) walk(item);
      }
    }
  };
  walk(content);
  return parts.join(" ");
}

export async function fetchBibleVerse(reference: string, translation = "BSB"): Promise<string> {
  const { bookId, chapter, verses } = parseReference(reference);
  const url = BIBLE_API_URL_TEMPLATE.replace("{translation}", translation)
    .replace("{book}", bookId)
    .replace("{chapter}", String(chapter));

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`Bible API HTTP error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as BibleChapter;
  const chapterContent = data.chapter?.content ?? [];

  const verseMap = new Map<number, string>();
  for (const item of chapterContent) {
    if (item.type === "verse" && typeof item.number === "number") {
      verseMap.set(item.number, extractText(item.content ?? []).trim());
    }
  }

  let selectedVerses = verses;
  if (selectedVerses.length === 0) {
    selectedVerses = Array.from(verseMap.keys()).sort((a, b) => a - b);
  }

  const missing = selectedVerses.filter((v) => !verseMap.has(v));
  if (missing.length > 0) {
    throw new Error(`Verse(s) not found in ${reference}: ${missing.join(", ")}`);
  }

  const selected = selectedVerses.map((v) => verseMap.get(v)!).join(" ");
  return `${selected} (${reference}, ${translation})`;
}

// Yields text deltas from Guarded Responses SSE lines. Each event arrives as an
// `event:` line followed by a `data:` line. Text comes from
// `response.output_text.delta`; other `response.*` events are lifecycle events
// and are ignored. Any other event (such as `error`) ends the stream with an
// error, as does malformed JSON.
export async function* extractTextDeltas(lines: AsyncIterable<string>): AsyncGenerator<string> {
  let event: string | undefined;
  for await (const line of lines) {
    const normalizedLine = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (normalizedLine.startsWith("event:")) {
      event = normalizedLine.slice("event:".length).trim();
      continue;
    }
    if (!normalizedLine.startsWith("data:")) {
      continue;
    }
    let data: ResponsesEventData;
    try {
      data = JSON.parse(normalizedLine.slice("data:".length).trim()) as ResponsesEventData;
    } catch (cause) {
      throw new Error("Received malformed JSON in an SSE data event", { cause });
    }
    const current = event;
    event = undefined;
    if (current === "response.output_text.delta") {
      if (data.delta) yield data.delta;
    } else if (current === "response.completed") {
      return;
    } else if (current === undefined || !current.startsWith("response.")) {
      throw new Error(`Stream terminated by event '${current}': ${JSON.stringify(data)}`);
    }
  }
}

export async function* extractRawSSELines(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        yield line;
      }
    }
    if (pending !== "") {
      yield pending;
    }
  } finally {
    reader.releaseLock();
  }
}

function findIncompletePrefix(buffer: string): number | undefined {
  const markerIndex = buffer.lastIndexOf(PLACEHOLDER_START);
  if (markerIndex !== -1) {
    const referenceStart = markerIndex + PLACEHOLDER_START.length;
    if (!buffer.slice(referenceStart).includes("}}")) {
      return markerIndex;
    }
  }

  const maxPrefixLength = Math.min(buffer.length, PLACEHOLDER_START.length - 1);
  for (let prefixLength = maxPrefixLength; prefixLength > 0; prefixLength--) {
    if (buffer.endsWith(PLACEHOLDER_START.slice(0, prefixLength))) {
      return buffer.length - prefixLength;
    }
  }

  return undefined;
}

export async function streamWithSubstitution(
  sseLines: AsyncIterable<string>,
  fetchBible: (reference: string, translation: string) => Promise<string>,
  write: (s: string) => void,
  translation: string,
): Promise<void> {
  let buffer = "";
  // True after a substituted verse that already ends a sentence, until we see
  // the next character and know whether it is a redundant period.
  let dropPeriod = false;

  const skipRedundantPeriod = (text: string): string => {
    if (dropPeriod && text) {
      dropPeriod = false;
      if (text.startsWith(".")) return text.slice(1);
    }
    return text;
  };

  for await (const delta of sseLines) {
    buffer = skipRedundantPeriod(buffer + delta);

    while (true) {
      PLACEHOLDER_RE.lastIndex = 0;
      const match = PLACEHOLDER_RE.exec(buffer);
      if (!match) break;

      write(buffer.slice(0, match.index));

      const reference = match[1].trim();
      let verseText: string;
      let substituted: boolean;
      try {
        verseText = await fetchBible(reference, translation);
        substituted = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        verseText = `{{SCRIPTURE:${reference}}}`;
        substituted = false;
        write(`\n[Bible API error for ${reference}: ${message}]\n`);
      }

      write(verseText);
      dropPeriod = substituted && ENDS_SENTENCE_RE.test(verseText);
      buffer = skipRedundantPeriod(buffer.slice(match.index + match[0].length));
    }

    const prefixIdx = findIncompletePrefix(buffer);
    if (prefixIdx !== undefined) {
      write(buffer.slice(0, prefixIdx));
      buffer = buffer.slice(prefixIdx);
    } else {
      write(buffer);
      buffer = "";
    }
  }

  write(buffer);
}

interface RequestBody {
  model: string;
  instructions: string;
  input: string;
  stream: boolean;
  tradition?: string;
}

function buildRequestBody(prompt: string, tradition: string | undefined): RequestBody {
  const body: RequestBody = {
    model: MODEL,
    instructions: SYSTEM_PROMPT,
    input: prompt,
    stream: true,
  };
  if (tradition !== undefined) {
    body.tradition = tradition;
  }
  return body;
}

function parseArgs(argv: string[]): { prompt: string; tradition: string | undefined; translation: string } {
  const args = argv.slice(2);
  let prompt = "";
  let tradition: string | undefined;
  let translation = "BSB";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--tradition") {
      tradition = args[++i];
    } else if (arg === "--translation") {
      translation = args[++i];
    } else if (!arg.startsWith("--")) {
      if (prompt) prompt += " ";
      prompt += arg;
    }
  }

  if (!prompt) {
    stderr.write("Error: prompt is required.\n");
    process.exit(1);
  }

  return { prompt, tradition, translation };
}

async function main(): Promise<void> {
  const apiKey = process.env.GLOO_API_KEY;
  if (!apiKey) {
    stderr.write(
      "Error: GLOO_API_KEY is not set. " +
        "Get your API key from https://studio.ai.gloo.com/api-keys " +
        "and add it to your environment or .env file.\n",
    );
    process.exit(1);
  }

  const { prompt, tradition, translation } = parseArgs(process.argv);
  const body = buildRequestBody(prompt, tradition);

  let response: Response;
  try {
    response = await fetch(GLOO_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`Error: failed to connect to Gloo AI API: ${message}\n`);
    process.exit(1);
  }

  if (!response.ok) {
    // Surface the API's own reason, e.g. "Unknown model ..." for a bad MODEL.
    const raw = await response.text();
    let detail: string = raw;
    try {
      detail = (JSON.parse(raw) as { detail?: { message?: string } }).detail?.message ?? raw;
    } catch {
      // Not JSON; fall back to the raw body.
    }
    stderr.write(`Error: Gloo AI API returned HTTP ${response.status}: ${detail}\n`);
    process.exit(1);
  }

  const sseLines = extractTextDeltas(extractRawSSELines(response));

  try {
    await streamWithSubstitution(sseLines, fetchBibleVerse, (s) => stdout.write(s), translation);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`\nError: streaming failed: ${message}\n`);
    process.exit(1);
  }

  stdout.write("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
}
