# Node.js Backend for Secure School Voting System


This backend uses Express.js and is structured for API development. Example folders:

- src/index.js: Entry point
- src/routes/: API route definitions
- src/controllers/: Business logic (uses Supabase)
- src/lib/supabaseClient.js: Supabase client setup

## Supabase Integration
- Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables.
- Example usage in controllers (see userController.js).

## Scripts
- npm run dev: Start with nodemon (development)
- npm start: Start normally

## Install dependencies
npm install
