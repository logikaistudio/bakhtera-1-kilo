import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import net from 'net';
import { parse } from 'pg-connection-string';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TARGET_DATABASE_URL = process.env.DATABASE_URL;

const config = parse(TARGET_DATABASE_URL);

const localClient = new pg.Client({
  connectionString: TARGET_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  stream: (options) => {
    console.log('📡 Parsed host:', config.host, 'port:', config.port);
    return net.connect({
      host: config.host || 'db.fsxdykjcajasmgybqdua.supabase.co',
      port: config.port ? parseInt(config.port) : 5432,
      lookup: (hostname, dnsOpts, callback) => {
        console.log('🔍 DNS Resolving (forcing IPv4):', hostname);
        dns.lookup(hostname, { family: 4 }, callback);
      }
    });
  }


});

async function test() {
  try {
    console.log('🔌 Connecting to localClient...');
    await localClient.connect();
    console.log('✅ Connected successfully!');
    const res = await localClient.query('SELECT NOW();');
    console.log('🕒 DB Time:', res.rows[0]);
  } catch (err) {
    console.error('❌ Connection failed:', err);
  } finally {
    await localClient.end();
  }
}

test();
