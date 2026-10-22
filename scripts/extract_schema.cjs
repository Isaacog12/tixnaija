const fs = require('fs');
const content = fs.readFileSync('src/integrations/supabase/types.ts', 'utf8');

const publicIdx = content.indexOf('  public: {\n    Tables: {') !== -1 
  ? content.indexOf('  public: {\n    Tables: {')
  : content.indexOf('  public: {\r\n    Tables: {');

const publicSection = content.substring(publicIdx);
const viewsIdx = publicSection.indexOf('    Views: {');
const tablesSection = publicSection.substring(0, viewsIdx);

const lines = tablesSection.split(/\r?\n/);
const tables = {};
let currentTable = null;
let inRow = false;

for (const line of lines) {
  const tMatch = line.match(/^ {6}([a-zA-Z0-9_]+): \{/);
  if (tMatch) {
    currentTable = tMatch[1];
    tables[currentTable] = [];
    inRow = false;
    continue;
  }
  if (currentTable && line.includes('Row: {')) {
    inRow = true;
    continue;
  }
  if (inRow) {
    if (line.startsWith('        }')) {
      inRow = false;
      continue;
    }
    const fMatch = line.match(/^ {10}([a-zA-Z0-9_]+):/);
    if (fMatch) {
      tables[currentTable].push(fMatch[1]);
    }
  }
}

console.log(JSON.stringify(tables, null, 2));
