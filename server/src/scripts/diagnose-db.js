// Database Diagnostic Tool
require('../lib/env');
const net = require('net');
const { Client } = require('pg');

async function runDiagnostics() {
  console.log('========================================');
  console.log('   AKAZI DATABASE DIAGNOSTIC TOOL       ');
  console.log('========================================\n');

  // 1. Check environment variable
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    console.error('❌ FAIL: DATABASE_URL is missing in server/.env');
    return;
  }
  console.log('1. DATABASE_URL found:');
  // Mask password for display
  const masked = rawUrl.replace(/:([^@/:]+)@/, ':****@');
  console.log('   Value:', masked);

  // 2. Check for unencoded '@' in password
  const atCount = (rawUrl.match(/@/g) || []).length;
  if (atCount > 1) {
    console.warn('\n⚠️  WARNING: Multiple "@" symbols detected in DATABASE_URL.');
    console.warn('   If your password contains "@" (e.g. "@brian250"), it MUST be encoded as "%40".');
    console.warn('   Otherwise the parser thinks your hostname is the text after the first "@".');
  } else {
    console.log('   Format check: OK (Single "@" delimiter found).');
  }

  // 3. Parse host and port
  let host = '127.0.0.1';
  let port = 5432;
  try {
    const parsed = new URL(rawUrl);
    host = parsed.hostname || '127.0.0.1';
    port = parseInt(parsed.port, 10) || 5432;
    console.log(`\n2. Target Host: ${host}, Port: ${port}, Database: ${parsed.pathname.replace(/^\//, '')}`);
  } catch (e) {
    console.error('\n❌ FAIL: Could not parse DATABASE_URL as a valid URL:', e.message);
  }

  // 4. Test TCP Socket connection
  console.log(`\n3. Testing network connection to ${host}:${port}...`);
  const socketOk = await new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(4000);
    socket.on('connect', () => {
      console.log(`   ✅ SUCCESS: TCP port ${port} on ${host} is OPEN and reachable.`);
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      console.error(`   ❌ FAIL: Connection to ${host}:${port} timed out.`);
      socket.destroy();
      resolve(false);
    });
    socket.on('error', (err) => {
      console.error(`   ❌ FAIL: Cannot connect to ${host}:${port} (${err.code || err.message}).`);
      if (err.code === 'ECONNREFUSED') {
        console.error('   👉 Meaning: Nothing is listening on port ' + port + '.');
        if (host === 'localhost' || host === '127.0.0.1') {
          console.error('   👉 The local PostgreSQL server is NOT running. You must start the PostgreSQL service or use a cloud database.');
        }
      }
      resolve(false);
    });
    socket.connect(port, host);
  });

  if (!socketOk) {
    console.log('\n----------------------------------------');
    console.log('💡 DIAGNOSIS:');
    console.log('The server cannot reach PostgreSQL because the database service is not running.');
    console.log('----------------------------------------');
    return;
  }

  // 5. Test PostgreSQL authentication & database existence
  console.log('\n4. Testing PostgreSQL authentication...');
  const client = new Client({
    connectionString: rawUrl,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    console.log('   ✅ SUCCESS: Logged into PostgreSQL successfully!');
    const res = await client.query('SELECT current_database(), current_user, version()');
    console.log(`   Current Database: ${res.rows[0].current_database}`);
    console.log(`   Connected User:   ${res.rows[0].current_user}`);
    console.log('\n🎉 ALL CHECKS PASSED! Your database is properly configured.');
    await client.end();
  } catch (err) {
    console.error('   ❌ FAIL: PostgreSQL handshake error:', err.message);
    if (err.code === '28P01') {
      console.error('   👉 Meaning: Invalid password for user. Check your password in server/.env.');
    } else if (err.code === '3D000') {
      console.error('   👉 Meaning: The database does not exist. Run createdb to create it.');
    }
  }
}

runDiagnostics().catch(console.error);
