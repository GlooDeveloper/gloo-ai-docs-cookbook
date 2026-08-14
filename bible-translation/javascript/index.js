import "dotenv/config";
import { fileURLToPath } from "node:url";

export const GLOO_API_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";
export const BIBLE_API_URL_TEMPLATE =
  "https://bible.helloao.org/api/{translation}/{book}/{chapter}.json";

export const SYSTEM_PROMPT =
  "Never quote Bible verses directly from memory. When you want to reference " +
  "a passage of Scripture, use the placeholder format {{SCRIPTURE:reference}} " +
  "(e.g., {{SCRIPTURE:John 3:16}}, {{SCRIPTURE:Romans 8:28-30}}). The system " +
  "will replace these placeholders with the actual verse text from the " +
  "specified Bible translation. You may still discuss, explain, and comment " +
  "on Scripture, but the actual verse text must always come through the " +
  "placeholder mechanism.";

export const PLACEHOLDER_START = "{{SCRIPTURE:";
export const PLACEHOLDER_RE = /\{\{SCRIPTURE:([^}]+)\}\}/;

const CASEFOLDED_BOOK_IDS = Object.fromEntries(
  Object.entries({
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
    IChr: "1CH",
    "2 Chronicles": "2CH",
    "2Chronicles": "2CH",
    "2 Chr": "2CH",
    "2Chr": "2CH",
    "II Chronicles": "2CH",
    IIChronicles: "2CH",
    "II Chr": "2CH",
    IIChr: "2CH",
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
    ICor: "1CO",
    "2 Corinthians": "2CO",
    "2Corinthians": "2CO",
    "2 Cor": "2CO",
    "2Cor": "2CO",
    "II Corinthians": "2CO",
    IICorinthians: "2CO",
    "II Cor": "2CO",
    IICor: "2CO",
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
    IThess: "1TH",
    "2 Thessalonians": "2TH",
    "2Thessalonians": "2TH",
    "2 Thess": "2TH",
    "2Thess": "2TH",
    "II Thessalonians": "2TH",
    IIThessalonians: "2TH",
    "II Thess": "2TH",
    IIThess: "2TH",
    "1 Timothy": "1TI",
    "1Timothy": "1TI",
    "1 Tim": "1TI",
    "1Tim": "1TI",
    "I Timothy": "1TI",
    ITimothy: "1TI",
    "I Tim": "1TI",
    ITim: "1TI",
    "2 Timothy": "2TI",
    "2Timothy": "2TI",
    "2 Tim": "2TI",
    "2Tim": "2TI",
    "II Timothy": "2TI",
    IITimothy: "2TI",
    "II Tim": "2TI",
    IITim: "2TI",
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
    IPet: "1PE",
    "2 Peter": "2PE",
    "2Peter": "2PE",
    "2 Pet": "2PE",
    "2Pet": "2PE",
    "II Peter": "2PE",
    IIPeter: "2PE",
    "II Pet": "2PE",
    IIPet: "2PE",
    "1 John": "1JN",
    "1John": "1JN",
    "1 Jn": "1JN",
    "1Jn": "1JN",
    "I John": "1JN",
    IJohn: "1JN",
    "I Jn": "1JN",
    IJn: "1JN",
    "2 John": "2JN",
    "2John": "2JN",
    "2 Jn": "2JN",
    "2Jn": "2JN",
    "II John": "2JN",
    IIJohn: "2JN",
    "II Jn": "2JN",
    IIJn: "2JN",
    "3 John": "3JN",
    "3John": "3JN",
    "3 Jn": "3JN",
    "3Jn": "3JN",
    "III John": "3JN",
    IIIJohn: "3JN",
    "III Jn": "3JN",
    IIIJn: "3JN",
    Jude: "JUD",
    Revelation: "REV",
    Rev: "REV",
    Apocalypse: "REV",
  }).map(([name, id]) => [name.toLowerCase(), id])
);

