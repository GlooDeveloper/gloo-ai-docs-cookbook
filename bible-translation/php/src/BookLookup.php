<?php

declare(strict_types=1);

namespace Gloo\BibleTranslation;

/**
 * USFM book ID lookup covering the 66-book Protestant canon plus common
 * abbreviations, numeric prefixes, Roman numerals, and written-out ordinals.
 */
class BookLookup
{
    /** @var array<string, string> */
    private static array $bookIds = [
        // Old Testament
        "Genesis" => "GEN",
        "Exodus" => "EXO",
        "Leviticus" => "LEV",
        "Numbers" => "NUM",
        "Deuteronomy" => "DEU",
        "Joshua" => "JOS",
        "Judges" => "JDG",
        "Ruth" => "RUT",
        "1 Samuel" => "1SA",
        "1Samuel" => "1SA",
        "1 Sam" => "1SA",
        "1Sam" => "1SA",
        "I Samuel" => "1SA",
        "ISamuel" => "1SA",
        "I Sam" => "1SA",
        "ISam" => "1SA",
        "2 Samuel" => "2SA",
        "2Samuel" => "2SA",
        "2 Sam" => "2SA",
        "2Sam" => "2SA",
        "II Samuel" => "2SA",
        "IISamuel" => "2SA",
        "II Sam" => "2SA",
        "IISam" => "2SA",
        "1 Kings" => "1KI",
        "1Kings" => "1KI",
        "1 Kgs" => "1KI",
        "1Kgs" => "1KI",
        "I Kings" => "1KI",
        "IKings" => "1KI",
        "I Kgs" => "1KI",
        "IKgs" => "1KI",
        "2 Kings" => "2KI",
        "2Kings" => "2KI",
        "2 Kgs" => "2KI",
        "2Kgs" => "2KI",
        "II Kings" => "2KI",
        "IIKings" => "2KI",
        "II Kgs" => "2KI",
        "IIKgs" => "2KI",
        "1 Chronicles" => "1CH",
        "1Chronicles" => "1CH",
        "1 Chr" => "1CH",
        "1Chr" => "1CH",
        "I Chronicles" => "1CH",
        "IChronicles" => "1CH",
        "I Chr" => "1CH",
        "IChr" => "1CH",
        "2 Chronicles" => "2CH",
        "2Chronicles" => "2CH",
        "2 Chr" => "2CH",
        "2Chr" => "2CH",
        "II Chronicles" => "2CH",
        "IIChronicles" => "2CH",
        "II Chr" => "2CH",
        "IIChr" => "2CH",
        "Ezra" => "EZR",
        "Nehemiah" => "NEH",
        "Esther" => "EST",
        "Job" => "JOB",
        "Psalm" => "PSA",
        "Psalms" => "PSA",
        "Proverbs" => "PRO",
        "Ecclesiastes" => "ECC",
        "Song of Songs" => "SNG",
        "Song of Solomon" => "SNG",
        "Canticles" => "SNG",
        "Isaiah" => "ISA",
        "Jeremiah" => "JER",
        "Lamentations" => "LAM",
        "Ezekiel" => "EZK",
        "Daniel" => "DAN",
        "Hosea" => "HOS",
        "Joel" => "JOL",
        "Amos" => "AMO",
        "Obadiah" => "OBA",
        "Jonah" => "JON",
        "Micah" => "MIC",
        "Nahum" => "NAM",
        "Habakkuk" => "HAB",
        "Zephaniah" => "ZEP",
        "Haggai" => "HAG",
        "Zechariah" => "ZEC",
        "Malachi" => "MAL",
        // New Testament
        "Matthew" => "MAT",
        "Matt" => "MAT",
        "Mark" => "MRK",
        "Luke" => "LUK",
        "John" => "JHN",
        "Acts" => "ACT",
        "Romans" => "ROM",
        "Rom" => "ROM",
        "1 Corinthians" => "1CO",
        "1Corinthians" => "1CO",
        "1 Cor" => "1CO",
        "1Cor" => "1CO",
        "I Corinthians" => "1CO",
        "ICorinthians" => "1CO",
        "I Cor" => "1CO",
        "ICor" => "1CO",
        "2 Corinthians" => "2CO",
        "2Corinthians" => "2CO",
        "2 Cor" => "2CO",
        "2Cor" => "2CO",
        "II Corinthians" => "2CO",
        "IICorinthians" => "2CO",
        "II Cor" => "2CO",
        "IICor" => "2CO",
        "Galatians" => "GAL",
        "Ephesians" => "EPH",
        "Philippians" => "PHP",
        "Colossians" => "COL",
        "1 Thessalonians" => "1TH",
        "1Thessalonians" => "1TH",
        "1 Thess" => "1TH",
        "1Thess" => "1TH",
        "I Thessalonians" => "1TH",
        "IThessalonians" => "1TH",
        "I Thess" => "1TH",
        "IThess" => "1TH",
        "2 Thessalonians" => "2TH",
        "2Thessalonians" => "2TH",
        "2 Thess" => "2TH",
        "2Thess" => "2TH",
        "II Thessalonians" => "2TH",
        "IIThessalonians" => "2TH",
        "II Thess" => "2TH",
        "IIThess" => "2TH",
        "1 Timothy" => "1TI",
        "1Timothy" => "1TI",
        "1 Tim" => "1TI",
        "1Tim" => "1TI",
        "I Timothy" => "1TI",
        "ITimothy" => "1TI",
        "I Tim" => "1TI",
        "ITim" => "1TI",
        "2 Timothy" => "2TI",
        "2Timothy" => "2TI",
        "2 Tim" => "2TI",
        "2Tim" => "2TI",
        "II Timothy" => "2TI",
        "IITimothy" => "2TI",
        "II Tim" => "2TI",
        "IITim" => "2TI",
        "Titus" => "TIT",
        "Philemon" => "PHM",
        "Hebrews" => "HEB",
        "James" => "JAS",
        "Jms" => "JAS",
        "1 Peter" => "1PE",
        "1Peter" => "1PE",
        "1 Pet" => "1PE",
        "1Pet" => "1PE",
        "I Peter" => "1PE",
        "IPeter" => "1PE",
        "I Pet" => "1PE",
        "IPet" => "1PE",
        "2 Peter" => "2PE",
        "2Peter" => "2PE",
        "2 Pet" => "2PE",
        "2Pet" => "2PE",
        "II Peter" => "2PE",
        "IIPeter" => "2PE",
        "II Pet" => "2PE",
        "IIPet" => "2PE",
        "1 John" => "1JN",
        "1John" => "1JN",
        "1 Jn" => "1JN",
        "1Jn" => "1JN",
        "I John" => "1JN",
        "IJohn" => "1JN",
        "I Jn" => "1JN",
        "IJn" => "1JN",
        "2 John" => "2JN",
        "2John" => "2JN",
        "2 Jn" => "2JN",
        "2Jn" => "2JN",
        "II John" => "2JN",
        "IIJohn" => "2JN",
        "II Jn" => "2JN",
        "IIJn" => "2JN",
        "3 John" => "3JN",
        "3John" => "3JN",
        "3 Jn" => "3JN",
        "3Jn" => "3JN",
        "III John" => "3JN",
        "IIIJohn" => "3JN",
        "III Jn" => "3JN",
        "IIIJn" => "3JN",
        "Jude" => "JUD",
        "Revelation" => "REV",
        "Rev" => "REV",
        "Apocalypse" => "REV",
    ];

