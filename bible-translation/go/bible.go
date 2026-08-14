package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"
)

const (
	glooAPIURL          = "https://platform.ai.gloo.com/ai/v2/chat/completions"
	bibleAPIURLTemplate = "https://bible.helloao.org/api/%s/%s/%d.json"
	placeholderStart    = "{{SCRIPTURE:"
	systemPrompt        = "Never quote Bible verses directly from memory. When you want to reference a passage of Scripture, use the placeholder format {{SCRIPTURE:reference}} (e.g., {{SCRIPTURE:John 3:16}}, {{SCRIPTURE:Romans 8:28-30}}). The system will replace these placeholders with the actual verse text from the specified Bible translation. You may still discuss, explain, and comment on Scripture, but the actual verse text must always come through the placeholder mechanism."
)

var placeholderRe = regexp.MustCompile(`\{\{SCRIPTURE:([^}]+)\}\}`)

// BOOK_IDS maps common book names and variants to USFM identifiers.
var BOOK_IDS = map[string]string{
	// Old Testament
	"Genesis":         "GEN",
	"Exodus":          "EXO",
	"Leviticus":       "LEV",
	"Numbers":         "NUM",
	"Deuteronomy":     "DEU",
	"Joshua":          "JOS",
	"Judges":          "JDG",
	"Ruth":            "RUT",
	"1 Samuel":        "1SA",
	"1Samuel":         "1SA",
	"1 Sam":           "1SA",
	"1Sam":            "1SA",
	"I Samuel":        "1SA",
	"ISamuel":         "1SA",
	"I Sam":           "1SA",
	"ISam":            "1SA",
	"2 Samuel":        "2SA",
	"2Samuel":         "2SA",
	"2 Sam":           "2SA",
	"2Sam":            "2SA",
	"II Samuel":       "2SA",
	"IISamuel":        "2SA",
	"II Sam":          "2SA",
	"IISam":           "2SA",
	"1 Kings":         "1KI",
	"1Kings":          "1KI",
	"1 Kgs":           "1KI",
	"1Kgs":            "1KI",
	"I Kings":         "1KI",
	"IKings":          "1KI",
	"I Kgs":           "1KI",
	"IKgs":            "1KI",
	"2 Kings":         "2KI",
	"2Kings":          "2KI",
	"2 Kgs":           "2KI",
	"2Kgs":            "2KI",
	"II Kings":        "2KI",
	"IIKings":         "2KI",
	"II Kgs":          "2KI",
	"IIKgs":           "2KI",
	"1 Chronicles":    "1CH",
	"1Chronicles":     "1CH",
	"1 Chr":           "1CH",
	"1Chr":            "1CH",
	"I Chronicles":    "1CH",
	"IChronicles":     "1CH",
	"I Chr":           "1CH",
	"IChr":            "1CH",
	"2 Chronicles":    "2CH",
	"2Chronicles":     "2CH",
	"2 Chr":           "2CH",
	"2Chr":            "2CH",
	"II Chronicles":   "2CH",
	"IIChronicles":    "2CH",
	"II Chr":          "2CH",
	"IIChr":           "2CH",
	"Ezra":            "EZR",
	"Nehemiah":        "NEH",
	"Esther":          "EST",
	"Job":             "JOB",
	"Psalm":           "PSA",
	"Psalms":          "PSA",
	"Proverbs":        "PRO",
	"Ecclesiastes":    "ECC",
	"Song of Songs":   "SNG",
	"Song of Solomon": "SNG",
	"Canticles":       "SNG",
	"Isaiah":          "ISA",
	"Jeremiah":        "JER",
	"Lamentations":    "LAM",
	"Ezekiel":         "EZK",
	"Daniel":          "DAN",
	"Hosea":           "HOS",
	"Joel":            "JOL",
	"Amos":            "AMO",
	"Obadiah":         "OBA",
	"Jonah":           "JON",
	"Micah":           "MIC",
	"Nahum":           "NAM",
	"Habakkuk":        "HAB",
	"Zephaniah":       "ZEP",
	"Haggai":          "HAG",
	"Zechariah":       "ZEC",
	"Malachi":         "MAL",
	// New Testament
	"Matthew":          "MAT",
	"Matt":             "MAT",
	"Mark":             "MRK",
	"Luke":             "LUK",
	"John":             "JHN",
	"Acts":             "ACT",
	"Romans":           "ROM",
	"Rom":              "ROM",
	"1 Corinthians":    "1CO",
	"1Corinthians":     "1CO",
	"1 Cor":            "1CO",
	"1Cor":             "1CO",
	"I Corinthians":    "1CO",
	"ICorinthians":     "1CO",
	"I Cor":            "1CO",
	"ICor":             "1CO",
	"2 Corinthians":    "2CO",
	"2Corinthians":     "2CO",
	"2 Cor":            "2CO",
	"2Cor":             "2CO",
	"II Corinthians":   "2CO",
	"IICorinthians":    "2CO",
	"II Cor":           "2CO",
	"IICor":            "2CO",
	"Galatians":        "GAL",
	"Ephesians":        "EPH",
	"Philippians":      "PHP",
	"Colossians":       "COL",
	"1 Thessalonians":  "1TH",
	"1Thessalonians":   "1TH",
	"1 Thess":          "1TH",
	"1Thess":           "1TH",
	"I Thessalonians":  "1TH",
	"IThessalonians":   "1TH",
	"I Thess":          "1TH",
	"IThess":           "1TH",
	"2 Thessalonians":  "2TH",
	"2Thessalonians":   "2TH",
	"2 Thess":          "2TH",
	"2Thess":           "2TH",
	"II Thessalonians": "2TH",
	"IIThessalonians":  "2TH",
	"II Thess":         "2TH",
	"IIThess":          "2TH",
	"1 Timothy":        "1TI",
	"1Timothy":         "1TI",
	"1 Tim":            "1TI",
	"1Tim":             "1TI",
	"I Timothy":        "1TI",
	"ITimothy":         "1TI",
	"I Tim":            "1TI",
	"ITim":             "1TI",
	"2 Timothy":        "2TI",
	"2Timothy":         "2TI",
	"2 Tim":            "2TI",
	"2Tim":             "2TI",
	"II Timothy":       "2TI",
	"IITimothy":        "2TI",
	"II Tim":           "2TI",
	"IITim":            "2TI",
	"Titus":            "TIT",
	"Philemon":         "PHM",
	"Hebrews":          "HEB",
	"James":            "JAS",
	"Jms":              "JAS",
	"1 Peter":          "1PE",
	"1Peter":           "1PE",
	"1 Pet":            "1PE",
	"1Pet":             "1PE",
	"I Peter":          "1PE",
	"IPeter":           "1PE",
	"I Pet":            "1PE",
	"IPet":             "1PE",
	"2 Peter":          "2PE",
	"2Peter":           "2PE",
	"2 Pet":            "2PE",
	"2Pet":             "2PE",
	"II Peter":         "2PE",
	"IIPeter":          "2PE",
	"II Pet":           "2PE",
	"IIPet":            "2PE",
	"1 John":           "1JN",
	"1John":            "1JN",
	"1 Jn":             "1JN",
	"1Jn":              "1JN",
	"I John":           "1JN",
	"IJohn":            "1JN",
	"I Jn":             "1JN",
	"IJn":              "1JN",
	"2 John":           "2JN",
	"2John":            "2JN",
	"2 Jn":             "2JN",
	"2Jn":              "2JN",
	"II John":          "2JN",
	"IIJohn":           "2JN",
	"II Jn":            "2JN",
	"IIJn":             "2JN",
	"3 John":           "3JN",
	"3John":            "3JN",
	"3 Jn":             "3JN",
	"3Jn":              "3JN",
	"III John":         "3JN",
	"IIIJohn":          "3JN",
	"III Jn":           "3JN",
	"IIIJn":            "3JN",
	"Jude":             "JUD",
	"Revelation":       "REV",
	"Rev":              "REV",
	"Apocalypse":       "REV",
}

