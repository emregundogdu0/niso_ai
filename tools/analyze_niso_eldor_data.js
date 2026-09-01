const fs = require('fs');

const filePath = 'C:\\Users\\Emre Gundogdu\\Downloads\\niso_eldor_temizlenmis_tum_bilgiler.txt';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== FILE METRICS ===');
console.log('Total Lines:', lines.length);
console.log('Total Characters:', content.length);

console.log('\n=== SECTIONS & HEADINGS ===');
lines.forEach((l, i) => {
  const trimmed = l.trim();
  if (trimmed.startsWith('BÖLÜM') || trimmed.startsWith('===') || trimmed.startsWith('---') || trimmed.startsWith('[') && trimmed.includes(']')) {
    if (trimmed.length > 3 && !trimmed.startsWith('---') && !trimmed.startsWith('===')) {
      console.log(`Line ${i + 1}: ${trimmed}`);
    } else if (trimmed.startsWith('BÖLÜM') || trimmed.startsWith('===')) {
      console.log(`Line ${i + 1}: ${trimmed}`);
    }
  }
});
