'use client';
// Navbar component for Ultimate Advisor Platform
// Shows navigation links and profile/logout actions based on user role (advisor/client)

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from '../supabaseClient';

export default function Navbar() {
  const user = useUser();
  const router = useRouter();

  // State for current user and their account info
  const [account, setAccount] = useState<any>(null);

  useEffect(() => {
    // Fetch account info if user is present
    if (user) {
      (async () => {
        const { data: account } = await supabase
          .from('accounts')
          .select('user_type_id')
          .eq('auth_user_id', user.id)
          .single();
        setAccount(account);
        // If client, set status to 'Available' on login
        if (account && account.user_type_id !== 2) {
          await supabase.from('accounts').update({ status: 'Available' }).eq('auth_user_id', user.id);
        }
      })();
    }
    // Listen for session expiration or unexpected logout
    const { data: listener } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        if (user) {
          const { data: account } = await supabase
            .from('accounts')
            .select('user_type_id')
            .eq('auth_user_id', user.id)
            .single();
          if (account && account.user_type_id !== 2) {
            await supabase.from('accounts').update({ status: 'Approved' }).eq('auth_user_id', user.id);
          }
        }
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [user]);

  // Robust Logout handler: sets status to 'Approved', logs out, and clears all sessions
  const handleLogout = () => {
    (async () => {
      try {
        if (user) {
          await supabase.from('accounts').update({ status: 'Approved' }).eq('auth_user_id', user.id);
          await supabase.auth.signOut();
        }
      } catch (err) {
        // Ignore errors
      } finally {
        if (typeof window !== 'undefined') {
          try { localStorage.clear(); } catch {}
          try { sessionStorage.clear(); } catch {}
          window.location.replace('/');
        }
      }
    })();
    // Fallback: force reload after 0.5 seconds if anything hangs
    setTimeout(() => { if (typeof window !== 'undefined') window.location.replace('/'); }, 500);
  };

  // Home button handler: set status to 'Approved', logout, and redirect to home
  const handleHomeClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAdvisor && user) {
      await supabase.from('accounts').update({ status: 'Approved' }).eq('auth_user_id', user.id);
      await supabase.auth.signOut();
    }
    router.push('/');
  };

  // If not authenticated, render nothing (parent should handle public nav)
  if (!user || !account) return null;

  const isAdvisor = account.user_type_id === 2;
  const isClient = !isAdvisor;

  return (
    <nav className="w-full bg-white dark:bg-neutral-950 shadow-sm py-4 px-6 flex items-center justify-between mb-8">
      <div className="flex items-center gap-6">
        {/* Site name, logs out and redirects home on click */}
        <a href="/" onClick={handleHomeClick} className="text-xl font-bold text-blue-700 dark:text-blue-300 tracking-tight cursor-pointer">Ultimate Advisor Platform</a>
        {/* Only show Advisors and Recharge link if NOT advisor */}
        {!isAdvisor && (
          <>
            <Link href="/advisors" className="px-4 py-2 rounded-lg border border-blue-500 text-blue-600 font-semibold text-base transition-colors hover:bg-blue-100/60 dark:hover:bg-blue-900/60">Advisors</Link>
            <Link href="/recharge" className="px-4 py-2 rounded-lg border border-green-500 text-green-600 font-semibold text-base transition-colors hover:bg-green-100/60 dark:hover:bg-green-900/60">Recharge</Link>
          </>
        )}
        {/* Profile link only for advisors */}
        {isAdvisor && (
          <Link href="/profile" className="px-4 py-2 rounded-lg border border-blue-500 text-blue-600 font-semibold text-base transition-colors hover:bg-blue-100/60 dark:hover:bg-blue-900/60">Profile</Link>
        )}
      </div>
      {/* Client: Show profile icon and logout button on home page */}
      {isClient && (
        <div className="flex items-center gap-4">
          <Link href="/profile">
            <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center overflow-hidden border-2 border-blue-500 cursor-pointer">
              {/* Show profile image if available, else first letter of name */}
              {account.profile_pic ? (
                <img src={account.profile_pic} alt="Profile" className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className="text-lg font-bold text-blue-700">{account.full_name ? account.full_name.charAt(0).toUpperCase() : 'C'}</span>
              )}
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg border border-red-500 text-red-600 font-semibold text-base transition-colors hover:bg-red-100/60 dark:hover:bg-red-900/60"
          >
            Logout
          </button>
        </div>
      )}
      {/* Advisor: Keep existing logout button */}
      {isAdvisor && (
        <button
          onClick={handleLogout}
          className="px-5 py-2 rounded-lg border border-red-500 text-red-600 font-semibold text-base transition-colors hover:bg-red-100/60 dark:hover:bg-red-900/60"
        >
          Logout
        </button>
      )}
    </nav>
  );
} 