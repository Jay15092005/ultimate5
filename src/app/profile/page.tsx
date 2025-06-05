"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";
import ClientProfile from "./ClientProfile";
import Navbar from '../../components/Navbar';
import { Dialog } from '@headlessui/react';
import { useUser } from '@supabase/auth-helpers-react';

export default function ProfilePage() {
  const router = useRouter();
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [genders, setGenders] = useState<any[]>([]);
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [wallet, setWallet] = useState<number>(0);
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [totalCalls, setTotalCalls] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'basic' | 'calls' | 'wallet'>('basic');
  const [calls, setCalls] = useState<any[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [walletTxns, setWalletTxns] = useState<any[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [callsLoaded, setCallsLoaded] = useState(false);
  const [walletLoaded, setWalletLoaded] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [expertise, setExpertise] = useState<string>("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [rates, setRates] = useState<any[]>([]);
  const [experiences, setExperiences] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [userType, setUserType] = useState<number | null>(null);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callLoading, setCallLoading] = useState(false);
  const [declinedToast, setDeclinedToast] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [agoraClient, setAgoraClient] = useState<any>(null);
  const [joined, setJoined] = useState(false);
  const [callTimeLeft, setCallTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const AGORA_APP_ID = 'a3b82070172d41e086e637b4c3cd3f6e'; // Replace with your App ID
  const [callRequestTimer, setCallRequestTimer] = useState<number>(20);
  const callRequestTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [callStartTriggered, setCallStartTriggered] = useState(false);

  // Required fields for completion
  const requiredFields = [
    "full_name", "email", "profile_pic", "state_id", "city_id", "gender_id", "advisor_phone_number", "birth_date", "bio"
  ];

  useEffect(() => {
    async function fetchUserType() {
      setLoading(true);
      setError(null);
      if (!user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }
      const { data: account, error: accErr } = await supabase
        .from("accounts")
        .select("user_type_id")
        .eq("auth_user_id", user.id)
        .single();
      if (accErr || !account) {
        setError("Account not found");
        setLoading(false);
        return;
      }
      setUserType(account.user_type_id);
      setLoading(false);
    }
    fetchUserType();
  }, [user]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      if (!user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }
      const { data: account, error: accErr } = await supabase
        .from("accounts")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();
      if (accErr || !account) {
        setError("Account not found");
        setLoading(false);
        return;
      }
      setForm({
        full_name: account.full_name || "",
        email: account.email || "",
        state_id: account.state_id || "",
        city_id: account.city_id || "",
        gender_id: account.gender_id || "",
        advisor_phone_number: account.advisor_phone_number ? account.advisor_phone_number.replace('+91','') : "",
        birth_date: account.birth_date || "",
        bio: account.bio || "",
        profile_pic: account.profile_pic || "",
        rate_per_minute_id: account.rate_per_minute_id || "",
        experience_years_id: account.experience_years_id || "",
      });
      setProfilePicUrl(account.profile_pic || null);
      setWallet(account.wallet || 0);
      setFullName(account.full_name || "");
      setEmail(account.email || "");
      setPhone(account.phone ? account.phone.replace('+91','') : "");
      setTotalCalls(account.total_calls || 0);
      setAvatar(account.profile_pic || null);
      // Fetch expertise name(s) if expertise_id exists
      let expertiseName = "Advisor";
      if (account.expertise_id) {
        const expertiseIds = account.expertise_id.split(',').map((id: string) => id.trim()).filter(Boolean);
        if (expertiseIds.length > 0) {
          const { data: expertises, error: expErr } = await supabase
            .from("expertises")
            .select("expertise_name")
            .in("expertise_id", expertiseIds);
          if (!expErr && expertises && expertises.length > 0) {
            expertiseName = expertises.map(e => e.expertise_name).join(", ");
          }
        }
      }
      setExpertise(expertiseName);
      // Fetch dropdowns
      const [statesRes, gendersRes, ratesRes, expYearsRes] = await Promise.all([
        supabase.from("states").select("state_id,state_name"),
        supabase.from("genders").select("gender_id,gender_name"),
        supabase.from("rates_per_minute").select("rate_per_minute_id,rate_value"),
        supabase.from("experience_years").select("experience_years_id,years_value,description")
      ]);
      setStates(statesRes.data || []);
      setGenders(gendersRes.data || []);
      setRates(ratesRes.data || []);
      setExperiences(expYearsRes.data || []);
      // Fetch cities for selected state
      if (account.state_id) {
        const { data: citiesData } = await supabase
          .from("cities")
          .select("city_id,city_name")
          .eq("state_id", account.state_id);
        setCities(citiesData || []);
      }
      setLoading(false);
    }
    fetchData();
  }, [user]);

  // Recalculate missingFields every time form changes
  useEffect(() => {
    const missing = requiredFields.filter(f => !form[f] || (f === 'profile_pic' && !form.profile_pic));
    setMissingFields(missing);
  }, [form]);

  useEffect(() => {
    async function fetchCities() {
      if (form.state_id) {
        const { data: citiesData } = await supabase
          .from("cities")
          .select("city_id,city_name")
          .eq("state_id", form.state_id);
        setCities(citiesData || []);
      }
    }
    fetchCities();
  }, [form.state_id]);

  // Lazy load My Calls
  useEffect(() => {
    if (activeTab === 'calls' && !callsLoaded) {
      setCallsLoading(true);
      (async () => {
        if (!user) return;
        // Fetch advisor's account_id first
        const { data: account } = await supabase
          .from('accounts')
          .select('account_id')
          .eq('auth_user_id', user.id)
          .single();
        if (!account) {
          setCalls([]);
          setCallsLoading(false);
          setCallsLoaded(true);
          return;
        }
        const { data: callsData, error: callsErr } = await supabase
          .from('calls')
          .select('*, client:accounts!calls_client_account_id_fkey(full_name)')
          .eq('advisor_account_id', account.account_id)
          .order('request_time', { ascending: false });
        if (!callsErr && callsData) setCalls(callsData);
        setCallsLoading(false);
        setCallsLoaded(true);
      })();
    }
  }, [activeTab, callsLoaded, user]);

  // Lazy load My Wallet
  useEffect(() => {
    if (activeTab === 'wallet' && !walletLoaded) {
      setWalletLoading(true);
      (async () => {
        if (!user) return;
        // Fetch advisor's account_id first
        const { data: account } = await supabase
          .from('accounts')
          .select('account_id, wallet')
          .eq('auth_user_id', user.id)
          .single();
        if (!account) {
          setWalletTxns([]);
          setWalletLoading(false);
          setWalletLoaded(true);
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
        setWalletLoaded(true);
      })();
    }
  }, [activeTab, walletLoaded, user]);

  // Real-time subscription for advisors to call_requests
  useEffect(() => {
    let channel: any;
    let advisorAccountId: number | null = null;
    (async () => {
      if (!user) return;
      // Get advisor's account_id
      const { data: account } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('auth_user_id', user.id)
        .single();
      if (!account) return;
      advisorAccountId = account.account_id;
      // Listen for new call_requests for this advisor
      channel = supabase
        .channel('advisor-call-requests')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'call_requests',
          filter: `advisor_id=eq.${advisorAccountId}`
        }, (payload) => {
          const req = payload.new;
          if (req.status === 'pending') {
            setIncomingCall(req);
            setCallModalOpen(true);
          }
        })
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  // Real-time subscription for advisors to declined call_requests
  useEffect(() => {
    let channel: any;
    let advisorAccountId: number | null = null;
    (async () => {
      if (!user) return;
      // Get advisor's account_id
      const { data: account } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('auth_user_id', user.id)
        .single();
      if (!account) return;
      advisorAccountId = account.account_id;
      // Listen for declined call_requests for this advisor
      channel = supabase
        .channel('advisor-call-declined')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_requests',
          filter: `advisor_id=eq.${advisorAccountId}`
        }, (payload) => {
          const req = payload.new;
          if (req.status === 'declined') {
            setDeclinedToast('The client declined your call request.');
          }
        })
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  // Listen for in_progress call_requests for this advisor
  useEffect(() => {
    let channel: any;
    let advisorAccountId: number | null = null;
    (async () => {
      if (!user) return;
      // Get advisor's account_id
      const { data: account } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('auth_user_id', user.id)
        .single();
      if (!account) return;
      advisorAccountId = account.account_id;
      // Listen for in_progress call_requests for this advisor
      channel = supabase
        .channel('advisor-call-inprogress')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_requests',
          filter: `advisor_id=eq.${advisorAccountId}`
        }, async (payload) => {
          const req = payload.new;
          if (req.status === 'in_progress') {
            setActiveCall(req);
            // Call /api/call-start only once per call
            if (!callStartTriggered) {
              setCallStartTriggered(true);
              const res = await fetch('/api/call-start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ call_request_id: req.id })
              });
              if (!res.ok) {
                const { error } = await res.json();
                setDeclinedToast(error || 'Failed to start call billing.');
              }
            }
          } else if (req.status === 'completed') {
            setActiveCall(null);
            setCallStartTriggered(false);
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
            handleLeaveCall('auto');
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

  // Start timer when callModalOpen and incomingCall are set
  useEffect(() => {
    if (callModalOpen && incomingCall) {
      setCallRequestTimer(20);
      if (callRequestTimerRef.current) clearInterval(callRequestTimerRef.current);
      callRequestTimerRef.current = setInterval(() => {
        setCallRequestTimer(prev => {
          if (prev <= 1) {
            // Auto-decline if not accepted in 20s
            if (incomingCall) {
              supabase
                .from('call_requests')
                .update({ status: 'advisor_declined' })
                .eq('id', incomingCall.id);
            }
            setCallModalOpen(false);
            setIncomingCall(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (callRequestTimerRef.current) clearInterval(callRequestTimerRef.current);
    }
    return () => {
      if (callRequestTimerRef.current) clearInterval(callRequestTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callModalOpen, incomingCall]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let { name, value } = e.target;
    if (name === "advisor_phone_number") {
      value = value.replace(/\D/g, "").slice(0, 10);
    }
    setForm({ ...form, [name]: value });
  };

  const handleProfilePic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        setError("Profile picture must be less than 500KB");
        return;
      }
      setProfilePicFile(file);
      setProfilePicUrl(URL.createObjectURL(file));
      // Mark as pending so required field logic passes
      setForm((prev: any) => ({ ...prev, profile_pic: 'pending' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    if (!user) {
      setError("Not logged in");
      setSaving(false);
      return;
    }

    // Validate required fields
    for (const field of missingFields) {
      if (!form[field]) {
        setError("Please fill all required fields.");
        setSaving(false);
        return;
      }
    }
    if (form.bio && form.bio.length > 1000) {
      setError("Bio must be less than 1000 characters.");
      setSaving(false);
      return;
    }

    // Upload profile picture if changed
    let profilePicUrlToSave = form.profile_pic;
    if (profilePicFile) {
      const fileExt = profilePicFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('profile-pics')
        .upload(filePath, profilePicFile, { upsert: true });
      if (error) {
        setError("Failed to upload profile picture.");
        setSaving(false);
        return;
      }
      profilePicUrlToSave = supabase.storage.from('profile-pics').getPublicUrl(filePath).data.publicUrl;
      // Set form.profile_pic to the public URL so required logic passes
      setForm((prev: any) => ({ ...prev, profile_pic: profilePicUrlToSave }));
    }

    // Update advisor profile by auth_user_id
    const { error: updateError } = await supabase
      .from("accounts")
      .update({
        ...form,
        email: form.email,
        profile_pic: profilePicUrlToSave,
        advisor_phone_number: `+91${form.advisor_phone_number}`,
        profile_complete: true
      })
      .eq("auth_user_id", user.id);
    if (updateError) {
      setError("Failed to update profile. " + updateError.message);
      setSaving(false);
      return;
    }
    setSuccess("Profile completed successfully!");
    setSaving(false);
    setTimeout(() => {
      router.refresh();
    }, 1000);
  };

  // Handle profile picture upload
  const handlePlusClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      setError("Profile picture must be less than 500KB");
      return;
    }
    // Get user for upload path
    if (!user) {
      setError("Not logged in");
      return;
    }
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('profile-pics')
      .upload(filePath, file, { upsert: true });
    if (uploadError) {
      setError("Failed to upload profile picture.");
      return;
    }
    const publicUrl = supabase.storage.from('profile-pics').getPublicUrl(filePath).data.publicUrl;
    setAvatar(publicUrl);
    setProfilePicUrl(publicUrl);
    setForm((prev: any) => ({ ...prev, profile_pic: publicUrl }));
    // Update in DB
    await supabase.from('accounts').update({ profile_pic: publicUrl }).eq('auth_user_id', user.id);
  };

  // Auto-dismiss declined toast after 2 seconds
  useEffect(() => {
    if (declinedToast) {
      const timer = setTimeout(() => setDeclinedToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [declinedToast]);

  // Extract leave call logic to a function
  const handleLeaveCall = async (reason = 'ended') => {
    if (agoraClient) {
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
      // Update calls.remark based on reason
      let remark = '';
      if (reason === 'advisor') remark = 'Call ended by advisor';
      else if (reason === 'client') remark = 'Call ended by client';
      else if (reason === 'auto') remark = 'Call auto-ended (timer)';
      else if (reason === 'error') remark = 'Call ended due to error';
      else remark = 'Call ended';
      // Find the call row for this call_request (by channel_name, advisor_id, client_id, and in_progress/completed)
      const { data: callRow } = await supabase
        .from('calls')
        .select('call_id')
        .eq('advisor_account_id', activeCall.advisor_id)
        .eq('client_account_id', activeCall.client_id)
        .order('start_time', { ascending: false })
        .limit(1)
        .single();
      if (callRow) {
        await supabase
          .from('calls')
          .update({ remark })
          .eq('call_id', callRow.call_id);
      }
      setActiveCall(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (error) return <div className="flex items-center justify-center h-screen text-red-500">{error}</div>;

  // If client, render the new ClientProfile component
  if (userType !== 2) {
    return <ClientProfile />;
  }

  // Otherwise, render the existing advisor profile page (unchanged)
  // --- UI ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-blue-50 dark:from-neutral-900 dark:to-blue-950 flex flex-col">
      <Navbar />
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row items-stretch justify-center py-12">
      {/* Sidebar */}
      <aside className="w-full md:w-96 bg-white rounded-3xl shadow-xl p-12 flex flex-col items-center mb-8 md:mb-0 md:mr-10">
        {/* Pixel-perfect avatar container */}
        <div className="relative flex flex-col items-center justify-center mb-6">
          <div className="relative w-40 h-40 rounded-full border-8 border-white shadow-xl flex items-center justify-center bg-gradient-to-tr from-blue-500 to-purple-500">
            {avatar ? (
              <img src={avatar} alt="Profile" className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-6xl font-extrabold text-white select-none">
                {fullName ? fullName.charAt(0).toUpperCase() : '?'}
              </span>
            )}
            {/* Floating (+) button, pixel-perfect */}
            <button
              className="absolute -bottom-5 -right-5 w-14 h-14 rounded-full border-4 border-white bg-gradient-to-tr from-blue-500 to-purple-500 shadow-xl flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400 z-10"
              onClick={handlePlusClick}
              type="button"
              aria-label="Upload profile picture"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="12" fill="none" />
                <path d="M12 7v10M7 12h10" stroke="white" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleProfilePicUpload}
              className="hidden"
            />
          </div>
        </div>
        {/* Name and expertise, centered and bold */}
        <div className="text-4xl font-extrabold text-gray-900 mb-2 text-center" style={{fontFamily:'Georgia,serif'}}>{fullName || '-'}</div>
        <div className="text-2xl text-gray-500 text-center mb-8" style={{fontFamily:'Georgia,serif'}}>{expertise || 'Advisor'}</div>
        <nav className="w-full flex flex-col gap-2">
          <button className={`text-left px-4 py-2 rounded-lg font-medium transition-colors ${activeTab==='basic' ? 'bg-gray-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`} onClick={()=>setActiveTab('basic')}>Profile</button>
          <button className={`text-left px-4 py-2 rounded-lg font-medium transition-colors ${activeTab==='calls' ? 'bg-gray-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`} onClick={()=>setActiveTab('calls')}>My Calls</button>
          <button className={`text-left px-4 py-2 rounded-lg font-medium transition-colors ${activeTab==='wallet' ? 'bg-gray-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`} onClick={()=>setActiveTab('wallet')}>My Wallet</button>
        </nav>
      </aside>
      {/* Main Content */}
      <main className="flex-1 w-full max-w-2xl bg-white rounded-xl shadow-md p-10">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Your Profile</h2>
        {/* Modern Welcome Banner */}
        <div className="mb-8 p-5 rounded-2xl bg-blue-50 border border-blue-100 shadow flex flex-col sm:flex-row items-center gap-4">
          <span className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <span>Welcome,</span>
            <span className="text-2xl font-extrabold text-blue-700">{fullName || '-'}</span>
            <span className="hidden sm:inline">!</span>
          </span>
          <span className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-base text-gray-600 font-medium">
            <span className="flex items-center gap-1">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm0 10a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2zm10-10a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zm0 10a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              <span className="font-normal text-gray-700">{phone ? `+91 ${phone}` : '-'}</span>
            </span>
          </span>
        </div>
        {/* Wallet/Calls/Experience/Rate Summary */}
        <div className="flex gap-6 mb-8">
          <div className="flex-1 bg-white rounded-lg shadow px-6 py-6 text-center">
            <div className="text-xs text-gray-500 mb-1">Wallet Balance</div>
            <div className="text-2xl font-bold text-gray-900">₹{wallet.toFixed(2)}</div>
          </div>
          <div className="flex-1 bg-white rounded-lg shadow px-6 py-6 text-center">
            <div className="text-xs text-gray-500 mb-1">Total Calls</div>
            <div className="text-2xl font-bold text-gray-900">{totalCalls}</div>
          </div>
          <div className="flex-1 bg-white rounded-lg shadow px-6 py-6 text-center">
            <div className="text-xs text-gray-500 mb-1">Experience</div>
            <div className="text-2xl font-bold text-gray-900">
              {(() => {
                const exp = experiences.find((e: any) => String(e.experience_years_id) === String(form.experience_years_id));
                return exp ? exp.description || `${exp.years_value} Years` : '-';
              })()}
            </div>
          </div>
          <div className="flex-1 bg-white rounded-lg shadow px-6 py-6 text-center">
            <div className="text-xs text-gray-500 mb-1">Rate per Minute</div>
            <select
              name="rate_per_minute_id"
              value={form.rate_per_minute_id || ''}
              onChange={handleInput}
              className="text-2xl font-bold text-gray-900 bg-white border-none outline-none text-center w-full"
              style={{ appearance: 'none' }}
            >
              <option value="">Select</option>
              {rates.map((r: any) => (
                <option key={r.rate_per_minute_id} value={r.rate_per_minute_id}>{r.rate_value} rs/min</option>
              ))}
            </select>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex border-b mb-8 gap-8">
          <button className={`pb-2 font-semibold transition-colors border-b-2 ${activeTab==='basic' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-700 hover:text-blue-600'}`} onClick={()=>setActiveTab('basic')}>Basic Info</button>
          <button className={`pb-2 font-semibold transition-colors border-b-2 ${activeTab==='calls' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-700 hover:text-blue-600'}`} onClick={()=>setActiveTab('calls')}>My Calls</button>
          <button className={`pb-2 font-semibold transition-colors border-b-2 ${activeTab==='wallet' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-700 hover:text-blue-600'}`} onClick={()=>setActiveTab('wallet')}>My Wallet</button>
        </div>
        {/* Tab Content */}
        {activeTab === 'basic' && (
          <form className="grid grid-cols-1 gap-6" onSubmit={handleSubmit}>
            {/* Full Name (read-only) */}
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-900">Full Name <span className="text-red-500">*</span></label>
              <input type="text" name="full_name" value={form.full_name || ''} readOnly className="p-3 rounded-lg border border-neutral-200 bg-gray-100 text-gray-900 cursor-not-allowed" />
            </div>
            {/* Email (editable) */}
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-900">Email</label>
              <input type="email" name="email" value={form.email || ''} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-900">State</label>
              <select name="state_id" value={form.state_id || ''} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="">Select State</option>
                {states.map((s: any) => <option key={s.state_id} value={s.state_id}>{s.state_name}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-900">City</label>
              <select name="city_id" value={form.city_id || ''} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="">Select City</option>
                {cities.map((c: any) => <option key={c.city_id} value={c.city_id}>{c.city_name}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-900">Gender</label>
              <select name="gender_id" value={form.gender_id || ''} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="">Select Gender</option>
                {genders.map((g: any) => <option key={g.gender_id} value={g.gender_id}>{g.gender_name}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-900">Google Pay Number</label>
              <input type="text" name="advisor_phone_number" value={form.advisor_phone_number || ''} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" maxLength={10} />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-900">Birthdate</label>
              <input type="date" name="birth_date" value={form.birth_date || ''} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-900">Bio</label>
              <textarea name="bio" value={form.bio || ''} onChange={handleInput} className="p-3 rounded-lg border border-neutral-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" maxLength={1000} placeholder="Tell us about yourself" />
            </div>
            {/* Experience (read-only) */}
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-900">Experience</label>
              <input type="text" name="experience_years_id" value={(() => {
                const exp = experiences.find((e: any) => String(e.experience_years_id) === String(form.experience_years_id));
                return exp ? exp.description || `${exp.years_value} Years` : '';
              })()} readOnly className="p-3 rounded-lg border border-neutral-200 bg-gray-100 text-gray-900 cursor-not-allowed" />
            </div>
            {/* Rate per Minute (editable) */}
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-900">Rate per Minute</label>
              <select
                name="rate_per_minute_id"
                value={form.rate_per_minute_id || ''}
                onChange={handleInput}
                className="p-3 rounded-lg border border-neutral-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Select rate</option>
                {rates.map((r: any) => (
                  <option key={r.rate_per_minute_id} value={r.rate_per_minute_id}>{r.rate_value} rs/min</option>
                ))}
              </select>
            </div>
            {activeTab === 'basic' && missingFields.length > 0 && (
              <div className="mb-6 p-4 rounded-lg border border-red-300 bg-red-50 text-red-800 flex items-start gap-3 shadow">
                <svg className="w-6 h-6 flex-shrink-0 mt-0.5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                </svg>
                <div>
                  <div className="font-bold mb-1">Please complete all required fields:</div>
                  <ul className="list-disc list-inside text-sm">
                    {missingFields.map((field) => (
                      <li key={field}>{
                        field === 'full_name' ? 'Full Name' :
                        field === 'email' ? 'Email' :
                        field === 'profile_pic' ? 'Profile Picture' :
                        field === 'state_id' ? 'State' :
                        field === 'city_id' ? 'City' :
                        field === 'gender_id' ? 'Gender' :
                        field === 'advisor_phone_number' ? 'Google Pay Number' :
                        field === 'birth_date' ? 'Birthdate' :
                        field === 'bio' ? 'Bio' :
                        field
                      }</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg shadow transition disabled:opacity-60" disabled={saving}>
                {saving ? 'Saving...' : 'Complete Profile'}
              </button>
            </div>
            {error && <div className="col-span-1 text-red-500 text-center font-semibold mt-2">{error}</div>}
            {success && <div className="col-span-1 text-green-600 text-center font-semibold mt-2">{success}</div>}
          </form>
        )}
        {/* My Calls Tab */}
        {activeTab === 'calls' && (
          <div>
            {callsLoading ? (
              <div>Loading calls...</div>
            ) : (
              <div className="space-y-4">
                {calls.length === 0 ? <div>No calls found.</div> : calls.map(call => (
                  <div key={call.call_id} className="border rounded p-4 bg-white shadow-sm">
                    <div className="font-semibold text-gray-900">Caller: {call.client?.full_name || '-'}</div>
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
        {/* My Wallet Tab */}
        {activeTab === 'wallet' && (
          <div>
            {walletLoading ? (
              <div>Loading wallet transactions...</div>
            ) : (
              <div className="space-y-4">
                <div className="font-bold mb-2 text-gray-900">Current Wallet Balance: ₹{wallet.toFixed(2)}</div>
                {walletTxns.length === 0 ? <div>No transactions found.</div> : walletTxns.map(txn => (
                  <div key={txn.transaction_id} className="border rounded p-4 bg-white shadow-sm">
                    <div className="text-gray-900">Date: {txn.date_time ? new Date(txn.date_time).toLocaleString() : '-'}</div>
                    <div className="text-gray-900">Type: {txn.credit > 0 ? 'Credit' : 'Debit'}</div>
                    <div className="text-gray-900">Amount: ₹{txn.credit > 0 ? txn.credit : txn.debit}</div>
                    <div className="text-gray-900">Description: {txn.remark || '-'}</div>
                    <div className="text-gray-900">Balance: ₹{txn.balance}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      </div>
      {/* Incoming Call Modal for Advisor */}
      <Dialog open={callModalOpen && !!incomingCall} onClose={() => setCallModalOpen(false)} className="fixed z-50 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-md w-full mx-auto p-8 z-10">
            <h3 className="text-xl font-bold mb-4">Incoming Call Request</h3>
            {incomingCall && (
              <div className="mb-4 text-base">
                <div><b>Client ID:</b> {incomingCall.client_id}</div>
                <div><b>Duration:</b> {incomingCall.duration_minutes} min</div>
                <div><b>Total Cost:</b> ₹{incomingCall.total_cost}</div>
                <div><b>Channel:</b> <span className="font-mono">{incomingCall.channel_name}</span></div>
              </div>
            )}
            {callModalOpen && !!incomingCall && (
              <div className="mb-2 text-center text-red-600 font-bold text-lg">
                This request will disappear in {callRequestTimer} seconds
              </div>
            )}
            <button
              className="w-full py-2 rounded bg-blue-600 text-white font-semibold mb-2 disabled:opacity-60"
              disabled={callLoading}
              onClick={async () => {
                if (!incomingCall) return;
                setCallLoading(true);
                const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
                // Generate Agora tokens for both advisor and client
                const channelName = incomingCall.channel_name;
                const advisorUid = incomingCall.advisor_id;
                const clientUid = incomingCall.client_id;
                const [advisorRes, clientRes] = await Promise.all([
                  fetch('/api/agora-token', {
                    method: 'POST',
                    body: JSON.stringify({ channelName, uid: advisorUid, role: 'publisher' }),
                    headers: { 'Content-Type': 'application/json' }
                  }),
                  fetch('/api/agora-token', {
                    method: 'POST',
                    body: JSON.stringify({ channelName, uid: clientUid, role: 'publisher' }),
                    headers: { 'Content-Type': 'application/json' }
                  })
                ]);
                const { token: advisorToken } = await advisorRes.json();
                const { token: clientToken } = await clientRes.json();
                // Store tokens in call_requests
                await supabase
                  .from('call_requests')
                  .update({ advisor_token: advisorToken, client_token: clientToken })
                  .eq('id', incomingCall.id);
                // Update call_requests status to 'advisor_accepted'
                await supabase
                  .from('call_requests')
                  .update({ status: 'advisor_accepted' })
                  .eq('id', incomingCall.id);
                setCallLoading(false);
                setCallModalOpen(false);
                setIncomingCall(null);
              }}
            >
              Call
            </button>
            <button
              className="w-full py-2 rounded bg-red-600 text-white font-semibold mt-2"
              onClick={async () => {
                if (!incomingCall) return;
                // Set call_requests status to 'advisor_declined'
                await supabase
                  .from('call_requests')
                  .update({ status: 'advisor_declined' })
                  .eq('id', incomingCall.id);
                setCallModalOpen(false);
                setIncomingCall(null);
              }}
            >
              Decline
            </button>
          </div>
        </div>
      </Dialog>
      {declinedToast && (
        <div
          className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 min-w-[320px] max-w-[90vw] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl font-semibold text-base transition-all duration-300 animate-fade-in bg-gradient-to-r from-red-500 to-rose-400 text-white"
          style={{ boxShadow: '0 8px 32px 0 rgba(239,68,68,0.15)' }}
          role="alert"
          aria-live="polite"
        >
          <span className="text-2xl">❌</span>
          <span className="flex-1">{declinedToast}</span>
        </div>
      )}
      {/* Agora Call Modal for Advisor */}
      {activeCall && (
        <Dialog open={!!activeCall} onClose={() => {}} className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
            <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-md w-full mx-auto p-8 z-10">
              <h3 className="text-xl font-bold mb-4">In Call with Client</h3>
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
                    const token = activeCall.advisor_token;
                    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
                    setAgoraClient(client);
                    await client.join(AGORA_APP_ID, activeCall.channel_name, token, activeCall.advisor_id);
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
                  onClick={() => handleLeaveCall('advisor')}
                >
                  Leave Call
                </button>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
} 