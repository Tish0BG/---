import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync } from 'node:fs';

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

const PAGES = Number(process.argv[3] ?? 14);
for (let p = 1; p <= PAGES; p++) {
  const page = doc.addPage([595.28, 841.89]); // A4
  page.drawText(`Pre-Algebra  -  Worksheet ${p}`, { x: 56, y: 780, size: 18, font: bold, color: rgb(0.1, 0.1, 0.2) });
  page.drawLine({ start: { x: 56, y: 770 }, end: { x: 539, y: 770 }, thickness: 1, color: rgb(0.7, 0.7, 0.75) });
  page.drawText('Solve the following problems. Show your work.', { x: 56, y: 748, size: 11, font, color: rgb(0.35, 0.35, 0.4) });

  for (let i = 0; i < 6; i++) {
    const y = 700 - i * 110;
    const n = (p - 1) * 6 + i + 1;
    page.drawText(`${n}.`, { x: 56, y, size: 12, font: bold });
    page.drawText(`Solve for x:   ${3 + i}x + ${p * 2} = ${(3 + i) * 4 + p * 2}`, { x: 78, y, size: 12, font });
    page.drawRectangle({ x: 78, y: y - 78, width: 440, height: 68, borderColor: rgb(0.85, 0.86, 0.9), borderWidth: 1 });
  }
  page.drawText(`quadratic equation reference - page ${p}`, { x: 56, y: 40, size: 9, font, color: rgb(0.6, 0.6, 0.65) });
}

writeFileSync(process.argv[2], await doc.save());
console.log('written', process.argv[2]);
