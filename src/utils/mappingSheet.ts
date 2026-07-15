import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Data-driven test mapping, inspired by how Salesforce's NPSP is tested with
 * Robot Framework: instead of hardcoding URLs and files in test code, each UI
 * test is mapped in an external sheet (CSV — opens directly in Excel).
 *
 * Sheet columns (header row required):
 *   test_name      unique name; becomes the generated test's title
 *   suite          "mock" (self-contained e2e) or "live" (your real org)
 *   object         object API name — when page_path is empty the URL is
 *                  AUTO-MAPPED to /lightning/o/<object>/list
 *   page_path      explicit page path; overrides the auto-mapping
 *   upload_file    optional file to upload on that page (path relative to repo)
 *   expect_heading optional h1 text to assert after navigation
 *
 * Lines starting with # are comments.
 */
export interface TestMapping {
  testName: string;
  suite: 'mock' | 'live';
  object?: string;
  /** The resolved page path — explicit page_path, or auto-mapped from object. */
  pagePath: string;
  uploadFile?: string;
  expectHeading?: string;
}

const DEFAULT_SHEET = 'test-mappings.csv';

/** Minimal CSV line parser with support for double-quoted fields. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

/**
 * Load the mapping sheet and return the rows for a suite.
 * URL auto-mapping: when a row names an object but no page_path, the path is
 * derived automatically (`/lightning/o/<object>/list`) — so most rows never
 * need to spell out a URL at all.
 */
export function loadMappings(
  suite: 'mock' | 'live',
  sheetPath: string = process.env.SF_MAPPING_SHEET ?? DEFAULT_SHEET,
): TestMapping[] {
  const abs = resolve(sheetPath);
  if (!existsSync(abs)) {
    throw new Error(`Mapping sheet not found: ${abs}`);
  }

  const lines = readFileSync(abs, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trimStart().startsWith('#'));

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  for (const required of ['test_name', 'suite']) {
    if (col(required) === -1) {
      throw new Error(`Mapping sheet is missing the "${required}" column.`);
    }
  }

  const rows: TestMapping[] = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const cell = (name: string) => cells[col(name)] || undefined;

    const rowSuite = (cell('suite') ?? 'mock') as TestMapping['suite'];
    if (rowSuite !== suite) continue;

    const object = cell('object');
    const explicitPath = cell('page_path');
    // AUTO-MAPPING: object name -> dynamic URL, unless the sheet overrides it.
    const pagePath =
      explicitPath ?? (object ? `/lightning/o/${object}/list` : undefined);

    const testName = cell('test_name');
    if (!testName || !pagePath) continue; // row not runnable — skip quietly

    rows.push({
      testName,
      suite: rowSuite,
      object,
      pagePath,
      uploadFile: cell('upload_file'),
      expectHeading: cell('expect_heading'),
    });
  }
  return rows;
}
