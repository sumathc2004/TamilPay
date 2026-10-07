// A minimal .xlsx writer: one sheet, a styled header row, column widths and a frozen top row.
//
// Why not CSV: Excel opens a CSV by guessing each cell's type, and turns any digits-only cell
// into a number — dropping leading zeros and keeping only 15 digits, so the 21-digit reference
// 061026143925354730239 became 6.1E+19. In a workbook every cell carries its own type, so
// identifiers are stored as text and are shown exactly. Text is also never read as a formula,
// so free-text cells (remarks, names) need no escaping tricks.

import { strToU8, zipSync } from 'fflate';

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// Characters XML 1.0 does not allow at all are dropped; the rest are escaped.
const xmlText = (value) => String(value ?? '')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Column letters for a zero-based index: 0 -> A, 25 -> Z, 26 -> AA. */
export function columnName(index) {
  let name = '';
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) name = String.fromCharCode(65 + (n % 26)) + name;
  return name;
}

// A plain figure — an amount, a row id — is stored as a number so it can be summed and sorted.
// Anything that is an identifier stays text: long digit strings (references, UTRs, account
// numbers) lose precision as numbers, and a leading zero (a card ending 0011) is part of the value.
const isIdentifier = (text) => /^\d{11,}$/.test(text) || /^0\d+$/.test(text);
const isPlainNumber = (text) => /^-?\d+(\.\d+)?$/.test(text) && !isIdentifier(text) && text.length <= 15;

function cellXml(ref, value, style) {
  const text = String(value ?? '');
  if (text === '') return style ? `<c r="${ref}" s="${style}"/>` : '';
  if (!style && isPlainNumber(text)) return `<c r="${ref}"><v>${text}</v></c>`;
  // style 3 is the text number format (@): even if someone edits the cell, it stays text.
  const s = style || (isIdentifier(text) ? 3 : 0);
  return `<c r="${ref}"${s ? ` s="${s}"` : ''} t="inlineStr"><is><t xml:space="preserve">${xmlText(text)}</t></is></c>`;
}

const STYLES = `${XML_HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0D4FB0"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/**
 * Builds the workbook and returns its bytes.
 * @param {{ sheetName?: string, headers: string[], rows: Array<Array<string|number|null>> }} sheet
 */
export async function buildXlsx({ sheetName = 'Report', headers, rows }) {
  const widths = headers.map((h, c) => {
    const longest = Math.max(String(h).length + 2, ...rows.map((r) => String(r[c] ?? '').length));
    return Math.min(46, Math.max(9, longest + 2));
  });
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');

  const headerRow = `<row r="1" ht="22" customHeight="1">${headers.map((h, c) => cellXml(`${columnName(c)}1`, h, 1)).join('')}</row>`;
  const bodyRows = rows.map((row, i) => {
    const r = i + 2;
    return `<row r="${r}">${headers.map((_, c) => cellXml(`${columnName(c)}${r}`, row[c], 0)).join('')}</row>`;
  }).join('');
  const lastRef = `${columnName(headers.length - 1)}${rows.length + 1}`;

  const sheet = `${XML_HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastRef}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${headerRow}${bodyRows}</sheetData>
<autoFilter ref="A1:${lastRef}"/>
</worksheet>`;

  // Excel limits sheet names to 31 characters and a few symbols.
  const safeName = xmlText(String(sheetName).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Report');

  const files = {
    '[Content_Types].xml': strToU8(`${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    '_rels/.rels': strToU8(`${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeName}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(STYLES),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  };
  return zipSync(files, { level: 6 });
}
