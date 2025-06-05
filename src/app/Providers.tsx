'use client';

import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '../supabaseClient';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      {children}
    </SessionContextProvider>
  );
} 