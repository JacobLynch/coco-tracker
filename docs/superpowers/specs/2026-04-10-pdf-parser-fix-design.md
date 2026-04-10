# PDF Parser Fix: Support New Statement Name Format

## Problem

Coco Capital changed the document naming format for monthly investor statements. The `syncStatements` Trigger.dev task fails to parse the month from new statement names, silently skipping them.

- **Old format**: `Coco Capital Statement [Feb, 2026]`
- **New format**: `Coco Capital Statement March 2026 - UNITS - THE LYNCH TRUST -U156`

The existing regex `/\[(\w+),\s*(\d{4})\]/` requires brackets and a comma, which the new format lacks. The task logs: `Could not parse month from doc: Coco Capital Statement March 2026 - UNITS - THE LYNCH TRUST -U156`

Balance extraction (`parseEndingBalance`) is unaffected — the `Ending Balance` fallback regex matches the new PDF format correctly. Verified by running `unpdf` against `examples/coco-march-26.pdf`.

## Fix

### 1. Extract parsing functions into a testable module

Move `parseStatementMonth()` and `parseEndingBalance()` from `src/trigger/sync-statements.ts` into `src/lib/parse-statement.ts`. This decouples them from the Trigger.dev runtime so they can be unit tested directly.

`sync-statements.ts` imports from the new module — no logic changes to the task itself.

### 2. Update `parseStatementMonth()` to handle both formats

Try the old bracket pattern first. If it doesn't match, fall back to a bare `Month YYYY` pattern.

Support both abbreviated (`Jan`, `Feb`) and full (`January`, `February`) month names, since old docs use abbreviated and new docs use full names.

New regex fallback: `/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i`

### 3. Add unit tests

Create `src/lib/parse-statement.test.ts` with cases for:

**`parseStatementMonth`:**
- Old bracket format: `Coco Capital Statement [Feb, 2026]` → `2026-02`
- New format: `Coco Capital Statement March 2026 - UNITS - THE LYNCH TRUST -U156` → `2026-03`
- Unrecognized format → `null`

**`parseEndingBalance`:**
- Text with `Ending Balance $2,243,021.37)` → `2243021.37`
- Text with `Current Balance: $1,234.56` → `1234.56` (old format, if it existed)
- Text with no balance → `null`

**Integration test:**
- Run `unpdf` against `examples/coco-march-26.pdf` and verify `parseEndingBalance` returns `2243021.37`

### 4. Keep sample PDF as fixture

`examples/coco-march-26.pdf` stays in the repo as a test fixture for the integration test.

## Out of scope

- No changes to balance regex patterns (verified working)
- No changes to trigger task logic, scheduling, or database schema
- No changes to the balance recomputation chain
- No structured/table-aware PDF parsing (YAGNI — regex works fine for the fields we need)

## Files changed

| File | Change |
|------|--------|
| `src/lib/parse-statement.ts` | New — extracted parsing functions |
| `src/lib/parse-statement.test.ts` | New — unit + integration tests |
| `src/trigger/sync-statements.ts` | Import parsers from new module, remove inline functions |
| `examples/coco-march-26.pdf` | Already present — used as test fixture |
