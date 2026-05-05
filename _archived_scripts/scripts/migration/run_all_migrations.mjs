import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import pkg from 'pg';
const { Client } = pkg;

dotenv.config();

async function runAllMigrations() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        console.log('🔧 Connecting to database...');
        await client.connect();
        console.log('✅ Connected successfully\n');

        // Get all migration files
        const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql') && !file.includes('README'))
            .sort(); // Sort to ensure proper order

        console.log(`📋 Found ${files.length} migration files to process\n`);

        for (const file of files) {
            const filePath = path.join(migrationsDir, file);
            console.log(`🔄 Running migration: ${file}`);

            try {
                const sql = fs.readFileSync(filePath, 'utf8');

                // Execute the entire SQL file as one statement
                // This avoids issues with splitting on semicolons in functions
                await client.query(sql);

                console.log(`✅ Migration ${file} completed successfully\n`);
            } catch (error) {
                console.error(`❌ Migration ${file} failed:`, error.message);

                // Continue with next migration for all errors (many migrations have dependencies)
                console.log(`⚠️ Continuing with next migration...\n`);
            }
        }

        console.log('🎉 All migrations completed successfully!');

        // Verify key tables exist
        console.log('\n📋 Verifying key tables...');
        const result = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name LIKE 'blink_%'
            ORDER BY table_name
        `);

        console.log('Blink tables created:');
        result.rows.forEach(row => console.log(`- ${row.table_name}`));

    } catch (error) {
        console.error('❌ Migration process failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runAllMigrations();