    /** @var array<string, string>|null */
    private static ?array $bookIdsCasefolded = null;

    public static function normalizeReference(string $rawReference): string
    {
        $reference = trim(preg_replace('/\s+/', ' ', $rawReference) ?? $rawReference);
        $reference = preg_replace('/\bFirst\b/i', '1', $reference) ?? $reference;
        $reference = preg_replace('/\bSecond\b/i', '2', $reference) ?? $reference;
        $reference = preg_replace('/\bThird\b/i', '3', $reference) ?? $reference;
        $reference = preg_replace('/\b([1-3])\s+/u', '$1', $reference) ?? $reference;
        return $reference;
    }

    public static function lookup(string $bookPart): ?string
    {
        $ids = self::bookIdsCasefolded();
        $casefolded = self::casefold($bookPart);
        $id = $ids[$casefolded] ?? null;
        if ($id !== null) {
            return $id;
        }

        $compact = self::casefold(str_replace(' ', '', $bookPart));
        return $ids[$compact] ?? null;
    }

    private static function bookIdsCasefolded(): array
    {
        if (self::$bookIdsCasefolded === null) {
            self::$bookIdsCasefolded = array_change_key_case(self::$bookIds, CASE_LOWER);
        }
        return self::$bookIdsCasefolded;
    }

    private static function casefold(string $text): string
    {
        return mb_strtolower($text, 'UTF-8');
    }
}
