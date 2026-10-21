// Content safety checks on uploaded file buffers.
// Never executes or renders any file; works on raw buffer only.
const AdmZip = require('adm-zip');
const { query } = require('../db');

const FORBIDDEN_PDF_TOKENS = [
  '/JavaScript',
  '/JS',
  '/Launch',
  '/OpenAction',
  '/EmbeddedFile',
  '/RichMedia',
];

const FORBIDDEN_DOCX_EXTS = ['.exe', '.dll', '.js', '.vbs', '.bat'];

async function inspectFile(buffer, ext) {
  if (!Buffer.isBuffer(buffer)) {
    return { ok: false, reason: 'Invalid file data' };
  }
  const cleanExt = String(ext || '').toLowerCase().replace('.', '');

  // 1. PDF
  if (cleanExt === 'pdf') {
    for (const token of FORBIDDEN_PDF_TOKENS) {
      if (buffer.includes(Buffer.from(token))) {
        return { ok: false, reason: `PDF contains forbidden action or embedded content (${token})` };
      }
    }
    const latin1 = buffer.toString('latin1');
    const matched = latin1.match(/\/(javascript|js|launch|openaction|embeddedfile|richmedia)\b/i);
    if (matched) {
      return { ok: false, reason: `PDF contains forbidden action or embedded content (/${matched[1]})` };
    }
    return { ok: true };
  }

  // 2. DOCX (safe zip reader)
  if (cleanExt === 'docx') {
    let zip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      return { ok: false, reason: 'DOCX archive is corrupt or invalid' };
    }

    let entries;
    try {
      entries = zip.getEntries();
    } catch {
      return { ok: false, reason: 'DOCX entries could not be read' };
    }

    if (entries.length > 500) {
      return { ok: false, reason: 'DOCX contains too many entries (zip bomb protection)' };
    }

    let totalUncompressedSize = 0;
    let totalCompressedSize = 0;

    for (const entry of entries) {
      const rawName = entry.entryName || '';
      const name = rawName.replace(/\\/g, '/');
      const lowerName = name.toLowerCase();

      // Path traversal
      if (name.includes('..') || name.startsWith('/')) {
        return { ok: false, reason: 'DOCX contains path traversal in entry names' };
      }

      // Prohibited entry names
      if (lowerName.includes('vbaproject.bin')) {
        return { ok: false, reason: 'DOCX contains macro code (vbaProject.bin)' };
      }
      if (lowerName.includes('embeddings/')) {
        return { ok: false, reason: 'DOCX contains embedded objects (embeddings/)' };
      }
      if (FORBIDDEN_DOCX_EXTS.some((extItem) => lowerName.includes(extItem))) {
        return { ok: false, reason: 'DOCX contains forbidden executable or script files' };
      }

      const uncompressed = entry.header ? Number(entry.header.size || 0) : 0;
      const compressed = entry.header ? Number(entry.header.compressedSize || 0) : 0;
      totalUncompressedSize += uncompressed;
      totalCompressedSize += compressed;

      if (compressed > 0 && (uncompressed / compressed > 100)) {
        return { ok: false, reason: 'DOCX entry compression ratio exceeds 100:1 (zip bomb protection)' };
      }
      if (compressed === 0 && uncompressed > 1024) {
        return { ok: false, reason: 'DOCX entry compression ratio exceeds 100:1 (zip bomb protection)' };
      }
    }

    if (totalUncompressedSize > 50 * 1024 * 1024) {
      return { ok: false, reason: 'DOCX total uncompressed size exceeds 50 MB' };
    }

    const overallRatio = totalUncompressedSize / Math.max(1, buffer.length);
    if (overallRatio > 100) {
      return { ok: false, reason: 'DOCX compression ratio exceeds 100:1 (zip bomb protection)' };
    }
    if (totalCompressedSize > 0 && (totalUncompressedSize / totalCompressedSize > 100)) {
      return { ok: false, reason: 'DOCX compression ratio exceeds 100:1 (zip bomb protection)' };
    }

    // Check .rels files for TargetMode="External"
    for (const entry of entries) {
      const name = (entry.entryName || '').replace(/\\/g, '/').toLowerCase();
      if (name.endsWith('.rels')) {
        let content;
        try {
          content = zip.readAsText(entry);
        } catch {
          return { ok: false, reason: 'DOCX contains unreadable relationship file' };
        }
        if (/TargetMode\s*=\s*["']External["']/i.test(content)) {
          return { ok: false, reason: 'DOCX contains external relationship targets (TargetMode="External")' };
        }
      }
    }

    return { ok: true };
  }

  // 3. Images (png/jpg/jpeg/webp)
  if (cleanExt === 'png') {
    const iendIndex = buffer.lastIndexOf(Buffer.from('IEND'));
    if (iendIndex === -1) {
      return { ok: false, reason: 'PNG image missing IEND marker' };
    }
    // IEND chunk is 4 bytes 'IEND' + 4 bytes CRC = 8 bytes
    if (buffer.length > iendIndex + 8) {
      return { ok: false, reason: 'PNG image contains trailing data after end marker' };
    }
    return { ok: true };
  }

  if (cleanExt === 'jpg' || cleanExt === 'jpeg') {
    const eoiIndex = buffer.lastIndexOf(Buffer.from([0xff, 0xd9]));
    if (eoiIndex === -1) {
      return { ok: false, reason: 'JPEG image missing EOI marker' };
    }
    if (buffer.length > eoiIndex + 2) {
      return { ok: false, reason: 'JPEG image contains trailing data after end marker' };
    }
    return { ok: true };
  }

  if (cleanExt === 'webp') {
    if (buffer.length < 12) {
      return { ok: false, reason: 'WEBP image is truncated' };
    }
    const riffSize = buffer.readUInt32LE(4) + 8;
    const paddedSize = riffSize % 2 === 1 ? riffSize + 1 : riffSize;
    if (buffer.length > paddedSize) {
      return { ok: false, reason: 'WEBP image contains trailing data after RIFF container' };
    }
    return { ok: true };
  }

  return { ok: true };
}

// Find another employer who uploaded a document with the same sha256 hash
async function findDuplicateDoc(sha256, excludeUserId = null) {
  if (!sha256) return null;
  const r = await query(
    `SELECT e.id AS employer_id, e.user_id, e.company_name
     FROM employers e
     JOIN file_scans fs ON (
       fs.key = e.registration_doc_url
       OR e.registration_doc_url = '/uploads/' || fs.key
       OR e.registration_doc_url = 'uploads/' || fs.key
       OR fs.key = TRIM(LEADING '/' FROM REPLACE(e.registration_doc_url, '/uploads/', ''))
     )
     WHERE fs.sha256 = $1
       AND ($2::int IS NULL OR e.user_id <> $2)
     LIMIT 1`,
    [sha256, excludeUserId || null]
  );
  return r.rows[0] || null;
}

module.exports = {
  inspectFile,
  findDuplicateDoc,
  FORBIDDEN_PDF_TOKENS,
};