export function normalizeReference(rawReference) {
  let reference = rawReference.trim().replace(/\s+/g, " ");
  reference = reference
    .replace(/\bFirst\b/gi, "1")
    .replace(/\bSecond\b/gi, "2")
    .replace(/\bThird\b/gi, "3");
  reference = reference.replace(/\b([1-3])\s+/g, "$1");
  return reference;
}

export function parseReference(reference) {
  const normalized = normalizeReference(reference);
  const match = normalized.match(
    /^(\d?\s*(?:[A-Za-z]+\s+){0,3}[A-Za-z]+)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/
  );
  if (!match) {
    throw new Error(`Could not parse reference: ${reference}`);
  }

  const bookPart = match[1].trim().replace(/\s+/g, " ");
  const chapter = parseInt(match[2], 10);
  const startVerse = match[3];
  const endVerse = match[4];

  let bookId = CASEFOLDED_BOOK_IDS[bookPart.toLowerCase()];
  if (!bookId) {
    bookId = CASEFOLDED_BOOK_IDS[bookPart.replace(/\s+/g, "").toLowerCase()];
  }
  if (!bookId) {
    throw new Error(`Unknown book name: ${bookPart}`);
  }

  if (!startVerse) {
    return { bookId, chapter, verses: [] };
  }

  const start = parseInt(startVerse, 10);
  const end = endVerse ? parseInt(endVerse, 10) : start;
  if (end < start) {
    throw new Error(`Invalid verse range: ${start}-${end}`);
  }
  return {
    bookId,
    chapter,
    verses: Array.from({ length: end - start + 1 }, (_, i) => start + i),
  };
}

function extractText(content) {
  const texts = [];
  for (const fragment of content) {
    if (typeof fragment === "string") {
      texts.push(fragment);
    } else if (fragment && typeof fragment === "object") {
      if (Array.isArray(fragment)) {
        texts.push(extractText(fragment));
      } else if (typeof fragment.text === "string") {
        texts.push(fragment.text);
      }
    }
  }
  return texts.join(" ");
}

export async function fetchBibleVerse(reference, translation = "BSB") {
  const { bookId, chapter, verses } = parseReference(reference);

  const url = BIBLE_API_URL_TEMPLATE.replace("{translation}", translation)
    .replace("{book}", bookId)
    .replace("{chapter}", String(chapter));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Bible API request failed: ${response.status} ${response.statusText}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`Bible API returned invalid JSON: ${err.message}`);
  }

  const chapterContent = data?.chapter?.content ?? [];
  const verseMap = {};
  for (const item of chapterContent) {
    if (item?.type === "verse" && "number" in item) {
      verseMap[item.number] = extractText(item.content ?? []).trim();
    }
  }

  const selectedVerses = verses.length
    ? verses
    : Object.keys(verseMap)
        .map((n) => parseInt(n, 10))
        .sort((a, b) => a - b);

  const missing = selectedVerses.filter((v) => !Object.hasOwn(verseMap, v));
  if (missing.length) {
    throw new Error(`Verse(s) not found in ${reference}: ${missing.join(", ")}`);
  }

  const selected = selectedVerses.map((v) => verseMap[v]).join(" ");
  return `${selected} (${reference}, ${translation})`;
}

