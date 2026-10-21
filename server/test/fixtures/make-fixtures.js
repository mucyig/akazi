const fs = require('fs'), path = require('path'), AdmZip = require('adm-zip');
const out = path.join(__dirname, 'files'); fs.mkdirSync(out, { recursive: true });
const w = (n, b) => fs.writeFileSync(path.join(out, n), b);

const PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
w('clean.pdf', PDF);
w('js.pdf', PDF.replace('/Type/Catalog', '/Type/Catalog/OpenAction<</S/JavaScript/JS(app.alert(1))>>'));
w('empty.pdf', Buffer.alloc(0));
w('big.pdf', Buffer.concat([Buffer.from(PDF), Buffer.alloc(11 * 1024 * 1024)])); // set above your size limit
w('fake.pdf', Buffer.from('MZ\x90\x00 pretend executable'));      // .exe disguised as pdf
w('plain-text.pdf', Buffer.from('just text, not a pdf'));

const docx = (extra = () => {}) => {
  const z = new AdmZip();
  z.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'));
  z.addFile('_rels/.rels', Buffer.from('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'));
  z.addFile('word/document.xml', Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Test CV</w:t></w:r></w:p></w:body></w:document>'));
  extra(z); return z.toBuffer();
};
w('clean.docx', docx());
w('macro.docx', docx(z => z.addFile('word/vbaProject.bin', Buffer.from('fake'))));
w('embedded.docx', docx(z => z.addFile('word/embeddings/oleObject1.bin', Buffer.from('fake'))));
w('external-link.docx', docx(z => z.addFile('word/_rels/document.xml.rels', Buffer.from('<Relationships><Relationship Id="r9" Type="x" Target="http://example.com/a" TargetMode="External"/></Relationships>'))));
w('contains-exe.docx', docx(z => z.addFile('word/payload.exe', Buffer.from('MZ'))));
w('zipbomb.docx', docx(z => z.addFile('word/big.xml', Buffer.alloc(60 * 1024 * 1024, 0)))); // tiny file, huge when opened
w('many-entries.docx', docx(z => { for (let i = 0; i < 600; i++) z.addFile(`word/f${i}.xml`, Buffer.from('x')); }));
w('path-traversal.docx', docx(z => z.addFile('word/evil.xml', Buffer.from('x'), '', 0))); // then rename entry to ../evil.xml in a test if your zip lib allows it

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
w('clean.png', PNG);
w('png-trailing.png', Buffer.concat([PNG, Buffer.from('<?php echo 1; ?>')]));