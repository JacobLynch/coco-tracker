import { describe, test, expect } from "vitest";
import { extractText } from "unpdf";
import fs from "fs";
import path from "path";
import { parseStatementMonth, parseEndingBalance } from "./parse-statement";

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
