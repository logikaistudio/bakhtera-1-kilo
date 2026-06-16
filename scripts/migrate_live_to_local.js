import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import net from 'net';
import { parse } from 'pg-connection-string';


// Force Node to resolve IPv4 first to prevent IPv6 timeout issues on certain networks/ISPs
dns.setDefaultResultOrder('ipv4first');

// Setup environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Live database credentials (Nicebakhtera1)
const LIVE_SUPABASE_URL = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const LIVE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MTAzMTYsImV4cCI6MjA4MjI4NjMxNn0.qeCz78VNVEcnjUXgBywdxF9Ju1eZzlRPJa_Ff-_33XQ';

// Local/Target database credentials (from .env)
const TARGET_DATABASE_URL = process.env.DATABASE_URL;

if (!TARGET_DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL tidak ditemukan di file .env!');
  console.error('Silakan pastikan file .env Anda berisi baris:');
  console.error('DATABASE_URL=postgresql://postgres:PASSWORD@db.fsxdykjcajasmgybqdua.supabase.co:5432/postgres');
  process.exit(1);
}

const config = parse(TARGET_DATABASE_URL);

const liveClient = createClient(LIVE_SUPABASE_URL, LIVE_SUPABASE_ANON_KEY);
const localClient = new pg.Client({
  connectionString: TARGET_DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
  stream: (options) => {
    return net.connect({
      host: config.host || 'db.fsxdykjcajasmgybqdua.supabase.co',
      port: config.port ? parseInt(config.port) : 5432,
      lookup: (hostname, dnsOpts, callback) => {
        dns.lookup(hostname, { family: 4 }, callback);
      }
    });
  }
});



async function main() {
  console.log('============================================================');
  console.log('🚀 MEMULAI MIGRASI DATA DARI VERSI LIVE KE LOKAL/LIVE NEW');
  console.log('============================================================');
  console.log(`📡 Sumber (Live): ${LIVE_SUPABASE_URL}`);
  console.log(`🔌 Target (Lokal/Live): db.fsxdykjcajasmgybqdua.supabase.co`);
  console.log('------------------------------------------------------------\n');

  try {
    // Hubungkan ke database lokal
    console.log('🔌 Menghubungkan ke database target...');
    await localClient.connect();
    console.log('✅ Berhasil terhubung ke database target!\n');

    // Ambil daftar semua tabel di schema public di database lokal
    console.log('🔍 Mengambil daftar tabel dari schema public target...');
    const resTables = await localClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('_prisma_migrations', 'schema_migrations')
      ORDER BY table_name;
    `);

    const tables = resTables.rows.map(row => row.table_name);
    console.log(`📋 Ditemukan ${tables.length} tabel untuk dimigrasikan.\n`);

    // Nonaktifkan trigger foreign key sementara di database target agar tidak memicu error constraint
    console.log('🔒 Menonaktifkan trigger Foreign Key di database target...');
    await localClient.query("SET session_replication_role = 'replica';");
    console.log('✅ Trigger dinonaktifkan.\n');

    for (const tableName of tables) {
      console.log(`------------------------------------------------------------`);
      console.log(`📦 Memproses Tabel: [ ${tableName} ]`);
      console.log(`------------------------------------------------------------`);

      try {
        // Ambil daftar kolom yang ada di database target lokal agar tidak memasukkan kolom yang tidak terdaftar
        const resCols = await localClient.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = $1
        `, [tableName]);
        
        const targetCols = new Set(resCols.rows.map(r => r.column_name));

        // 1. Ambil data dari live database
        console.log(`   📡 Mengambil data dari Live Supabase...`);
        const { data: rows, error: fetchError } = await liveClient
          .from(tableName)
          .select('*');

        if (fetchError) {
          throw new Error(`Gagal mengambil data: ${fetchError.message}`);
        }

        console.log(`   📥 Ditemukan ${rows.length} baris data.`);

        // 2. Kosongkan data lama di tabel lokal
        console.log(`   🗑️  Mengosongkan data lama di tabel target...`);
        await localClient.query(`DELETE FROM public."${tableName}";`);

        if (rows.length === 0) {
          console.log(`   ✨ Tabel kosong di Live. Selesai memproses.`);
          continue;
        }

        // 3. Masukkan data ke database lokal
        console.log(`   ✍️  Memasukkan ${rows.length} baris data ke target...`);
        let successCount = 0;
        
        for (const row of rows) {
          // Filter kolom yang hanya ada di target schema saja untuk menghindari error perbedaan kolom
          const filteredRow = {};
          for (const key of Object.keys(row)) {
            if (targetCols.has(key)) {
              filteredRow[key] = row[key];
            }
          }

          const columns = Object.keys(filteredRow);
          const values = Object.values(filteredRow);

          if (columns.length === 0) continue;
          
          const colNames = columns.map(c => `"${c}"`).join(', ');
          const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
          
          const insertQuery = `INSERT INTO public."${tableName}" (${colNames}) VALUES (${placeholders});`;
          
          try {
            await localClient.query(insertQuery, values);
            successCount++;
          } catch (insertErr) {
            console.error(`   ⚠️  Error pada baris data:`, insertErr.message);
          }
        }

        console.log(`   ✅ Selesai: Berhasil memindahkan ${successCount}/${rows.length} baris.`);

      } catch (err) {
        console.error(`   ❌ Gagal memproses tabel ${tableName}:`, err.message);
      }
    }

    // Aktifkan kembali trigger foreign key
    console.log('\n------------------------------------------------------------');
    console.log('🔓 Mengaktifkan kembali trigger Foreign Key di database target...');
    await localClient.query("SET session_replication_role = 'origin';");
    console.log('✅ Trigger diaktifkan kembali.\n');

    console.log('============================================================');
    console.log('🎉 MIGRASI SELESAI DENGAN SUKSES!');
    console.log('============================================================');
    console.log('Aplikasi lokal (localhost) dan live Anda sekarang menggunakan');
    console.log('database baru yang sudah tersinkronisasi dengan data nicebakhtera!');
    console.log('============================================================\n');

  } catch (error) {
    console.error('❌ Terjadi kesalahan fatal:', error.message);
  } finally {
    await localClient.end();
  }
}

main();
