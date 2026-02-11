import { neon } from '@neondatabase/serverless';

const connectionString = process.env.CONDUCTOR_DATABASE_URL;

const sql = neon(connectionString);

async function verifySchema() {
  try {
    console.log('✅ Connected to Neon database');

    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public'
      ORDER BY table_name;
    `;

    console.log(`\n📊 Found ${result.length} tables:\n`);
    result.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.table_name}`);
    });

    // Count columns in each table
    console.log('\n📋 Table details:\n');
    for (const row of result) {
      const colResult = await sql`
        SELECT COUNT(*) as col_count
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name=${row.table_name};
      `;
      console.log(`  ${row.table_name}: ${colResult[0].col_count} columns`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifySchema();
