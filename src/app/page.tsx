// Home page for the Ultimate Advisor Platform
// Shows header, hero section, featured advisors, and footer

"use client";
import React, { useEffect, useState } from "react";
import AdvisorSection from "../components/AdvisorSection";
import Navbar from "../components/Navbar";
import Link from "next/link";
import { supabase } from "../supabaseClient";

// Main Home component
export default function Home() {
  // State to track if user is a client
  const [showClientNavbar, setShowClientNavbar] = useState(false);
  const [clientProfile, setClientProfile] = useState<{ full_name?: string; profile_pic?: string } | null>(null);

  useEffect(() => {
    // Check if user is logged in and is a client
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data: account } = await supabase
          .from('accounts')
          .select('user_type_id, full_name, profile_pic')
          .eq('auth_user_id', user.id)
          .single();
        if (account && account.user_type_id !== 2) {
          setShowClientNavbar(true);
          setClientProfile({ full_name: account.full_name, profile_pic: account.profile_pic });
        } else {
          setShowClientNavbar(false);
          setClientProfile(null);
        }
      } else {
        setShowClientNavbar(false);
        setClientProfile(null);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-blue-50 dark:from-neutral-900 dark:to-blue-950 flex flex-col">
      {/* Conditionally render Navbar for logged-in clients only */}
      {showClientNavbar ? (
        <Navbar />
      ) : (
        // Default header for logged-out users or advisors
        <header className="w-full bg-white dark:bg-neutral-950 shadow-sm py-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-blue-700 dark:text-blue-300 tracking-tight">Ultimate Advisor Platform</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            {/* Link to Advisors and Recharge page */}
            <Link href="/advisors" className="px-4 py-2 rounded-lg border border-blue-500 text-blue-600 font-semibold text-base transition-colors hover:bg-blue-100/60 dark:hover:bg-blue-900/60">Advisors</Link>
            <Link href="/recharge" className="px-4 py-2 rounded-lg border border-green-500 text-green-600 font-semibold text-base transition-colors hover:bg-green-100/60 dark:hover:bg-green-900/60">Recharge</Link>
            {/* If logged-in client, show profile pic and logout */}
            {clientProfile && (
              <>
                <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center overflow-hidden border-2 border-blue-500 cursor-pointer">
                  {clientProfile.profile_pic ? (
                    <img src={clientProfile.profile_pic} alt="Profile" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-lg font-bold text-blue-700">{clientProfile.full_name ? clientProfile.full_name.charAt(0).toUpperCase() : 'C'}</span>
                  )}
                </div>
                <button
                  onClick={async () => {
                    // Robust logout logic (same as Navbar)
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      await supabase.from('accounts').update({ status: 'Approved' }).eq('auth_user_id', user.id);
                      await supabase.auth.signOut();
                    }
                    try { localStorage.clear(); } catch {}
                    try { sessionStorage.clear(); } catch {}
                    window.location.replace('/');
                  }}
                  className="px-4 py-2 rounded-lg border border-red-500 text-red-600 font-semibold text-base transition-colors hover:bg-red-100/60 dark:hover:bg-red-900/60 ml-2"
                >
                  Logout
                </button>
              </>
            )}
            {/* Login and Signup buttons for others */}
            {!clientProfile && <>
              <Link href="/login" className="px-5 py-2 rounded-lg border border-blue-500 text-blue-600 font-semibold text-base transition-colors hover:bg-blue-100/60 dark:hover:bg-blue-900/60">Login</Link>
              <Link href="/signup" className="px-5 py-2 rounded-lg border border-blue-600 bg-blue-600 text-white font-semibold text-base transition-colors hover:bg-blue-700 dark:hover:bg-blue-800">Sign Up</Link>
            </>}
          </div>
        </header>
      )}

      {/* Hero Section: Tagline and call-to-action buttons */}
      <section className="w-full flex justify-center bg-gradient-to-r from-blue-50/60 to-white dark:from-blue-950/60 dark:to-neutral-950 py-12 md:py-20 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-3xl w-full flex flex-col items-center text-center gap-6 px-4">
          <p className="text-lg md:text-xl text-neutral-700 dark:text-neutral-200 max-w-2xl mb-4">Connect instantly with top advisors in business, finance, and more. Classic expertise, modern experience.</p>
          <div className="flex gap-4">
            {/* Get Started and Learn More buttons (no logic yet) */}
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2">Get Started</button>
            <button className="bg-white dark:bg-neutral-900 border border-blue-600 text-blue-700 dark:text-blue-300 font-semibold px-6 py-3 rounded-full transition-colors hover:bg-blue-50 dark:hover:bg-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2">Learn More</button>
          </div>
        </div>
      </section>

      {/* Main Content: Featured Advisors section */}
      <main className="flex-1 flex flex-col gap-16 py-8 px-2 md:px-0">
        <AdvisorSection />
      </main>

      {/* Footer: Copyright info */}
      <footer className="w-full py-6 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 text-center text-neutral-500 text-sm">
        &copy; {new Date().getFullYear()} Ultimate Advisor Platform. All rights reserved.
      </footer>
    </div>
  );
}
