/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * Write an .xlsx file, without a library.
 *
 * The other half of xlsx.ts, which reads one. HR is handed reports to forward,
 * file and total up, and a CSV is not that: it opens with the rupees as text in
 * one region and as numbers in another, it carries no column widths, no bold
 * heading and no freeze on the top row, and Excel asks a question about it every
 * time. A real workbook does not.
 *
 * An .xlsx is a ZIP of XML. The entries here are STORED — written straight in,
 * not deflated — which every spreadsheet opens and which needs no compressor.
 * A payroll month is a few hundred rows; the file is small either way.
 *
 * Deliberately narrow, like the reader:
 *   - ONE sheet.
 *   - Four cell looks: plain, a heading, a rupee figure, a bold rupee figure.
 *   - No formulas, no charts, no merged cells. A figure in this file is a
 *     figure somebody worked out, not one the spreadsheet recalculates.
 *
 * It is tested by reading its own output back with xlsx.ts, so the two halves
 * cannot drift apart.
 */

/* ------------------------------------------------------------------- zip */

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xff_ff_ff_ff;
  for (let i = 0; i < bytes.length; i++) {
    c = (crcTable[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xff_ff_ff_ff) >>> 0;
}

interface Entry {
  name: string;
  bytes: Uint8Array;
}

/** A ZIP with every entry stored uncompressed. */
function zip(entries: Entry[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const put = (n: number, width: 2 | 4, into: number[]): void => {
    for (let i = 0; i < width; i++) into.push((n >>> (i * 8)) & 0xff);
  };

  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.bytes);
    const local: number[] = [];
    put(0x04_03_4b_50, 4, local);
    put(20, 2, local); // version needed
    put(0, 2, local); // flags
    put(0, 2, local); // stored
    put(0, 2, local); // time
    put(0, 2, local); // date
    put(crc, 4, local);
    put(e.bytes.length, 4, local);
    put(e.bytes.length, 4, local);
    put(name.length, 2, local);
    put(0, 2, local); // extra
    const head = new Uint8Array(local);
    chunks.push(head, name, e.bytes);

    const cen: number[] = [];
    put(0x02_01_4b_50, 4, cen);
    put(20, 2, cen); // made by
    put(20, 2, cen); // needed
    put(0, 2, cen);
    put(0, 2, cen);
    put(0, 2, cen);
    put(0, 2, cen);
    put(crc, 4, cen);
    put(e.bytes.length, 4, cen);
    put(e.bytes.length, 4, cen);
    put(name.length, 2, cen);
    put(0, 2, cen); // extra
    put(0, 2, cen); // comment
    put(0, 2, cen); // disk
    put(0, 2, cen); // internal attrs
    put(0, 4, cen); // external attrs
    put(offset, 4, cen);
    central.push(new Uint8Array(cen), name);

    offset += head.length + name.length + e.bytes.length;
  }

  const centralBytes = central.reduce((a, c) => a + c.length, 0);
  const end: number[] = [];
  put(0x06_05_4b_50, 4, end);
  put(0, 2, end);
  put(0, 2, end);
  put(entries.length, 2, end);
  put(entries.length, 2, end);
  put(centralBytes, 4, end);
  put(offset, 4, end);
  put(0, 2, end);

  const all = [...chunks, ...central, new Uint8Array(end)];
  const size = all.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of all) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/* ------------------------------------------------------------------- xml */

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Excel refuses a file with a raw control character in it, and a name typed
    // on a phone can carry one.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** A1, B1 … Z1, AA1. */
function ref(col: number, row: number): string {
  let s = '';
  let n = col;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return `${s}${row}`;
}

/* ----------------------------------------------------------------- sheet */

export type CellLook = 'plain' | 'head' | 'money' | 'boldMoney' | 'bold';

export interface XlsxCell {
  readonly v: string | number | null;
  readonly look?: CellLook;
}

export type XlsxValue = XlsxCell | string | number | null | undefined;

export interface XlsxSheet {
  /** The tab name. Excel allows 31 characters and no : \\ / ? * [ ] */
  readonly name: string;
  readonly rows: readonly (readonly XlsxValue[])[];
  /** Column widths in characters. */
  readonly widths?: readonly number[];
  /** How many rows stay put when the sheet is scrolled. */
  readonly freezeRows?: number;
}

const LOOKS: CellLook[] = ['plain', 'head', 'money', 'boldMoney', 'bold'];
const styleOf = (look: CellLook | undefined): number => Math.max(0, LOOKS.indexOf(look ?? 'plain'));

const cellOf = (v: XlsxValue): XlsxCell =>
  v !== null && typeof v === 'object' ? v : { v: v ?? null };

/**
 * The workbook, as bytes.
 *
 * Numbers are written as numbers so they add up in Excel; everything else is an
 * inline string, so there is no shared-string table to keep in step.
 */
export function toXlsx(sheet: XlsxSheet): Uint8Array {
  const enc = new TextEncoder();
  const rows = sheet.rows
    .map((cells, r) => {
      const inner = cells
        .map((raw, c) => {
          const cell = cellOf(raw);
          if (cell.v === null || cell.v === '') return '';
          const s = styleOf(cell.look);
          const at = ref(c, r + 1);
          const style = s ? ` s="${s}"` : '';
          return typeof cell.v === 'number' && Number.isFinite(cell.v)
            ? `<c r="${at}"${style}><v>${cell.v}</v></c>`
            : `<c r="${at}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(String(cell.v))}</t></is></c>`;
        })
        .join('');
      return inner ? `<row r="${r + 1}">${inner}</row>` : '';
    })
    .join('');

  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';

  const freeze = sheet.freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '';

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `${freeze}${cols}<sheetData>${rows}</sheetData></worksheet>`;

  // Marbella navy for the heading band, and rupees with a thousands separator
  // and no paise — the way every figure in the app is shown.
  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>` +
    `<fonts count="3">` +
    `<font><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
    `</fonts>` +
    `<fills count="3">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FF224A85"/><bgColor indexed="64"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="5">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    `<xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  const tab = esc(sheet.name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31)) || 'Sheet1';

  return zip([
    {
      name: '[Content_Types].xml',
      bytes: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          `</Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      bytes: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
      ),
    },
    {
      name: 'xl/workbook.xml',
      bytes: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
          `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${tab}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      bytes: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
          `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          `</Relationships>`,
      ),
    },
    { name: 'xl/styles.xml', bytes: enc.encode(styles) },
    { name: 'xl/worksheets/sheet1.xml', bytes: enc.encode(sheetXml) },
  ]);
}