export async function* extractSSEContentLines(response) {
  const decoder = new TextDecoder("utf-8");
  let pending = "";
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop();
      for (let raw of lines) {
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (!raw || !raw.startsWith("data: ")) continue;
        const payload = raw.slice(6);
        if (payload === "[DONE]") return;
        let chunk;
        try {
          chunk = JSON.parse(payload);
        } catch (err) {
          throw new Error(
            `Received malformed JSON in an SSE data event: ${err.message}`
          );
        }
        const content = chunk?.choices?.[0]?.delta?.content;
        if (content) yield content;
      }
    }
    if (pending) {
      let raw = pending;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith("data: ")) {
        const payload = raw.slice(6);
        if (payload !== "[DONE]") {
          let chunk;
          try {
            chunk = JSON.parse(payload);
          } catch (err) {
            throw new Error(
              `Received malformed JSON in an SSE data event: ${err.message}`
            );
          }
          const content = chunk?.choices?.[0]?.delta?.content;
          if (content) yield content;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function findIncompletePrefix(buffer) {
  const marker = PLACEHOLDER_START;
  const markerIndex = buffer.lastIndexOf(marker);
  if (markerIndex !== -1) {
    const referenceStart = markerIndex + marker.length;
    if (!buffer.includes("}}", referenceStart)) {
      return markerIndex;
    }
  }

  const maxPrefixLength = Math.min(buffer.length, marker.length - 1);
  for (let prefixLength = maxPrefixLength; prefixLength >= 1; prefixLength--) {
    if (buffer.endsWith(marker.slice(0, prefixLength))) {
      return buffer.length - prefixLength;
    }
  }
  return null;
}

export async function streamWithSubstitution(deltas, fetchBibleVerse, write) {
  let buffer = "";

  for await (const delta of deltas) {
    buffer += delta;

    // Process every complete placeholder currently in the buffer.
    while (true) {
      const match = buffer.match(PLACEHOLDER_RE);
      if (!match) break;

      write(buffer.slice(0, match.index));

      const reference = match[1].trim();
      let verseText;
      try {
        verseText = await fetchBibleVerse(reference);
      } catch (err) {
        // Graceful failure: leave the placeholder visible.
        verseText = `{{SCRIPTURE:${reference}}}`;
        process.stderr.write(`\n[Bible API error for ${reference}: ${err.message}]\n`);
      }

      write(verseText);
      buffer = buffer.slice(match.index + match[0].length);
    }

    // Hold back a trailing placeholder prefix.
    const prefixIdx = findIncompletePrefix(buffer);
    if (prefixIdx !== null) {
      write(buffer.slice(0, prefixIdx));
      buffer = buffer.slice(prefixIdx);
    } else {
      write(buffer);
      buffer = "";
    }
  }

  // Stream ended: emit any leftover content unchanged.
  write(buffer);
}

export function buildRequestBody(prompt, tradition) {
  const body = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    auto_routing: true,
    stream: true,
  };
  if (tradition !== undefined) {
    body.tradition = tradition;
  }
  return body;
}

export function parseArgs(argv) {
  let translation = "BSB";
  let tradition;
  const promptParts = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--translation") {
      const next = argv[++i];
      if (next === undefined) throw new Error(`Missing value for --translation`);
      translation = next;
    } else if (arg === "--tradition") {
      const next = argv[++i];
      if (next === undefined) throw new Error(`Missing value for --tradition`);
      tradition = next;
    } else if (arg.startsWith("--translation=")) {
      translation = arg.slice("--translation=".length);
    } else if (arg.startsWith("--tradition=")) {
      tradition = arg.slice("--tradition=".length);
    } else {
      promptParts.push(arg);
    }
  }

  const prompt = promptParts.join(" ");
  if (!prompt) {
    throw new Error("Missing required positional argument: prompt");
  }

  return { prompt, tradition, translation };
}

export async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  const apiKey = process.env.GLOO_API_KEY;
  if (!apiKey) {
    process.stderr.write(
      "Error: GLOO_API_KEY is not set. " +
        "Get your API key from https://studio.ai.gloo.com/api-keys " +
        "and add it to your environment or .env file.\n"
    );
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const body = buildRequestBody(args.prompt, args.tradition);

  let response;
  try {
    response = await fetch(GLOO_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    process.stderr.write(`Error: failed to connect to Gloo AI API: ${err.message}\n`);
    process.exit(1);
  }

  if (!response.ok) {
    process.stderr.write(
      `Error: Gloo AI API returned ${response.status} ${response.statusText}\n`
    );
    process.exit(1);
  }

  try {
    await streamWithSubstitution(
      extractSSEContentLines(response),
      (reference) => fetchBibleVerse(reference, args.translation),
      (text) => process.stdout.write(text)
    );
  } catch (err) {
    process.stderr.write(`\nError: streaming failed: ${err.message}\n`);
    process.exit(1);
  }

  process.stdout.write("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
