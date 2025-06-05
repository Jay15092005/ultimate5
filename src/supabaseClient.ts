// Supabase client initialization for Ultimate Advisor Platform
// Handles connection to Supabase backend and session management

import { createClient } from '@supabase/supabase-js';

// Use environment variables for security (set in .env)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create Supabase client instance
// Use localStorage for persistent sessions (recommended for clients)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined, // Use localStorage for persistent login
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Remove forced logout on page unload 