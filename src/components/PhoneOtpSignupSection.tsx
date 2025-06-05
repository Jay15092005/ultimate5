"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useRouter } from "next/navigation";
import { toE164 } from './phoneFormat';

interface PhoneOtpSignupSectionProps {
  initialUserType?: 'client' | 'advisor';
}

export default function PhoneOtpSignupSection({ initialUserType = 'client' }: PhoneOtpSignupSectionProps) {
  const [userType, setUserType] = useState<'client' | 'advisor'>(initialUserType);
  const [form, setForm] = useState<any>({});
  const [expertises, setExpertises] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [experiences, setExperiences] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showToken, setShowToken] = useState<string | null>(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [selectedExpertises, setSelectedExpertises] = useState<string[]>([]);
  const [expertiseError, setExpertiseError] = useState<string | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState('');
  const router = useRouter();

  // Fetch dropdown data for advisor fields
  useEffect(() => {
    if (userType === 'advisor') {
      (async () => {
        const [exp, exps, rts, langs] = await Promise.all([
          supabase.from('expertises').select('expertise_id,expertise_name'),
          supabase.from('experience_years').select('experience_years_id,years_value,description'),
          supabase.from('rates_per_minute').select('rate_per_minute_id,rate_value'),
          supabase.from('languages').select('language_id,language_name')
        ]);
        setExpertises(exp.data || []);
        setExperiences(exps.data || []);
        setRates(rts.data || []);
        setLanguages(langs.data || []);
      })();
    }
  }, [userType]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value } = e.target;
    if (name === 'phone') {
      // Remove all non-digits
      value = value.replace(/[^0-9]/g, '');
      // If starts with '91' and is longer than 10 digits, strip '91'
      if (value.length > 10 && value.startsWith('91')) value = value.slice(2);
      // Only allow 10 digits
      value = value.slice(0, 10);
      setForm({ ...form, [name]: value });
      if (value && value.length !== 10) {
        setPhoneError('Phone number must be exactly 10 digits.');
      } else {
        setPhoneError(null);
      }
      return;
    }
    setForm({ ...form, [name]: value });
  };

  const handleExpertiseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions).map(opt => opt.value);
    if (options.length > 2) {
      setExpertiseError('You Can Only Select Up To Two Expertise Fields.');
      setShowErrorPopup(true);
      return;
    }
    setExpertiseError(null);
    setSelectedExpertises(options);
    setForm({ ...form, expertise_id: options.join(',') });
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions).map(opt => opt.value);
    if (options.length > 2) {
      setLanguageError('You Can Only Select Up To Two Languages.');
      setShowErrorPopup(true);
      return;
    }
    setLanguageError(null);
    setSelectedLanguages(options);
    setForm({ ...form, language_id: options.join(',') });
  };

  const handleSignup = async () => {
    setError(null);
    setSuccess(null);
    setShowToken(null);
    setShowErrorPopup(false);
    setLoading(true);
    try {
      const { phone, full_name, password, expertise_id, rate_per_minute_id, experience_years_id, language_id } = form;
      if (!phone || !full_name || !password) {
        setError('Please fill all required fields.');
        setShowErrorPopup(true);
        setLoading(false);
        return;
      }
      if (userType === 'advisor' && (!expertise_id || !rate_per_minute_id || !experience_years_id || !language_id)) {
        setError('Please Fill All Mandatory Fields.');
        setShowErrorPopup(true);
        setLoading(false);
        return;
      }
      if (!/^[0-9]{10}$/.test(phone)) {
        setError('Phone number must be exactly 10 digits.');
        setShowErrorPopup(true);
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        setShowErrorPopup(true);
        setLoading(false);
        return;
      }
      let e164Phone: string;
      try {
        e164Phone = toE164(phone);
        console.log('Phone before formatting:', phone);
        console.log('Phone after formatting:', e164Phone);
      } catch (err: any) {
        setError('Phone number must be exactly 10 digits.');
        setShowErrorPopup(true);
        setLoading(false);
        return;
      }
      // Always start a new signup session
      const { data, error: signUpError } = await supabase.auth.signUp({
        phone: e164Phone,
        password,
        options: { data: { full_name } }
      });
      if (signUpError) {
        setError(signUpError.message || 'Signup failed.');
        setShowErrorPopup(true);
        setLoading(false);
        return;
      }
      setForm((prev: any) => ({ ...prev, e164Phone }));
      setStep('otp');
      setLoading(false);
    } catch (e: any) {
      setError(e.message || 'Unexpected error.');
      setShowErrorPopup(true);
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const e164Phone = form.e164Phone;
      if (!e164Phone) {
        setError('Phone number missing for OTP verification.');
        setShowErrorPopup(true);
        setLoading(false);
        setStep('phone'); // force user to start over
        return;
      }
      const { data, error: otpError } = await supabase.auth.verifyOtp({
        phone: e164Phone,
        token: otp,
        type: 'sms'
      });
      if (otpError) {
        setError('Invalid OTP. Please try again.');
        setShowErrorPopup(true);
        setLoading(false);
        return;
      }
      // Insert into accounts table after OTP verified
      await insertAccount(e164Phone);
      setStep('phone'); // reset after signup
      if (userType === 'advisor') {
        setSuccess('Signup successful! Our Admin will contact you soon.');
        setLoading(false);
        setTimeout(() => {
          router.push('/'); // Redirect advisors to home page
        }, 1500);
      } else {
        setSuccess('Signup successful! You can now log in.');
        setLoading(false);
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      }
    } catch (e: any) {
      setError(e.message || 'OTP verification failed.');
      setShowErrorPopup(true);
      setLoading(false);
      setStep('phone');
    }
  };

  const insertAccount = async (e164Phone: string) => {
    let accountInsert;
    const { full_name, rate_per_minute_id, experience_years_id } = form;
    try {
      // Get current Supabase Auth user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated.');
        setShowErrorPopup(true);
        return;
      }
      if (userType === 'client') {
        accountInsert = await supabase.from('accounts').insert({
          phone: e164Phone,
          full_name,
          user_type_id: 1, // Client
          status: 'Approved',
          auth_user_id: user.id,
        }).select('account_id');
        if (accountInsert?.error) {
          if (accountInsert.error.message && accountInsert.error.message.includes('accounts_phone_key')) {
            setError('Mobile number already exists.');
          } else {
            setError(accountInsert.error.message);
          }
          setShowErrorPopup(true);
          return;
        }
      } else {
        const expertise_id = selectedExpertises.join(',');
        const language_id = selectedLanguages.join(',');
        accountInsert = await supabase.from('accounts').insert({
          phone: e164Phone,
          full_name,
          user_type_id: 2, // Advisor
          expertise_id,
          rate_per_minute_id,
          experience_years_id,
          language_id,
          status: 'Pending',
          auth_user_id: user.id,
        }).select('account_id');
        if (accountInsert?.error) {
          if (accountInsert.error.message && accountInsert.error.message.includes('accounts_phone_key')) {
            setError('Mobile number already exists.');
          } else {
            setError(accountInsert.error.message);
          }
          setShowErrorPopup(true);
          return;
        }
      }
    } catch (e: any) {
      setError(e.message || 'Account insert failed.');
      setShowErrorPopup(true);
    }
  };

  // If user reloads on OTP step, force them back to phone/password step
  useEffect(() => {
    if (step === 'otp' && (!form.phone || !form.password)) {
      setStep('phone');
    }
  }, [step, form.phone, form.password]);

  return (
    <section className="w-full max-w-lg mx-auto py-12 px-4 sm:px-8 overflow-y-auto max-h-[90vh]" aria-labelledby="phone-otp-signup-title">
      <h2 id="phone-otp-signup-title" className="text-2xl font-bold mb-6 text-center">Phone OTP Signup</h2>
      <div className="flex gap-2 mb-4 justify-center">
        <button
          type="button"
          className={`px-6 py-2 rounded-full font-semibold transition-all duration-150 shadow-sm border focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
            ${userType === 'client' ? 'bg-blue-600 text-white border-blue-600 scale-105' : 'bg-white text-neutral-700 border-neutral-300 hover:bg-blue-50'}`}
          aria-pressed={userType === 'client'}
          onClick={() => setUserType('client')}
        >
          Client
        </button>
        <button
          type="button"
          className={`px-6 py-2 rounded-full font-semibold transition-all duration-150 shadow-sm border focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
            ${userType === 'advisor' ? 'bg-blue-600 text-white border-blue-600 scale-105' : 'bg-white text-neutral-700 border-neutral-300 hover:bg-blue-50'}`}
          aria-pressed={userType === 'advisor'}
          onClick={() => setUserType('advisor')}
        >
          Advisor
        </button>
      </div>
      <form className="flex flex-col gap-4" action="#" method="post" autoComplete="on">
        <label className="text-sm font-medium" htmlFor="signup-name">Full Name</label>
        <input id="signup-name" name="full_name" type="text" className="p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" placeholder="Enter your name" onChange={handleInput} />
        <label className="text-sm font-medium" htmlFor="signup-phone">Phone Number</label>
        <input id="signup-phone" name="phone" type="text" className="p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" placeholder="Enter your phone number" onChange={handleInput} maxLength={10} />
        {phoneError && <div className="text-red-500 text-xs mb-2">{phoneError}</div>}
        <label className="text-sm font-medium" htmlFor="signup-password">Password</label>
        <input id="signup-password" name="password" type="password" className="p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" placeholder="Create a password" onChange={handleInput} />
        {userType === 'advisor' && (
          <>
            <label className="text-sm font-medium" htmlFor="signup-expertise">Expertise</label>
            <div className="mb-2 text-xs text-neutral-500">Select up to 2 areas of expertise.</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
              {expertises.map((ex: any) => (
                <label
                  key={ex.expertise_id}
                  className={`relative flex items-center px-4 py-3 rounded-lg border cursor-pointer transition-all duration-150 shadow-sm
                    ${selectedExpertises.includes(ex.expertise_id.toString()) ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300' : 'bg-white border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700'}
                    hover:shadow-md hover:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400`}
                  style={{ userSelect: 'none' }}
                >
                  <input
                    type="checkbox"
                    value={ex.expertise_id}
                    checked={selectedExpertises.includes(ex.expertise_id.toString())}
                    onChange={e => {
                      let newSelected = [...selectedExpertises];
                      if (e.target.checked) {
                        if (selectedExpertises.length >= 2) {
                          setExpertiseError('You Can Only Select Up To Two Expertise Fields.');
                          setShowErrorPopup(true);
                          return;
                        }
                        newSelected.push(ex.expertise_id.toString());
                      } else {
                        newSelected = newSelected.filter(id => id !== ex.expertise_id.toString());
                      }
                      setExpertiseError(null);
                      setSelectedExpertises(newSelected);
                      setForm({ ...form, expertise_id: newSelected.join(',') });
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 w-5 h-5 peer"
                    tabIndex={-1}
                  />
                  <span className="flex items-center">
                    <span className={`w-5 h-5 mr-3 flex items-center justify-center rounded border-2 transition-colors
                      ${selectedExpertises.includes(ex.expertise_id.toString()) ? 'bg-blue-500 border-blue-500' : 'bg-white border-neutral-300 dark:bg-neutral-700 dark:border-neutral-600'}`}
                    >
                      {selectedExpertises.includes(ex.expertise_id.toString()) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="font-medium text-sm text-neutral-800 dark:text-neutral-200">{ex.expertise_name}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="text-xs text-neutral-700 mb-2">Selected: {selectedExpertises.length}/2</div>
            {expertiseError && <div className="text-red-500 text-xs mb-2">{expertiseError}</div>}
            <label className="text-sm font-medium" htmlFor="signup-rate">Rate Per Minute</label>
            <select id="signup-rate" name="rate_per_minute_id" className="p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" onChange={handleInput}>
              <option value="">Select rate</option>
              {rates.map((r: any) => <option key={r.rate_per_minute_id} value={r.rate_per_minute_id}>{r.rate_value} rs for 1 minute</option>)}
            </select>
            <label className="text-sm font-medium" htmlFor="signup-experience">Years of Experience</label>
            <select id="signup-experience" name="experience_years_id" className="p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" onChange={handleInput}>
              <option value="">Select experience</option>
              {experiences.map((ex: any) => <option key={ex.experience_years_id} value={ex.experience_years_id}>{ex.description}</option>)}
            </select>
            <label className="text-sm font-medium" htmlFor="signup-language">Language</label>
            <div className="mb-2 text-xs text-neutral-500">Select up to 2 languages.</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
              {languages.map((l: any) => (
                <label
                  key={l.language_id}
                  className={`relative flex items-center px-4 py-3 rounded-lg border cursor-pointer transition-all duration-150 shadow-sm
                    ${selectedLanguages.includes(l.language_id.toString()) ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300' : 'bg-white border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700'}
                    hover:shadow-md hover:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400`}
                  style={{ userSelect: 'none' }}
                >
                  <input
                    type="checkbox"
                    value={l.language_id}
                    checked={selectedLanguages.includes(l.language_id.toString())}
                    onChange={e => {
                      let newSelected = [...selectedLanguages];
                      if (e.target.checked) {
                        if (selectedLanguages.length >= 2) {
                          setLanguageError('You Can Only Select Up To Two Languages.');
                          setShowErrorPopup(true);
                          return;
                        }
                        newSelected.push(l.language_id.toString());
                      } else {
                        newSelected = newSelected.filter(id => id !== l.language_id.toString());
                      }
                      setLanguageError(null);
                      setSelectedLanguages(newSelected);
                      setForm({ ...form, language_id: newSelected.join(',') });
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 w-5 h-5 peer"
                    tabIndex={-1}
                  />
                  <span className="flex items-center">
                    <span className={`w-5 h-5 mr-3 flex items-center justify-center rounded border-2 transition-colors
                      ${selectedLanguages.includes(l.language_id.toString()) ? 'bg-blue-500 border-blue-500' : 'bg-white border-neutral-300 dark:bg-neutral-700 dark:border-neutral-600'}`}
                    >
                      {selectedLanguages.includes(l.language_id.toString()) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="font-medium text-sm text-neutral-800 dark:text-neutral-200">{l.language_name}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="text-xs text-neutral-700 mb-2">Selected: {selectedLanguages.length}/2</div>
            {languageError && <div className="text-red-500 text-xs mb-2">{languageError}</div>}
          </>
        )}
        <button
          type="submit"
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          disabled={loading}
          onClick={async (e) => {
            if (loading) return;
            e.preventDefault();
            await handleSignup();
          }}
        >
          {loading ? 'Signing up...' : 'Signup'}
        </button>
        {success && <div className="text-green-500 text-sm mt-2">{success}</div>}
      </form>
      {/* Error Popup */}
      {showErrorPopup && error && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 border border-red-400 rounded-lg shadow-lg p-6 max-w-sm w-full">
            <div className="text-red-600 font-semibold mb-2">Error</div>
            <div className="text-neutral-800 dark:text-neutral-200 mb-4">{error}</div>
            <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded" onClick={() => setShowErrorPopup(false)}>Close</button>
          </div>
        </div>
      )}
      {step === 'otp' && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 border border-blue-400 rounded-lg shadow-lg p-6 max-w-sm w-full">
            <div className="text-blue-600 font-semibold mb-2">Verify Your Phone</div>
            <div className="text-neutral-800 dark:text-neutral-200 mb-4">
              Please enter the OTP sent to your phone number to verify your account.
            </div>
            <input
              type="text"
              className="w-full p-2 mb-4 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
              placeholder="Enter OTP"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              maxLength={6}
            />
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full" onClick={handleVerifyOtp} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
} 