var casefoldedBookIDs map[string]string

func init() {
	casefoldedBookIDs = make(map[string]string, len(BOOK_IDS))
	for name, id := range BOOK_IDS {
		casefoldedBookIDs[strings.ToLower(name)] = id
	}
}

var (
	reFirst  = regexp.MustCompile(`(?i)\bFirst\b`)
	reSecond = regexp.MustCompile(`(?i)\bSecond\b`)
	reThird  = regexp.MustCompile(`(?i)\bThird\b`)
	reDigit  = regexp.MustCompile(`([1-3])\s+`)
)

// NormalizeReference normalizes whitespace and written-number prefixes.
func NormalizeReference(raw string) string {
	ref := strings.Join(strings.Fields(strings.TrimSpace(raw)), " ")
	ref = reFirst.ReplaceAllString(ref, "1")
	ref = reSecond.ReplaceAllString(ref, "2")
	ref = reThird.ReplaceAllString(ref, "3")
	ref = reDigit.ReplaceAllString(ref, "$1")
	return ref
}

// ParseReference parses a human-readable reference into USFM components.
func ParseReference(reference string) (bookID string, chapter int, verses []int, err error) {
	normalized := NormalizeReference(reference)
	re := regexp.MustCompile(`^(\d?\s*(?:[A-Za-z]+\s+){0,3}[A-Za-z]+)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$`)
	match := re.FindStringSubmatch(normalized)
	if match == nil {
		return "", 0, nil, fmt.Errorf("could not parse reference: %q", reference)
	}
	bookPart := strings.Join(strings.Fields(match[1]), " ")
	if _, err := fmt.Sscanf(match[2], "%d", &chapter); err != nil {
		return "", 0, nil, fmt.Errorf("could not parse chapter: %q", match[2])
	}

	bookID, ok := casefoldedBookIDs[strings.ToLower(bookPart)]
	if !ok {
		bookID, ok = casefoldedBookIDs[strings.ToLower(strings.ReplaceAll(bookPart, " ", ""))]
	}
	if !ok {
		return "", 0, nil, fmt.Errorf("unknown book name: %s", bookPart)
	}

	if match[3] == "" {
		return bookID, chapter, []int{}, nil
	}
	var start int
	if _, err := fmt.Sscanf(match[3], "%d", &start); err != nil {
		return "", 0, nil, fmt.Errorf("could not parse verse: %q", match[3])
	}
	end := start
	if match[4] != "" {
		if _, err := fmt.Sscanf(match[4], "%d", &end); err != nil {
			return "", 0, nil, fmt.Errorf("could not parse verse range end: %q", match[4])
		}
	}
	if end < start {
		return "", 0, nil, fmt.Errorf("invalid verse range: %d-%d", start, end)
	}
	for i := start; i <= end; i++ {
		verses = append(verses, i)
	}
	return bookID, chapter, verses, nil
}

