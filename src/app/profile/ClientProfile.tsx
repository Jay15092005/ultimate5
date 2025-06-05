"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../../supabaseClient";
import Navbar from '../../components/Navbar';
import { useRouter } from "next/navigation";
import { Dialog } from '@headlessui/react';
import { useUser } from '@supabase/auth-helpers-react';

export default function ClientProfile() {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'calls' | 'wallet'>('profile');
  const [wallet, setWallet] = useState<number>(0);
  const [totalCalls, setTotalCalls] = useState<number>(0);
  const [calls, setCalls] = useState<any[]>([]);
  const [walletTxns, setWalletTxns] = useState<any[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [genders, setGenders] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callLoading, setCallLoading] = useState(false);
  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [agoraClient, setAgoraClient] = useState<any>(null);
  const [joined, setJoined] = useState(false);
  const [callTimeLeft, setCallTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const AGORA_APP_ID = 'a3b82070172d41e086e637b4c3cd3f6e'; // Replace with your App ID
  const router = useRouter();
  const [advisorDeclinedToast, setAdvisorDeclinedToast] = useState<string | null>(null);
  const [acceptedCall, setAcceptedCall] = useState<any | null>(null);
  const [acceptedCallModalOpen, setAcceptedCallModalOpen] = useState(false);
  const user = useUser();

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      setError(null);
      // Get user
      if (!user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }
      // Get account info
      const { data: account, error: accErr } = await supabase
        .from("accounts")
        .select("full_name, phone, email, state_id, city_id, gender_id, birth_date, bio, wallet, total_calls")
        .eq("auth_user_id", user.id)
        .single();
      if (accErr || !account) {
        setError("Account not found");
        setLoading(false);
        return;
      }
      setForm({
        full_name: account.full_name || "",
        phone: account.phone || "",
        email: account.email || "",
        state_id: account.state_id || "",
        city_id: account.city_id || "",
        gender_id: account.gender_id || "",
        birth_date: account.birth_date || "",
        bio: account.bio || "",
      });
      setWallet(account.wallet || 0);
      setTotalCalls(account.total_calls || 0);
      setLoading(false);
    }
    fetchProfile();
  }, [user]);

  // Fetch dropdowns for states, cities, genders
  useEffect(() => {
    async function fetchDropdowns() {
      const [statesRes, gendersRes] = await Promise.all([
        supabase.from('states').select('state_id, state_name'),
        supabase.from('genders').select('gender_id, gender_name'),
      ]);
      setStates(statesRes.data || []);
      setGenders(gendersRes.data || []);
    }
    fetchDropdowns();
  }, []);

  // Fetch cities for selected state
  useEffect(() => {
    async function fetchCities() {
      if (form.state_id) {
        const { data: citiesData } = await supabase
          .from('cities')
          .select('city_id, city_name')
          .eq('state_id', form.state_id);
        setCities(citiesData || []);
      } else {
        setCities([]);
      }
    }
    fetchCities();
  }, [form.state_id]);

  // Fetch My Calls for client
  useEffect(() => {
    if (activeTab === 'calls') {
      setCallsLoading(true);
      (async () => {
        if (!user) return;
        // Fetch client's account_id first
        const { data: account } = await supabase
          .from('accounts')
          .select('account_id')
          .eq('auth_user_id', user.id)
          .single();
        if (!account) {
          setCalls([]);
          setCallsLoading(false);
          return;
        }
        const { data: callsData, error: callsErr } = await supabase
          .from('calls')
          .select('*, advisor:accounts!calls_advisor_account_id_fkey(full_name)')
          .eq('client_account_id', account.account_id)
          .order('request_time', { ascending: false });
        if (!callsErr && callsData) setCalls(callsData);
        setCallsLoading(false);
      })();
    }
  }, [activeTab, user]);

  // Fetch My Wallet for client
  useEffect(() => {
    if (activeTab === 'wallet') {
      setWalletLoading(true);
      (async () => {
        if (!user) return;
        // Fetch client's account_id first
        const { data: account } = await supabase
          .from('accounts')
          .select('account_id, wallet')
          .eq('auth_user_id', user.id)
          .single();
        if (!account) {
          setWalletTxns([]);
          setWalletLoading(false);
          return;
        }
        setWallet(account.wallet || 0);
        const { data: txns, error: txnErr } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('account_id', account.account_id)
          .order('date_time', { ascending: false });
        if (!txnErr && txns) setWalletTxns(txns);
        setWalletLoading(false);
      })();
    }
  }, [activeTab, user]);

  // Listen for in_progress call_requests for this client
  useEffect(() => {
    let channel: any;
    let clientAccountId: number | null = null;
    (async () => {
      if (!user) return;
      // Get client's account_id
      const { data: account } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('auth_user_id', user.id)
        .single();
      if (!account) return;
      clientAccountId = account.account_id;
      // Listen for in_progress call_requests for this client
      channel = supabase
        .channel('client-call-inprogress')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_requests',
          filter: `client_id=eq.${clientAccountId}`
        }, (payload) => {
          const req = payload.new;
          if (req.status === 'in_progress') {
            setActiveCall(req);
          } else if (req.status === 'completed') {
            setActiveCall(null);
          }
        })
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  // When joined, start timer for call duration
  useEffect(() => {
    if (activeCall && joined) {
      setCallTimeLeft(activeCall.duration_minutes * 60); // seconds
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCallTimeLeft(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            // Auto-end call
            handleLeaveCall();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallTimeLeft(null);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall, joined]);

  // Real-time subscription for advisor_declined call_requests
  useEffect(() => {
    let channel: any;
    let clientAccountId: number | null = null;
    (async () => {
      if (!user) return;
      // Get client's account_id
      const { data: account } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('auth_user_id', user.id)
        .single();
      if (!account) return;
      clientAccountId = account.account_id;
      // Listen for advisor_declined call_requests for this client
      channel = supabase
        .channel('client-call-advisor-declined')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_requests',
          filter: `client_id=eq.${clientAccountId}`
        }, async (payload) => {
          const req = payload.new;
          if (req.status === 'advisor_declined') {
            // Fetch advisor name
            const { data: advisor } = await supabase
              .from('accounts')
              .select('full_name')
              .eq('account_id', req.advisor_id)
              .single();
            setAdvisorDeclinedToast(`${advisor?.full_name || 'Advisor'} declined your call request.`);
          }
        })
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  // Auto-dismiss advisorDeclinedToast after 2 seconds
  useEffect(() => {
    if (advisorDeclinedToast) {
      const timer = setTimeout(() => setAdvisorDeclinedToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [advisorDeclinedToast]);

  // Real-time subscription for advisor_accepted call_requests
  useEffect(() => {
    let channel: any;
    let clientAccountId: number | null = null;
    (async () => {
      if (!user) return;
      // Get client's account_id
      const { data: account } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('auth_user_id', user.id)
        .single();
      if (!account) return;
      clientAccountId = account.account_id;
      // Listen for advisor_accepted call_requests for this client
      channel = supabase
        .channel('client-call-advisor-accepted')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_requests',
          filter: `client_id=eq.${clientAccountId}`
        }, (payload) => {
          const req = payload.new;
          if (req.status === 'advisor_accepted') {
            setAcceptedCall(req);
            setAcceptedCallModalOpen(true);
          }
        })
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  // Handle input changes
  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev: any) => ({ ...prev, [name]: value }));
  };

  // Handle save (for client profile)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    const { email, state_id, city_id, gender_id, birth_date, bio } = form;
    if (!user) {
      setError("Not logged in");
      setSaving(false);
      return;
    }
    // Only update the fields that are present in the form (allow empty values)
    const updateFields: any = {
      email: email || null,
      state_id: state_id || null,
      city_id: city_id || null,
      gender_id: gender_id || null,
      birth_date: birth_date || null,
      bio: bio || null,
    };
    const { error: updateErr } = await supabase
      .from("accounts")
      .update(updateFields)
      .eq("auth_user_id", user.id);
    if (updateErr) {
      setError("Failed to update profile");
      setSaving(false);
      return;
    }
    setSuccess("Profile updated successfully");
    setSaving(false);
  };

  // Extract leave call logic to a function
  const handleLeaveCall = async () => {
    if (agoraClient) {
      // Remove all event listeners
      agoraClient.removeAllListeners && agoraClient.removeAllListeners();
      await agoraClient.leave();
      setJoined(false);
      setAgoraClient(null);
    }
    if (activeCall) {
      await supabase
        .from('accounts')
        .update({ status: 'Available' })
        .in('account_id', [activeCall.advisor_id, activeCall.client_id]);
      await supabase
        .from('call_requests')
        .update({ status: 'completed' })
        .eq('id', activeCall.id);
      setActiveCall(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  // Layout: Sidebar + Main Content (pixel-perfect like advisor)
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-blue-50 dark:from-neutral-900 dark:to-blue-950 flex flex-col">
      <Navbar />
      <div className="px-4 pt-6">
        <button
          onClick={() => router.back()}
          className="mb-6 px-5 py-2 rounded-full border border-blue-600 text-blue-700 dark:text-blue-300 font-medium bg-white dark:bg-neutral-900 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          aria-label="Go back"
        >
          ← Go Back
        </button>
      </div>
      <div className="min-h-screen flex flex-col md:flex-row items-stretch justify-center py-12">
        {/* Sidebar */}
        <aside className="w-full md:w-96 bg-white rounded-3xl shadow-xl p-12 flex flex-col items-center mb-8 md:mb-0 md:mr-10">
          {/* Avatar */}
          <div className="relative flex flex-col items-center justify-center mb-6">
            <div className="relative w-40 h-40 rounded-full border-8 border-white shadow-xl flex items-center justify-center bg-gradient-to-tr from-blue-500 to-purple-500">
              {form.full_name ? (
                <span className="text-6xl font-extrabold text-white select-none">
                  {form.full_name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <span className="text-6xl font-extrabold text-white select-none">?</span>
              )}
            </div>
          </div>
          {/* Name, centered and bold */}
          <div className="text-4xl font-extrabold text-gray-900 mb-2 text-center" style={{fontFamily:'Georgia,serif'}}>{form.full_name || '-'}</div>
          <div className="text-2xl text-gray-500 text-center mb-8" style={{fontFamily:'Georgia,serif'}}>Client</div>
          <nav className="w-full flex flex-col gap-2">
            <button className={`text-left px-4 py-2 rounded-lg font-medium transition-colors ${activeTab==='profile' ? 'bg-gray-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`} onClick={()=>setActiveTab('profile')}>Profile</button>
            <button className={`text-left px-4 py-2 rounded-lg font-medium transition-colors ${activeTab==='calls' ? 'bg-gray-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`} onClick={()=>setActiveTab('calls')}>My Calls</button>
            <button className={`text-left px-4 py-2 rounded-lg font-medium transition-colors ${activeTab==='wallet' ? 'bg-gray-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`} onClick={()=>setActiveTab('wallet')}>My Wallet</button>
          </nav>
        </aside>
        {/* Main Content */}
        <main className="flex-1 w-full max-w-2xl bg-white rounded-xl shadow-md p-10">
          {/* Wallet/Calls Summary */}
          <div className="flex gap-6 mb-8">
            <div className="flex-1 bg-white rounded-lg shadow px-6 py-6 text-center">
              <div className="text-xs text-gray-500 mb-1">Wallet Balance</div>
              <div className="text-2xl font-bold text-gray-900">₹{wallet.toFixed(2)}</div>
            </div>
            <div className="flex-1 bg-white rounded-lg shadow px-6 py-6 text-center">
              <div className="text-xs text-gray-500 mb-1">Total Calls</div>
              <div className="text-2xl font-bold text-gray-900">{totalCalls}</div>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex border-b mb-8 gap-8">
            <button className={`pb-2 font-semibold transition-colors border-b-2 ${activeTab==='profile' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-700 hover:text-blue-600'}`} onClick={()=>setActiveTab('profile')}>Basic Info</button>
            <button className={`pb-2 font-semibold transition-colors border-b-2 ${activeTab==='calls' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-700 hover:text-blue-600'}`} onClick={()=>setActiveTab('calls')}>My Calls</button>
            <button className={`pb-2 font-semibold transition-colors border-b-2 ${activeTab==='wallet' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-700 hover:text-blue-600'}`} onClick={()=>setActiveTab('wallet')}>My Wallet</button>
          </div>
          {/* Tab Content */}
          {activeTab === 'profile' && (
            <form className="grid grid-cols-1 gap-6" onSubmit={handleSave}>
              {/* Full Name (read-only) */}
              <div className="flex flex-col">
                <label className="font-semibold mb-1 text-gray-900">Full Name</label>
                <input type="text" value={form.full_name} readOnly className="p-3 rounded-lg border border-neutral-200 bg-gray-100 text-gray-900 cursor-not-allowed" />
              </div>
              {/* Email (editable) */}
              <div className="flex flex-col">
                <label className="font-semibold mb-1 text-gray-900">Email</label>
                <input type="email" name="email" value={form.email} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="flex flex-col">
                <label className="font-semibold mb-1 text-gray-900">State</label>
                <select name="state_id" value={form.state_id} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200">
                  <option value="">Select State</option>
                  {states.map((s: any) => <option key={s.state_id} value={s.state_id}>{s.state_name}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="font-semibold mb-1 text-gray-900">City</label>
                <select name="city_id" value={form.city_id} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200">
                  <option value="">Select City</option>
                  {cities.map((c: any) => <option key={c.city_id} value={c.city_id}>{c.city_name}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="font-semibold mb-1 text-gray-900">Gender</label>
                <select name="gender_id" value={form.gender_id} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200">
                  <option value="">Select Gender</option>
                  {genders.map((g: any) => <option key={g.gender_id} value={g.gender_id}>{g.gender_name}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="font-semibold mb-1 text-gray-900">Birthdate</label>
                <input type="date" name="birth_date" value={form.birth_date} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="flex flex-col">
                <label className="font-semibold mb-1 text-gray-900">Bio</label>
                <textarea name="bio" value={form.bio} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" maxLength={1000} />
              </div>
              {error && <div className="text-red-500 text-center text-sm">{error}</div>}
              {success && <div className="text-green-600 text-center text-sm">{success}</div>}
              <div className="flex justify-end">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg shadow transition disabled:opacity-60" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
          {activeTab === 'calls' && (
            <div>
              {callsLoading ? (
                <div>Loading calls...</div>
              ) : (
                <div className="space-y-4">
                  {calls.length === 0 ? <div>No calls found.</div> : calls.map(call => (
                    <div key={call.call_id} className="border rounded p-4 bg-white shadow-sm">
                      <div className="font-semibold text-gray-900">Advisor: {call.advisor?.full_name || '-'}</div>
                      <div className="text-gray-900">Date: {call.request_time ? new Date(call.request_time).toLocaleString() : '-'}</div>
                      <div className="text-gray-900">Duration: {call.duration_minutes} min</div>
                      <div className="text-gray-900">Status: {call.call_status}</div>
                      <div className="text-gray-900">Charge: ₹{call.call_total_charge}</div>
                      <div className="text-gray-900">Remark: {call.remark || '-'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'wallet' && (
            <div>
              {walletLoading ? (
                <div>Loading wallet transactions...</div>
              ) : (
                <div className="space-y-4">
                  <div className="font-bold mb-4 text-2xl text-blue-700 flex items-center gap-2">
                    <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /></svg>
                    Wallet Balance: <span className="ml-2 text-emerald-600">₹{wallet.toFixed(2)}</span>
                  </div>
                  {walletTxns.length === 0 ? (
                    <div className="text-gray-500 text-center">No transactions found.</div>
                  ) : walletTxns.map(txn => (
                    <div
                      key={txn.transaction_id}
                      className={`rounded-2xl shadow-md p-5 flex items-center gap-6 border-l-8 ${txn.credit > 0 ? 'border-green-400 bg-green-50/80' : 'border-red-400 bg-red-50/80'} transition-all`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        {txn.credit > 0 ? (
                          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        ) : (
                          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="text-xs text-gray-500">{txn.date_time ? new Date(txn.date_time).toLocaleString() : '-'}</div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-lg ${txn.credit > 0 ? 'text-green-700' : 'text-red-700'}`}>{txn.credit > 0 ? `+₹${txn.credit}` : `-₹${txn.debit}`}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide" style={{ background: txn.credit > 0 ? '#bbf7d0' : '#fecaca', color: txn.credit > 0 ? '#166534' : '#991b1b' }}>{txn.credit > 0 ? 'Credit' : 'Debit'}</span>
                        </div>
                        {txn.remark && <div className="text-sm text-gray-700 truncate">{txn.remark}</div>}
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-gray-500">Balance</span>
                        <span className="font-bold text-blue-700 text-lg">₹{txn.balance}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      {/* Agora Call Modal for Client */}
      {activeCall && (
        <Dialog open={!!activeCall} onClose={() => {}} className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
            <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-md w-full mx-auto p-8 z-10">
              <h3 className="text-xl font-bold mb-4">In Call with Advisor</h3>
              <div className="mb-4 text-base">
                <div><b>Channel:</b> <span className="font-mono">{activeCall.channel_name}</span></div>
                <div><b>Duration:</b> {activeCall.duration_minutes} min</div>
                {joined && callTimeLeft !== null && (
                  <div className="text-lg font-bold text-blue-700">Time Left: {Math.floor(callTimeLeft/60).toString().padStart(2,'0')}:{(callTimeLeft%60).toString().padStart(2,'0')}</div>
                )}
              </div>
              {!joined ? (
                <button
                  className="w-full py-2 rounded bg-green-600 text-white font-semibold mb-2"
                  onClick={async () => {
                    const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
                    const token = activeCall.client_token;
                    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
                    setAgoraClient(client);
                    await client.join(AGORA_APP_ID, activeCall.channel_name, token, activeCall.client_id);
                    const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                    await client.publish([localAudioTrack]);
                    setJoined(true);
                  }}
                >
                  Join Call
                </button>
              ) : (
                <button
                  className="w-full py-2 rounded bg-red-600 text-white font-semibold mb-2"
                  onClick={handleLeaveCall}
                >
                  Leave Call
                </button>
              )}
            </div>
          </div>
        </Dialog>
      )}
      {advisorDeclinedToast && (
        <div
          className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 min-w-[320px] max-w-[90vw] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl font-semibold text-base transition-all duration-300 animate-fade-in bg-gradient-to-r from-red-500 to-rose-400 text-white"
          style={{ boxShadow: '0 8px 32px 0 rgba(239,68,68,0.15)' }}
          role="alert"
          aria-live="polite"
        >
          <span className="text-2xl">❌</span>
          <span className="flex-1">{advisorDeclinedToast}</span>
        </div>
      )}
      {acceptedCall && acceptedCallModalOpen && (
        <Dialog open={acceptedCallModalOpen} onClose={() => setAcceptedCallModalOpen(false)} className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
            <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-md w-full mx-auto p-8 z-10">
              <h3 className="text-xl font-bold mb-4">Advisor Accepted Your Call</h3>
              <div className="mb-4 text-base">
                <div><b>Channel:</b> <span className="font-mono">{acceptedCall.channel_name}</span></div>
                <div><b>Duration:</b> {acceptedCall.duration_minutes} min</div>
              </div>
              <button
                className="w-full py-2 rounded bg-green-600 text-white font-semibold mb-2"
                onClick={async () => {
                  const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
                  const token = acceptedCall.client_token;
                  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
                  setAgoraClient(client);
                  await client.join(AGORA_APP_ID, acceptedCall.channel_name, token, acceptedCall.client_id);
                  const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                  await client.publish([localAudioTrack]);
                  setJoined(true);
                  setActiveCall(acceptedCall);
                  setAcceptedCallModalOpen(false);
                  setAcceptedCall(null);
                  await supabase
                    .from('call_requests')
                    .update({ status: 'in_progress' })
                    .eq('id', acceptedCall.id);
                }}
              >
                Join Call
              </button>
              <button
                className="w-full py-2 rounded bg-red-600 text-white font-semibold mt-2"
                onClick={async () => {
                  // Decline after advisor accepted
                  await supabase
                    .from('call_requests')
                    .update({ status: 'declined' })
                    .eq('id', acceptedCall.id);
                  setAcceptedCallModalOpen(false);
                  setAcceptedCall(null);
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
} 