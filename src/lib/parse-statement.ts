const MONTH_ABBREV: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04",
  May: "05", Jun: "06", Jul: "07", Aug: "08",
  Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

const MONTH_FULL: Record<string, string> = {
  January: "01", February: "02", March: "03", April: "04",
  May: "05", June: "06", July: "07", August: "08",
  September: "09", October: "10", November: "11", December: "12",
};

/**
 * Parse month from statement doc name.
 * Supports two formats:
 *   Old: "Coco Capital Statement [Feb, 2026]" → "2026-02"
 *   New: "Coco Capital Statement March 2026 - UNITS - THE LYNCH TRUST -U156" → "2026-03"
 */
export function parseStatementMonth(name: string): string | null {
  // Old bracket format: [Feb, 2026]
  const bracketMatch = name.match(/\[(\w+),\s*(\d{4})\]/);
  if (bracketMatch) {
    const monthNum = MONTH_ABBREV[bracketMatch[1]];
    if (monthNum) return `${bracketMatch[2]}-${monthNum}`;
  }

  // New format: Month YYYY (full month name, no brackets)
  const fullMonthPattern = new RegExp(
    `(${Object.keys(MONTH_FULL).join("|")})\\s+(\\d{4})`,
    "i"
  );
  const fullMatch = name.match(fullMonthPattern);
  if (fullMatch) {
    // Capitalize first letter to match lookup keys
    const key = fullMatch[1].charAt(0).toUpperCase() + fullMatch[1].slice(1).toLowerCase();
    const monthNum = MONTH_FULL[key];
    if (monthNum) return `${fullMatch[2]}-${monthNum}`;
  }

  return null;
}

/** Extract ending balance dollar amount from statement PDF text. */
export function parseEndingBalance(text: string): number | null {
  // Look for "Current Balance" followed by a dollar amount
  const match = text.match(/Current\s+Balance[:\s]*\$?([\d,]+\.\d{2})/i);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ""));
  }

  // Fallback: look for "Ending Balance"
  const fallback = text.match(/Ending\s+Balance[:\s]*\$?([\d,]+\.\d{2})/i);
  if (fallback) {
    return parseFloat(fallback[1].replace(/,/g, ""));
  }

  return null;
}
