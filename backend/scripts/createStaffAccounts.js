/**
 * Create Staff Accounts Script
 * This script creates admin and committee accounts in Supabase
 * Run with: node scripts/createStaffAccounts.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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

const staffAccounts = [
  {
    email: 'admin@school.edu',
    password: 'password',
    firstName: 'System',
    lastName: 'Administrator',
    roles: ['admin']
  },
  {
    email: 'election.committee@school.edu',
    password: 'password',
    firstName: 'Election',
    lastName: 'Committee',
    roles: ['election_committee']
  },
  {
    email: 'pageant.committee@school.edu',
    password: 'password',
    firstName: 'Pageant',
    lastName: 'Committee',
    roles: ['pageant_committee']
  },
  {
    email: 'judge1@school.edu',
    password: 'password',
    firstName: 'Maria',
    lastName: 'Santos',
    roles: ['judge']
  },
  {
    email: 'judge2@school.edu',
    password: 'password',
    firstName: 'John',
    lastName: 'Doe',
    roles: ['judge']
  },
  {
    email: 'judge3@school.edu',
    password: 'password',
    firstName: 'Sarah',
    lastName: 'Lee',
    roles: ['judge']
  }
];

async function createStaffAccount(account) {
  try {
    console.log(`\n📝 Creating account for ${account.email}...`);
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        first_name: account.firstName,
        last_name: account.lastName
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`⚠️  Account already exists in auth: ${account.email}`);
        
        // Try to find existing user
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;
        
        const existingUser = users.find(u => u.email === account.email);
        if (existingUser) {
          // Insert/update in users table
          await insertUserProfile(existingUser.id, account);
          console.log(`✅ Updated profile for ${account.email}`);
          return;
        }
      } else {
        throw authError;
      }
    }

    if (authData?.user) {
      // Insert into users table
      await insertUserProfile(authData.user.id, account);
      console.log(`✅ Successfully created ${account.email}`);
    }
  } catch (error) {
    console.error(`❌ Error creating ${account.email}:`, error.message);
  }
}

async function insertUserProfile(userId, account) {
  const { error } = await supabase
    .from('users')
    .upsert({
      id: userId,
      email: account.email,
      first_name: account.firstName,
      last_name: account.lastName,
      roles: account.roles,
      is_active: true,
      email_verified: true
    }, {
      onConflict: 'id'
    });

  if (error) throw error;
}

async function main() {
  console.log('🚀 Creating staff accounts in Supabase...\n');
  console.log('📊 Database:', supabaseUrl);
  console.log('═'.repeat(60));

  for (const account of staffAccounts) {
    await createStaffAccount(account);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✨ Staff account creation complete!\n');
  console.log('📋 Default password for all accounts: password');
  console.log('⚠️  Please change these passwords in production!\n');
}

main().catch(console.error);
