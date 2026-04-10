# PDF Parser Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `parseStatementMonth` to support the new Coco Capital statement naming format, extract parsing functions into a testable module, and add tests.

**Architecture:** Extract `parseStatementMonth` and `parseEndingBalance` from `src/trigger/sync-statements.ts` into `src/lib/parse-statement.ts`. Add vitest for unit and integration testing. Update the month parser to handle both old bracket format and new bare format.

**Tech Stack:** TypeScript, vitest, unpdf

---

### Task 1: Install vitest

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install vitest as a dev dependency**

Run: `npm install -D vitest`

- [ ] **Step 2: Add test script to package.json**

Add to the `"scripts"` section of `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Verify vitest runs (no tests yet)**

Run: `npx vitest run`
Expected: "No test files found" (exits cleanly, no errors)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add vitest for testing"
```

---

### Task 2: Extract parsing functions into `src/lib/parse-statement.ts`

**Files:**
- Create: `src/lib/parse-statement.ts`
- Modify: `src/trigger/sync-statements.ts`

- [ ] **Step 1: Create `src/lib/parse-statement.ts` with existing logic**

```typescript
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
```

- [ ] **Step 2: Update `src/trigger/sync-statements.ts` to import from the new module**

Remove the `parseStatementMonth` function (lines 6-20) and `parseEndingBalance` function (lines 22-37) from `sync-statements.ts`. Add this import at the top:

```typescript
import { parseStatementMonth, parseEndingBalance } from "../lib/parse-statement";
```

The rest of `sync-statements.ts` stays unchanged.

- [ ] **Step 3: Verify the project still builds**

Run: `npx tsc --noEmit`
Expected: No type errors (or only pre-existing ones unrelated to this change)

- [ ] **Step 4: Commit**

```bash
git add src/lib/parse-statement.ts src/trigger/sync-statements.ts
git commit -m "Extract statement parsing functions into src/lib/parse-statement.ts"
```

---

### Task 3: Add unit tests for `parseStatementMonth`

**Files:**
- Create: `src/lib/parse-statement.test.ts`

- [ ] **Step 1: Write failing tests for `parseStatementMonth`**

```typescript
import { describe, test, expect } from "vitest";
import { parseStatementMonth } from "./parse-statement";

describe("parseStatementMonth", () => {
  test("parses old bracket format with abbreviated month", () => {
    expect(parseStatementMonth("Coco Capital Statement [Feb, 2026]")).toBe("2026-02");
  });

  test("parses old bracket format with different months", () => {
    expect(parseStatementMonth("Coco Capital Statement [Dec, 2025]")).toBe("2025-12");
    expect(parseStatementMonth("Coco Capital Statement [Jan, 2026]")).toBe("2026-01");
  });

  test("parses new format with full month name", () => {
    expect(
      parseStatementMonth("Coco Capital Statement March 2026 - UNITS - THE LYNCH TRUST -U156")
    ).toBe("2026-03");
  });

  test("parses new format with different months", () => {
    expect(
      parseStatementMonth("Coco Capital Statement January 2026 - UNITS - THE LYNCH TRUST -U156")
    ).toBe("2026-01");
    expect(
      parseStatementMonth("Coco Capital Statement December 2025 - UNITS - THE LYNCH TRUST -U156")
    ).toBe("2025-12");
  });

  test("returns null for unrecognized format", () => {
    expect(parseStatementMonth("Some Random Document")).toBeNull();
    expect(parseStatementMonth("Statement 2026")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lib/parse-statement.test.ts`
Expected: All tests PASS (the implementation was already written in Task 2)

- [ ] **Step 3: Commit**

```bash
git add src/lib/parse-statement.test.ts
git commit -m "Add unit tests for parseStatementMonth covering old and new formats"
```

---

### Task 4: Add unit tests for `parseEndingBalance`

**Files:**
- Modify: `src/lib/parse-statement.test.ts`

- [ ] **Step 1: Add `parseEndingBalance` tests to the existing test file**

Append to `src/lib/parse-statement.test.ts`:

```typescript
import { parseEndingBalance } from "./parse-statement";

describe("parseEndingBalance", () => {
  test("matches 'Current Balance' label", () => {
    expect(parseEndingBalance("Current Balance: $1,234.56")).toBe(1234.56);
    expect(parseEndingBalance("Current Balance $5,000.00")).toBe(5000.00);
  });

  test("matches 'Ending Balance' label (fallback)", () => {
    expect(parseEndingBalance("Ending Balance $2,243,021.37)")).toBe(2243021.37);
  });

  test("handles text from new PDF format with surrounding content", () => {
    const pdfText = `Net Profit/Loss $38,478.10) Ending Balance $2,243,021.37)
Unit Holders receive 75% of monthly gross performance.`;
    expect(parseEndingBalance(pdfText)).toBe(2243021.37);
  });

  test("returns null when no balance found", () => {
    expect(parseEndingBalance("No balance information here")).toBeNull();
    expect(parseEndingBalance("Balance: not a number")).toBeNull();
  });
});
```

Note: Merge the `parseEndingBalance` import into the existing import statement at the top of the file:
```typescript
import { parseStatementMonth, parseEndingBalance } from "./parse-statement";
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lib/parse-statement.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/parse-statement.test.ts
git commit -m "Add unit tests for parseEndingBalance"
```

---

### Task 5: Add integration test with sample PDF

**Files:**
- Modify: `src/lib/parse-statement.test.ts`

- [ ] **Step 1: Add integration test using the real PDF fixture**

Append to `src/lib/parse-statement.test.ts`:

```typescript
import { extractText } from "unpdf";
import fs from "fs";
import path from "path";

describe("PDF integration", () => {
  test("extracts ending balance from real March 2026 statement PDF", async () => {
    const pdfPath = path.resolve(__dirname, "../../examples/coco-march-26.pdf");
    const pdfBuffer = fs.readFileSync(pdfPath);
    const { text } = await extractText(new Uint8Array(pdfBuffer));
    const fullText = Array.isArray(text) ? text.join("\n") : text;

    const balance = parseEndingBalance(fullText);
    expect(balance).toBe(2243021.37);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lib/parse-statement.test.ts`
Expected: All tests PASS including the integration test

- [ ] **Step 3: Commit**

```bash
git add src/lib/parse-statement.test.ts
git commit -m "Add integration test: extract balance from real PDF fixture"
```

---

### Task 6: Add test script and verify everything end-to-end

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass, no errors

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No new type errors

- [ ] **Step 3: Final commit if any cleanup needed**

If any small fixes were needed, commit them:

```bash
git add -A
git commit -m "PDF parser fix: support new statement name format with tests"
```
