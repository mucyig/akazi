// Antivirus scanner interface (ClamAV over TCP INSTREAM protocol).
const net = require('net');

let mockScanner = null;

function setMockScanner(fn) {
  mockScanner = fn;
}

function resetMockScanner() {
  mockScanner = null;
}

function scanWithClamd(buffer, host, port = 3310, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let resolved = false;
    let socket = null;

    const done = (result) => {
      if (resolved) return;
      resolved = true;
      if (socket) {
        try { socket.destroy(); } catch { /* ignore */ }
      }
      resolve(result);
    };

    try {
      socket = net.createConnection({ host, port });
      let responseData = '';

      socket.setTimeout(timeoutMs);

      socket.on('timeout', () => {
        done({ status: 'error', detail: 'ClamAV scan timed out after 10 seconds' });
      });

      socket.on('error', (err) => {
        done({ status: 'error', detail: `ClamAV connection error: ${err.message}` });
      });

      socket.on('data', (chunk) => {
        responseData += chunk.toString('utf8');
      });

      socket.on('end', () => {
        const resp = responseData.trim();
        if (/stream:\s*OK$/m.test(resp) || resp === 'stream: OK') {
          done({ status: 'clean', detail: 'OK' });
        } else if (/FOUND/m.test(resp)) {
          const match = resp.match(/stream:\s*(.+?)\s+FOUND/);
          done({ status: 'infected', detail: match ? match[1].trim() : resp });
        } else {
          done({ status: 'error', detail: resp || 'Empty or unexpected scanner response' });
        }
      });

      socket.on('connect', () => {
        // Send command zINSTREAM\0
        socket.write('zINSTREAM\0');

        // Stream buffer in chunks
        const CHUNK_SIZE = 32 * 1024;
        let offset = 0;
        while (offset < buffer.length) {
          const end = Math.min(offset + CHUNK_SIZE, buffer.length);
          const chunk = buffer.subarray(offset, end);
          const lenBuf = Buffer.alloc(4);
          lenBuf.writeUInt32BE(chunk.length, 0);
          socket.write(lenBuf);
          socket.write(chunk);
          offset = end;
        }

        // 4-byte 0-length chunk signals EOF
        const zeroBuf = Buffer.alloc(4);
        socket.write(zeroBuf);
      });
    } catch (err) {
      done({ status: 'error', detail: `ClamAV initialization error: ${err.message}` });
    }
  });
}

async function scanBuffer(buffer) {
  if (mockScanner) {
    return await mockScanner(buffer);
  }

  const host = process.env.CLAMAV_HOST;
  if (host) {
    const port = parseInt(process.env.CLAMAV_PORT, 10) || 3310;
    return await scanWithClamd(buffer, host, port, 10000);
  }

  const isProd = process.env.NODE_ENV === 'production';
  const allowUnscanned = process.env.ALLOW_UNSCANNED_UPLOADS === 'true';

  if (!isProd) {
    console.warn('[Scanner] CLAMAV_HOST not configured. File scan treated as clean in development.');
    return { status: 'clean', detail: 'Development mode: scanner bypassed' };
  }

  if (allowUnscanned) {
    return { status: 'clean', detail: 'Production override: ALLOW_UNSCANNED_UPLOADS=true' };
  }

  return { status: 'error', detail: 'ClamAV scanner is not configured in production' };
}

module.exports = {
  scanBuffer,
  setMockScanner,
  resetMockScanner,
  scanWithClamd,
};
