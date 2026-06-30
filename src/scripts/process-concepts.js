const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node process-concepts.js <csv-file>');
  process.exit(1);
}

// ponytail: RFC 4180 CSV parse (handles quoted fields with commas/newlines).
// Ceiling: loads entire file into memory. Fine for spreadsheet-sized data.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        if (ch === '\r') i++; // skip \n after \r
        row.push(field); field = '';
        rows.push(row); row = [];
      } else {
        field += ch;
      }
    }
  }
  // last field/row
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const text = fs.readFileSync(filePath, 'utf8');
const rows = parseCSV(text);

const grades = rows[0].map(v => v.trim());
const results = [];

for (let r = 1; r < rows.length; r++) {
  const values = rows[r];
  const subjectId = values[0]?.trim();
  if (!subjectId) continue;

  for (let i = 1; i < values.length; i++) {
    const cell = values[i];
    if (!cell || !cell.trim()) continue;

    const grade = grades[i]?.trim();
    if (!grade) continue;

    // Split on newline or semicolon, filter blanks
    const concepts = cell.split(/\n|;/).map(c => c.trim()).filter(Boolean);
    for (const name of concepts) {
      results.push({ subject: subjectId, grade, name });
    }
  }
}

const outFile = 'concepts_output.json';
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
console.log(`Done. ${results.length} concepts written to ${outFile}`);
