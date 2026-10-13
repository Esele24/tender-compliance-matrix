/**
 * CSV output helper used by browser exports. Quote cells for commas/newlines and escape
 * embedded quotes; prefix possible spreadsheet formulas so document text stays text.
 */
/** Escape spreadsheet cells, including control-prefixed formula payloads. */
// Regular expressions match patterns in strings. The first replace removes
// unsafe control characters; the next check looks for formula prefixes after spaces.
// Spreadsheet programs can treat =... as code, so prefix a quote to keep it text.
// CSV represents an embedded double quote as two double quotes inside a quoted cell.
export function csvCell(value: string): string {
   
  const text = (value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  const safe = /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
