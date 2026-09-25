/**
 * Read an .xlsx file, without a library.
 *
 * HR is given a master sheet to fill in and asked to upload it. Asking her to
 * "save as CSV" first is asking her to do a thing that goes wrong — the wrong
 * sheet, the wrong encoding, a comma inside somebody's designation — so the
 * intake screen takes the workbook itself.
 *
 * An .xlsx is a ZIP of XML. Both halves are handled here in about two hundred
 * lines rather than with a dependency: the readers on npm are large, have had
 * prototype-pollution advisories, and the one everybody reaches for is no longer
 * published to the registry at all. This reads what a spreadsheet actually
 * contains and refuses anything it does not understand, which is a smaller
 * surface than a general-purpose parser and one we can test against the very
 * file we hand out.
 *
 * Deliberately narrow:
 *   - ONE sheet, the first one, or one named.
 *   - Cells come back as STRINGS, because that is what the importer reads.
 *   - Dates come back as "12 Aug 2026" whether they were typed as text or
 *     entered as a date, so the two cannot produce different imports.
 *
 * `DecompressionStream` does the inflating. It is in every browser Marbella
 * runs and in Node 18 and up, so the same code is used in the app and in its
 * tests.
 */

/* ------------------------------------------------------------------- zip */

interface ZipEntry {
  name: string;
  method: number;
  offset: number;
  compressed: number;
  uncompressed: number;
}

const u16 = (d: DataView, o: number): number => d.getUint16(o, true);
const u32 = (d: DataView, o: number): number => d.getUint32(o, true);

/**
 * The central directory, read from the end backwards.
 *
 * Not the local headers at the front: those may carry a zero size and defer to
 * a descriptor after the data, which is exactly what several writers do.
 */
function zipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 66_000; i -= 1) {
    if (u32(d, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('That file is not a workbook — no zip directory in it.');

  const count = u16(d, eocd + 10);
  let p = u32(d, eocd + 16);
  const out = new Map<string, ZipEntry>();
  const dec = new TextDecoder();

  for (let i = 0; i < count; i += 1) {
    if (u32(d, p) !== 0x02014b50) break;
    const nameLen = u16(d, p + 28);
    const extraLen = u16(d, p + 30);
    const commentLen = u16(d, p + 32);
    const entry: ZipEntry = {
      name: dec.decode(bytes.subarray(p + 46, p + 46 + nameLen)),
      method: u16(d, p + 10),
      compressed: u32(d, p + 20),
      uncompressed: u32(d, p + 24),
      offset: u32(d, p + 42),
    };
    out.set(entry.name, entry);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function inflate(bytes: Uint8Array, e: ZipEntry): Promise<string> {
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The local header's own name and extra lengths, which differ from the
  // directory's more often than you would think.
  const start = e.offset + 30 + u16(d, e.offset + 26) + u16(d, e.offset + 28);
  const raw = bytes.subarray(start, start + e.compressed);
  if (e.method === 0) return new TextDecoder().decode(raw);
  if (e.method !== 8)
    throw new Error(`That workbook uses a compression this cannot read (${e.method}).`);

  const stream = new Blob([raw as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

/* ------------------------------------------------------------------- xml */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function unescapeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return String.fromCodePoint(parseInt(body.slice(2), 16));
    }
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return ENTITIES[body] ?? whole;
  });
}

/** Every `<t>` inside one shared-string entry, joined — rich text is split. */
function textOf(xml: string): string {
  let out = '';
  const re = /<t[^>]*>([\s\S]*?)<\/t>|<t[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out += unescapeXml(m[1] ?? '');
  return out;
}

/* ----------------------------------------------------------------- dates */

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/**
 * An Excel serial to "12 Aug 2026".
 *
 * Day 60 is 29 February 1900, a day that did not exist — a bug Lotus had and
 * Excel kept for compatibility. Serials above it are one day out, which is why
 * the epoch below is 30 December 1899 rather than the 31st.
 */
function serialToDate(n: number): string {
  const ms = Math.round(n) * 86_400_000;
  const d = new Date(Date.UTC(1899, 11, 30) + ms);
  if (Number.isNaN(d.getTime())) return String(n);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The built-in number formats that mean "this is a date". */
const DATE_FORMAT_IDS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57,
]);

/** Which cell styles are dates, read from styles.xml. */
function dateStyles(stylesXml: string): Set<number> {
  const custom = new Set<number>();
  const fmtRe = /<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = fmtRe.exec(stylesXml))) {
    const code = unescapeXml(m[2] ?? '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/"[^"]*"/g, '');
    if (/[dmyhs]/i.test(code) && !/^[^dmy]*$/i.test(code)) custom.add(Number(m[1]));
  }
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? '';
  const out = new Set<number>();
  let i = 0;
  const xfRe = /<xf\b[^>]*>/g;
  while ((m = xfRe.exec(cellXfs))) {
    const id = Number(/numFmtId="(\d+)"/.exec(m[0])?.[1] ?? '0');
    if (DATE_FORMAT_IDS.has(id) || custom.has(id)) out.add(i);
    i += 1;
  }
  return out;
}

/* --------------------------------------------------------------- reading */

/** "BC12" -> 54. */
function columnOf(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/**
 * The rows of one sheet, every cell a string.
 *
 * @param bytes the .xlsx file
 * @param sheetName the sheet to read; the first sheet when left out
 */
export async function readXlsx(bytes: Uint8Array, sheetName?: string): Promise<string[][]> {
  const zip = zipEntries(bytes);
  const get = async (name: string): Promise<string> => {
    const e = zip.get(name);
    return e ? inflate(bytes, e) : '';
  };

  // Which file holds the sheet we want. workbook.xml gives the order and the
  // names; the relationship file turns a name into a path.
  const workbook = await get('xl/workbook.xml');
  const rels = await get('xl/_rels/workbook.xml.rels');
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    name: unescapeXml(/name="([^"]*)"/.exec(m[0])?.[1] ?? ''),
    rid: /r:id="([^"]*)"/.exec(m[0])?.[1] ?? '',
  }));
  const wanted = sheetName ? sheets.find((s) => s.name === sheetName) : sheets[0];
  if (!wanted) {
    throw new Error(
      sheetName
        ? `That workbook has no sheet called "${sheetName}".`
        : 'That workbook has no sheets in it.',
    );
  }
  const target = /Target="([^"]*)"/.exec(
    new RegExp(`<Relationship[^>]*Id="${wanted.rid}"[^>]*>`).exec(rels)?.[0] ?? '',
  )?.[1];
  const path = target
    ? `xl/${target.replace(/^\/?xl\//, '').replace(/^\//, '')}`
    : 'xl/worksheets/sheet1.xml';

  const [sheetXml, sharedXml, stylesXml] = await Promise.all([
    get(path),
    get('xl/sharedStrings.xml'),
    get('xl/styles.xml'),
  ]);
  if (!sheetXml) throw new Error('That workbook has no readable sheet in it.');

  const shared = [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)].map((m) =>
    textOf(m[1] ?? ''),
  );
  const dates = stylesXml ? dateStyles(stylesXml) : new Set<number>();

  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
    const body = rowMatch[1] ?? '';
    const cells: string[] = [];
    for (const cellMatch of body.matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1] ?? '';
      const inner = cellMatch[2] ?? '';
      const ref = /r="([A-Z]+)/.exec(attrs)?.[1];
      const at = ref ? columnOf(ref) : cells.length;
      const type = /t="([^"]*)"/.exec(attrs)?.[1] ?? 'n';
      const style = Number(/s="(\d+)"/.exec(attrs)?.[1] ?? '-1');
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];

      let value = '';
      if (type === 's') value = shared[Number(v ?? '0')] ?? '';
      else if (type === 'inlineStr') value = textOf(inner);
      else if (type === 'str') value = unescapeXml(v ?? '');
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined) {
        value = dates.has(style) && v !== '' ? serialToDate(Number(v)) : unescapeXml(v);
      }

      while (cells.length < at) cells.push('');
      cells[at] = value.trim();
    }
    rows.push(cells);
  }

  // Trailing blank rows are what Excel leaves behind when somebody deletes the
  // example rows, and they would each be reported as a row with no name.
  while (rows.length && rows[rows.length - 1]?.every((c) => c === '')) rows.pop();
  return rows;
}

/** The workbook as the intake screen wants it: tab-separated, like a paste. */
export async function xlsxToSheet(bytes: Uint8Array, sheetName?: string): Promise<string> {
  const rows = await readXlsx(bytes, sheetName);
  return rows.map((r) => r.map((c) => c.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
}