// FetchBibleVerse fetches verse text from bible.helloao.org and returns a formatted citation.
func FetchBibleVerse(reference, translation string, client *http.Client) (string, error) {
	if client == nil {
		client = http.DefaultClient
	}
	bookID, chapter, verses, err := ParseReference(reference)
	if err != nil {
		return "", err
	}
	url := fmt.Sprintf(bibleAPIURLTemplate, translation, bookID, chapter)
	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Bible API returned status %d", resp.StatusCode)
	}
	var data struct {
		Chapter struct {
			Content []interface{} `json:"content"`
		} `json:"chapter"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", fmt.Errorf("failed to decode Bible API response: %w", err)
	}

	verseMap := make(map[int]string)
	for _, item := range data.Chapter.Content {
		if m, ok := item.(map[string]interface{}); ok && m["type"] == "verse" {
			num, ok := toInt(m["number"])
			if !ok {
				continue
			}
			content, _ := m["content"].([]interface{})
			verseMap[num] = strings.Join(strings.Fields(extractText(content)), " ")
		}
	}

	if len(verses) == 0 {
		for v := range verseMap {
			verses = append(verses, v)
		}
		sort.Ints(verses)
	}

	selected := make([]string, 0, len(verses))
	for _, v := range verses {
		text, ok := verseMap[v]
		if !ok {
			return "", fmt.Errorf("verse(s) not found in %s: [%d]", reference, v)
		}
		selected = append(selected, text)
	}
	return fmt.Sprintf("%s (%s, %s)", strings.Join(selected, " "), reference, translation), nil
}

func toInt(v interface{}) (int, bool) {
	switch n := v.(type) {
	case float64:
		return int(n), true
	case int:
		return n, true
	case string:
		var i int
		if _, err := fmt.Sscanf(n, "%d", &i); err == nil {
			return i, true
		}
	}
	return 0, false
}

func extractText(content interface{}) string {
	switch v := content.(type) {
	case string:
		return v
	case []interface{}:
		var parts []string
		for _, item := range v {
			parts = append(parts, extractText(item))
		}
		return strings.Join(parts, " ")
	case map[string]interface{}:
		if t, ok := v["text"].(string); ok {
			return t
		}
		if content, ok := v["content"]; ok {
			return extractText(content)
		}
	}
	return ""
}

// FindIncompletePrefix returns the index at which a placeholder prefix begins, if any.
func FindIncompletePrefix(buffer string) *int {
	markerIndex := strings.LastIndex(buffer, placeholderStart)
	if markerIndex != -1 {
		referenceStart := markerIndex + len(placeholderStart)
		if !strings.Contains(buffer[referenceStart:], "}}") {
			return &markerIndex
		}
	}
	maxPrefixLength := len(buffer)
	if maxPrefixLength > len(placeholderStart)-1 {
		maxPrefixLength = len(placeholderStart) - 1
	}
	for prefixLength := maxPrefixLength; prefixLength > 0; prefixLength-- {
		if strings.HasSuffix(buffer, placeholderStart[:prefixLength]) {
			idx := len(buffer) - prefixLength
			return &idx
		}
	}
	return nil
}

// StreamWithSubstitution streams response text, substituting scripture placeholders.
func StreamWithSubstitution(
	r io.Reader,
	translation string,
	fetchBibleVerse func(reference, translation string) (string, error),
	write func(string),
	errWrite func(string),
) error {
	buffer := ""
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" || !strings.HasPrefix(line, "data: ") {
			continue
		}

		payload := line[len("data: "):]
		if payload == "[DONE]" {
			break
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
			return fmt.Errorf("received malformed JSON in an SSE data event: %w", err)
		}
		if len(chunk.Choices) == 0 || chunk.Choices[0].Delta.Content == "" {
			continue
		}

		delta := chunk.Choices[0].Delta.Content
		buffer += delta
		for {
			match := placeholderRe.FindStringSubmatchIndex(buffer)
			if match == nil {
				break
			}
			write(buffer[:match[0]])
			reference := strings.TrimSpace(buffer[match[2]:match[3]])
			verseText, err := fetchBibleVerse(reference, translation)
			if err != nil {
				verseText = fmt.Sprintf("{{SCRIPTURE:%s}}", reference)
				errWrite(fmt.Sprintf("\n[Bible API error for %s: %v]\n", reference, err))
			}
			write(verseText)
			buffer = buffer[match[1]:]
		}
		prefixIdx := FindIncompletePrefix(buffer)
		if prefixIdx != nil {
			write(buffer[:*prefixIdx])
			buffer = buffer[*prefixIdx:]
		} else {
			write(buffer)
			buffer = ""
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	write(buffer)
	return nil
}

// BuildRequestBody constructs the JSON body for the Gloo AI streaming completion request.
func BuildRequestBody(prompt, tradition string) ([]byte, error) {
	body := map[string]interface{}{
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": prompt},
		},
		"auto_routing": true,
		"stream":       true,
	}
	if tradition != "" {
		body["tradition"] = tradition
	}
	return json.Marshal(body)
}
