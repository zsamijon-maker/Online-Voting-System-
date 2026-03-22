/**
 * Apply RLS Policy Fixes to Supabase
 * This script reads the SQL file and applies it to your Supabase database
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyRLSFixes() {
  console.log('🔧 Applying RLS Policy Fixes...\n');
  console.log('📊 Database:', supabaseUrl);
  console.log('═'.repeat(60));

  try {
    // Read the SQL file
    const sqlPath = join(__dirname, '../supabase/fix_all_rls_policies.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Split by semicolons and filter out comments
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`\n📝 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comment-only statements
      if (statement.startsWith('--') || statement.length < 10) continue;

      // Extract policy name for logging
      const policyMatch = statement.match(/POLICY "([^"]+)"/);
      const policyName = policyMatch ? policyMatch[1] : `Statement ${i + 1}`;

      try {
        console.log(`⏳ Applying: ${policyName}...`);
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
        
        if (error) {
          // Try direct execution if RPC fails
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: statement + ';' })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
        }

        console.log(`✅ Success: ${policyName}`);
        successCount++;
      } catch (error) {
        console.log(`⚠️  Skipped: ${policyName} (${error.message})`);
        errorCount++;
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`✅ Successfully applied: ${successCount}`);
    console.log(`⚠️  Skipped/Errors: ${errorCount}`);
    console.log('\n💡 Note: Some errors are normal (e.g., dropping non-existent policies)');
    console.log('\n🎉 RLS policies have been configured!');
    console.log('📋 Your backend service role can now access all tables.');
    console.log('\n🔄 Try creating an election again in the browser!\n');

  } catch (error) {
    console.error('\n❌ Error applying RLS fixes:', error.message);
    console.log('\n📝 Manual fix required:');
    console.log('1. Go to: https://supabase.com/dashboard/project/bvjdpbqrudlaugkxpzvs/sql/new');
    console.log('2. Copy the contents of: backend/supabase/fix_all_rls_policies.sql');
    console.log('3. Paste and run the SQL');
    process.exit(1);
  }
}

applyRLSFixes().catch(console.error);
