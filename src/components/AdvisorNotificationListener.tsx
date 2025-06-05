'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export function AdvisorNotificationListener() {
  const [toast, setToast] = useState<string | null>(null);
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  useEffect(() => {
    let channel: any;
    let advisorAccountId: number | null = null;
    let isAdvisor = false;
    (async () => {
      if (typeof window === 'undefined') return;
      // Get user
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) console.error('Supabase getUser error (advisor):', userErr);
      if (!user) return;
      // Get account info
      const { data: account, error: accErr } = await supabase
        .from('accounts')
        .select('account_id, user_type_id')
        .eq('auth_user_id', user.id)
        .single();
      if (accErr) console.error('Supabase get account error (advisor):', accErr);
      if (!account) return;
      advisorAccountId = account.account_id;
      isAdvisor = account.user_type_id === 2;
      if (!isAdvisor) return;
      // Subscribe to call_requests for this advisor
      channel = supabase
        .channel('global-advisor-notifications')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_requests',
          filter: `advisor_id=eq.${advisorAccountId}`
        }, async (payload) => {
          const req = payload.new;
          // Prevent duplicate notifications
          if (payload.commit_timestamp === lastEventId) return;
          setLastEventId(payload.commit_timestamp);
          console.log('[AdvisorNotificationListener] call_requests update:', req.status, req);
          if (req.status === 'declined') {
            // Fetch client name
            const { data: client, error: clientErr } = await supabase
              .from('accounts')
              .select('full_name')
              .eq('account_id', req.client_id)
              .single();
            if (clientErr) console.error('Supabase get client error (advisor):', clientErr);
            setToast(`${client?.full_name || 'Client'} declined the call.`);
            console.log('[AdvisorNotificationListener] Client declined the call.');
          }
        })
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Auto-dismiss toast after 2 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!toast) return null;
  // Toast UI (centered, beautiful)
  return (
    <div
      className="fixed top-8 left-1/2 transform -translate-x-1/2 z-[9999] min-w-[320px] max-w-[90vw] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl font-semibold text-base transition-all duration-300 animate-fade-in bg-gradient-to-r from-rose-500 to-red-400 text-white"
      style={{ boxShadow: '0 8px 32px 0 rgba(239,68,68,0.15)' }}
      role="alert"
      aria-live="polite"
    >
      <span className="text-2xl">❌</span>
      <span className="flex-1">{toast}</span>
    </div>
  );
} 