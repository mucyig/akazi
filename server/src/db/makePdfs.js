const fs = require('fs');
const path = require('path');

function createSimplePdf(filePath, title, lines) {
  const content = [
    'BT',
    '/F1 16 Tf',
    '50 720 Td',
    `(${title.replace(/[()]/g, '')}) Tj`,
    '/F1 11 Tf',
    '0 -30 Td'
  ];

  lines.forEach(line => {
    content.push(`(${line.replace(/[()]/g, '')}) Tj`);
    content.push('0 -18 Td');
  });

  content.push('ET');
  const streamData = content.join('\n');
  const streamLength = Buffer.byteLength(streamData, 'utf8');

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${streamData}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000300 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + streamLength}
%%EOF`;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, pdf, 'utf8');
}

const root = path.join(__dirname, '..', 'uploads');

createSimplePdf(
  path.join(root, 'documents', 'serena_hotel_rdb_registration.pdf'),
  'REPUBLIC OF RWANDA - RDB COMPANY REGISTRATION',
  [
    'Authority: Rwanda Development Board - Office of the Registrar General',
    'Enterprise Name: Kigali Serena Hotel Ltd',
    'Company Code: 100084920',
    'Sector: Hospitality, Tourism & Accommodation',
    'Address: Boulevard de la Revolution, Nyarugenge, Kigali',
    'Compliance Status: Active and Fully Registered'
  ]
);

createSimplePdf(
  path.join(root, 'documents', 'inyange_logistics_registration.pdf'),
  'RDB CERTIFICATE OF DOMESTIC COMPANY REGISTRATION',
  [
    'Authority: Rwanda Development Board (RDB)',
    'Company Name: Inyange Logistics Distribution Ltd',
    'Application Reference: RDB-CORP-2026-088192',
    'Sector: Commercial Transport & Freight Distribution',
    'Registered Office: Masaka, Kicukiro, Kigali City',
    'Legal Representative: Jean Bosco Hakizimana',
    'Status: Verification Pending Administrator Review'
  ]
);

createSimplePdf(
  path.join(root, 'resumes', 'eric_manzi_cv.pdf'),
  'CURRICULUM VITAE - ERIC MANZI',
  [
    'Name: Eric Manzi | Contact: +250 788 333 222 | Email: eric.manzi@example.rw',
    'National ID: 1199880012345678 | Location: Gasabo, Kigali',
    'Education: TVET Certificate in Hospitality & Food and Beverage Service (2022)',
    'Languages: Kinyarwanda (Native), English (Fluent)',
    'Experience: Waiter at Mille Collines Terrace (2023 - 2025)',
    '- Welcomed guests, took food and beverage orders, provided banquet service.',
    '- Maintained cash register and processed mobile money and POS card payments.'
  ]
);

console.log('Authentic PDF verification records generated.');
