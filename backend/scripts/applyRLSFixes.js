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

    console.log('\n📝 Applying SQL in a single fail-fast execution...\n');

    const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (rpcError) {
      // Fallback to direct execution if RPC helper differs by project setup.
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
      });

      if (!response.ok) {
        throw new Error(`SQL execution failed with HTTP ${response.status}`);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Successfully applied all RLS policy changes as one unit.');
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
