// Login page for Ultimate Advisor Platform
// Handles both advisor and client login, with role-based logic

"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "../../supabaseClient";
import Link from 'next/link';
import { toE164 } from '../../components/phoneFormat';

export default function LoginPage() {
  // State for form fields and UI feedback
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const router = useRouter();

  // Handles login form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPhoneError(null);
    let loginPhone = phone;
    try {
      // Format phone for Supabase Auth
      let digits = loginPhone.replace(/[^0-9]/g, '');
      if (digits.startsWith('91')) digits = digits;
      else if (digits.length === 10) digits = '91' + digits;
      setLoading(true);
      // 1. Check if user exists in accounts table
      const { data: account, error: accErr } = await supabase
        .from('accounts')
        .select('user_type_id, status')
        .eq('phone', '+' + digits)
        .single();
      if (accErr || !account) {
        setLoading(false);
        setError('User not found. Please Sign Up.');
        return;
      }
      // 2. Try password login with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        phone: digits,
        password,
      });
      if (authError) {
        setLoading(false);
        if (authError.message.toLowerCase().includes('invalid login credentials')) {
          setError('Incorrect password.');
        } else {
          setError(authError.message);
        }
        return;
      }
      // 3. Role-based logic for advisor or client
      if (account.user_type_id === 2) {
        // Advisor logic: Only allow login if status is Approved
        if (account.status !== 'Approved') {
          setError('You cannot login. You can login after approval.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
        if (account.status === 'Approved') {
          await supabase
            .from('accounts')
            .update({ status: 'Available' })
            .eq('phone', '+' + digits);
        }
        router.push('/profile');
        setLoading(false);
        return;
      } else {
        // Client logic: Set status and redirect to home
        await supabase
          .from('accounts')
          .update({ status: 'Available' })
          .eq('phone', '+' + digits);
        router.push('/');
        setLoading(false);
        return;
      }
    } catch (err: any) {
      setPhoneError('Phone number must be exactly 10 digits.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-blue-50 dark:from-neutral-900 dark:to-blue-950">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 px-4 py-2 rounded-full border border-blue-500 text-blue-600 font-semibold bg-white dark:bg-neutral-900 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Go back"
        >
          ← Back
        </button>
        {/* Login form */}
        <form onSubmit={handleLogin} className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-8 w-full flex flex-col gap-6">
          <h1 className="text-2xl font-bold text-center">Login</h1>
          {/* Phone input */}
          <input
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={e => {
              // Only allow numbers, strip leading 91 or +
              let val = e.target.value.replace(/[^0-9]/g, '');
              if (val.length > 10 && val.startsWith('91')) val = val.slice(2);
              setPhone(val.slice(0, 10));
            }}
            className="px-4 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
            maxLength={10}
            inputMode="numeric"
            pattern="[0-9]{10}"
          />
          {phoneError && <div className="text-red-500 text-xs text-center">{phoneError}</div>}
          {/* Password input */}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="px-4 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          {error && <div className="text-red-500 text-sm text-center">{error}</div>}
          {/* Submit button */}
          <button
            type="submit"
            className="w-full py-2 rounded-lg border border-blue-500 text-blue-600 font-semibold text-base transition-colors hover:bg-blue-100/60 dark:hover:bg-blue-900/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
          {/* Link to signup */}
          <div className="text-center mt-4 text-sm">
            Don't have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:underline font-semibold">Sign Up</Link>
          </div>
        </form>
      </div>
    </main>
  );
} 