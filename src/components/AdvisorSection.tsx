// AdvisorSection component for Ultimate Advisor Platform
// Displays a grid of advisor cards, supports infinite scroll and modal details

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import Link from "next/link";
import { Dialog } from '@headlessui/react';
import { useRouter } from 'next/navigation';

// Helper to render star ratings
function renderStars(rating: number) {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  return (
    <span className="text-yellow-400 text-lg">
      {Array(fullStars).fill(0).map((_, i) => <span key={"full"+i}>★</span>)}
      {halfStar && <span>☆</span>}
      {Array(emptyStars).fill(0).map((_, i) => <span key={"empty"+i}>☆</span>)}
    </span>
  );
}

// Props:
// - initialCount: how many advisors to show initially
// - batchCount: how many to load per scroll batch (for infinite scroll)
// - infiniteScroll: enable/disable infinite scroll
export default function AdvisorSection({ initialCount = 9, batchCount = 0, infiniteScroll = false }: { initialCount?: number, batchCount?: number, infiniteScroll?: boolean }) {
  // State for advisor data, lookup maps, and UI
  const [advisors, setAdvisors] = useState<any[]>([]);
  const [expertises, setExpertises] = useState<Record<string, string>>({});
  const [rates, setRates] = useState<Record<string, string>>({});
  const [languages, setLanguages] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearsMap, setYearsMap] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [selectedAdvisor, setSelectedAdvisor] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callDuration, setCallDuration] = useState<number>(10);
  const [callError, setCallError] = useState<string | null>(null);
  const [callTotalCost, setCallTotalCost] = useState<number | null>(null);
  const [callChannelName, setCallChannelName] = useState<string | null>(null);
  const [callLoading, setCallLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const router = useRouter();
  const loaderRef = React.useRef<HTMLDivElement | null>(null);
  const callAdvisorRef = useRef<any>(null);

  // Infinite scroll effect: load more advisors when scrolled to bottom
  React.useEffect(() => {
    if (!infiniteScroll || !batchCount) return;
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + batchCount, advisors.length));
        }
      },
      { threshold: 1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => {
      if (loaderRef.current) observer.unobserve(loaderRef.current);
    };
  }, [infiniteScroll, batchCount, advisors.length]);

  // Fetch all advisor data and lookup tables on mount
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      // Fetch advisors
      const { data: advisorData, error: advisorError } = await supabase
        .from('accounts')
        .select('account_id, full_name, expertise_id, rate_per_minute_id, language_id, profile_pic, bio, status, experience_years_id, total_calls')
        .eq('user_type_id', 2)
        .in('status', ['Approved', 'Available', 'Busy']);
      if (advisorError) {
        setError('Failed to fetch advisors.');
        setLoading(false);
        return;
      }
      setAdvisors(advisorData || []);
      // Fetch expertises
      const { data: expData } = await supabase.from('expertises').select('expertise_id, expertise_name');
      const expMap: Record<string, string> = {};
      (expData || []).forEach((e: any) => { expMap[e.expertise_id] = e.expertise_name; });
      setExpertises(expMap);
      // Fetch experience years
      const { data: yearsData } = await supabase.from('experience_years').select('experience_years_id, years_value');
      const yearsMap: Record<string, string> = {};
      (yearsData || []).forEach((y: any) => { yearsMap[y.experience_years_id] = y.years_value; });
      // Fetch rates
      const { data: rateData } = await supabase.from('rates_per_minute').select('rate_per_minute_id, rate_value');
      const rateMap: Record<string, string> = {};
      (rateData || []).forEach((r: any) => { rateMap[r.rate_per_minute_id] = r.rate_value; });
      setRates(rateMap);
      // Fetch languages
      const { data: langData } = await supabase.from('languages').select('language_id, language_name');
      const langMap: Record<string, string> = {};
      (langData || []).forEach((l: any) => { langMap[l.language_id] = l.language_name; });
      setLanguages(langMap);
      // Fetch ratings for all advisors
      const advisorIds = (advisorData || []).map((a: any) => a.account_id);
      if (advisorIds.length > 0) {
        const { data: feedbackData } = await supabase
          .from('feedback')
          .select('call_id, rating, call_id!inner(advisor_account_id)')
          .in('call_id.advisor_account_id', advisorIds);
        // Map advisorId -> [ratings]
        const ratingMap: Record<string, number[]> = {};
        (feedbackData || []).forEach((f: any) => {
          const advisorId = f.call_id?.advisor_account_id;
          if (advisorId) {
            if (!ratingMap[advisorId]) ratingMap[advisorId] = [];
            ratingMap[advisorId].push(f.rating);
          }
        });
        // Map advisorId -> avg rating
        const avgMap: Record<string, number> = {};
        advisorIds.forEach((id: any) => {
          const arr = ratingMap[id] || [];
          avgMap[id] = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        });
        setRatings(avgMap);
      } else {
        setRatings({});
      }
      // Store yearsMap in state
      setYearsMap(yearsMap);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Subscribe to advisor status/rate changes in realtime
  useEffect(() => {
    // Subscribe to status and price changes for advisors
    const channel = supabase
      .channel('advisor-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'accounts',
          filter: 'user_type_id=eq.2', // Only advisors
        },
        (payload) => {
          const updated = payload.new;
          setAdvisors((prev) =>
            prev.map((advisor) =>
              advisor.account_id === updated.account_id
                ? { ...advisor, status: updated.status, rate_per_minute_id: updated.rate_per_minute_id }
                : advisor
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-dismiss toast after 2 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Placeholder for call initiation logic
  function handleCallNow(advisor: any) {
    setCallError(null);
    setCallTotalCost(null);
    setCallChannelName(null);
    setCallDuration(10);
    callAdvisorRef.current = advisor;
    setCallModalOpen(true);
  }

  return (
    <section className="w-full max-w-5xl mx-auto py-12 px-4" aria-labelledby="advisors-title">
      <h2 id="advisors-title" className="text-3xl font-bold mb-8 text-center">Featured Advisors</h2>
      {/* Status Legend for advisor availability */}
      <div className="flex justify-center gap-6 mb-6 text-sm">
        <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-green-400"></span>Available</span>
        <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-orange-400"></span>On Another Call</span>
        <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>Not Available</span>
      </div>
      {loading && <div className="text-center py-8">Loading advisors...</div>}
      {error && <div className="text-center text-red-500 py-8">{error}</div>}
      {!loading && !error && advisors.length === 0 && (
        <div className="text-center py-8 text-neutral-500">No Advisors Available At The Moment.</div>
      )}
      {/* Advisor cards grid */}
      <div className="grid gap-6 md:grid-cols-3 sm:grid-cols-2 grid-cols-1">
        {advisors.slice(0, visibleCount).map((advisor: any, idx: number) => {
          // Prepare display values for each advisor
          const expertiseNames = (String(advisor.expertise_id) || "").split(',').map((id: string) => expertises[String(id)]).filter(Boolean).join(', ');
          const languageNames = (String(advisor.language_id) || "").split(',').map((id: string) => languages[String(id)]).filter(Boolean).join(', ');
          const rate = rates[String(advisor.rate_per_minute_id)] ? `${rates[String(advisor.rate_per_minute_id)]} rs/min` : "-";
          const rating = ratings[advisor.account_id] || 0;
          const experience = advisor.experience_years_id && yearsMap[String(advisor.experience_years_id)]
            ? `${yearsMap[String(advisor.experience_years_id)]} Years`
            : '-';
          const calls = typeof advisor.total_calls === 'number' ? advisor.total_calls : 0;
          let statusDot = 'bg-green-400';
          if (advisor.status === 'Approved') statusDot = 'bg-red-500';
          else if (advisor.status === 'Busy') statusDot = 'bg-orange-400';
          return (
          <div
              key={advisor.full_name + idx}
              className="bg-white dark:bg-neutral-900 rounded-2xl shadow border border-neutral-200 dark:border-neutral-800 flex flex-col items-center p-4 transition hover:shadow-lg min-h-[260px] w-full text-left"
              aria-label={`Advisor card for ${advisor.full_name}`}
            >
              <div className="flex items-center w-full gap-4">
            <img
                  src={advisor.profile_pic || "/next.svg"}
                  alt={`Profile of ${advisor.full_name}`}
                  className="w-16 h-16 rounded-full object-cover border-2 border-neutral-200 dark:border-neutral-800"
            />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold leading-tight">{advisor.full_name}</h3>
                    <span className={`ml-auto inline-block w-3 h-3 rounded-full ${statusDot}`} title={advisor.status}></span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">{expertiseNames || '-'}</div>
                  <div className="text-xs text-neutral-500">{languageNames || '-'}</div>
                </div>
              </div>
              <div className="flex w-full items-center justify-between mt-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400 text-base">{renderStars(rating)}</span>
                    <span className="text-xs text-neutral-500">({rating.toFixed(1)})</span>
                  </div>
                  <div className="text-xs text-neutral-500">{calls} calls</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-xs text-neutral-500">Exp: {experience}</div>
                  <div className="text-xs text-neutral-500">{rate}</div>
                </div>
              </div>
              <button
                className="mt-4 w-full py-2 rounded-lg border font-semibold text-sm text-center transition-colors border-blue-500 text-blue-600 hover:bg-blue-100/60 dark:hover:bg-blue-900/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => handleCallNow(advisor)}
              >
                Call Now
              </button>
            </div>
          );
        })}
      </div>
      {/* Load More button for homepage only */}
      {!infiniteScroll && !loading && !error && advisors.length > 9 && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => router.push('/advisors')}
            className="px-6 py-2 rounded-lg border border-blue-500 text-blue-600 font-semibold text-base transition-colors hover:bg-blue-50 dark:hover:bg-blue-950"
          >
            Load More
          </button>
        </div>
      )}
      {/* Infinite scroll loader for /advisors page */}
      {infiniteScroll && visibleCount < advisors.length && (
        <div ref={loaderRef} className="flex justify-center mt-8">
          <span className="px-6 py-2 rounded-lg border border-blue-200 text-blue-400 font-semibold text-base bg-blue-50 dark:bg-blue-950">Loading more advisors...</span>
        </div>
      )}
      {/* Advisor Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} className="fixed z-50 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-lg w-full mx-auto p-8 z-10">
            {selectedAdvisor && (
              <>
                <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-2xl text-neutral-400 hover:text-neutral-700 dark:hover:text-white">&times;</button>
                <div className="flex flex-col items-center gap-4">
                  <img
                    src={selectedAdvisor.profile_pic || "/next.svg"}
                    alt={`Profile of ${selectedAdvisor.full_name}`}
                    className="w-24 h-24 rounded-full object-cover border-2 border-neutral-200 dark:border-neutral-800"
                  />
                  <h3 className="text-2xl font-bold text-center">{selectedAdvisor.full_name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-3 h-3 rounded-full ${selectedAdvisor.status === 'Available' ? 'bg-green-400' : selectedAdvisor.status === 'Approved' ? 'bg-red-500' : 'bg-orange-400'}`}></span>
                    <span className="text-sm text-neutral-500">{selectedAdvisor.status}</span>
                  </div>
                  <div className="text-sm text-neutral-500 text-center">{selectedAdvisor.bio}</div>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-3 py-1 rounded-full text-xs">{(String(selectedAdvisor.expertise_id) || "").split(',').map((id: string) => expertises[String(id)]).filter(Boolean).join(', ') || '-'}</span>
                    <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 px-3 py-1 rounded-full text-xs">{(String(selectedAdvisor.language_id) || "").split(',').map((id: string) => languages[String(id)]).filter(Boolean).join(', ') || '-'}</span>
                  </div>
                  <div className="flex justify-between w-full mt-4">
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-neutral-500">Experience</span>
                      <span className="font-semibold">{selectedAdvisor.experience_years_id && yearsMap[String(selectedAdvisor.experience_years_id)] ? `${yearsMap[String(selectedAdvisor.experience_years_id)]} Years` : '-'}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-neutral-500">Rate</span>
                      <span className="font-semibold">{rates[String(selectedAdvisor.rate_per_minute_id)] ? `${rates[String(selectedAdvisor.rate_per_minute_id)]} rs/min` : '-'}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-neutral-500">Calls</span>
                      <span className="font-semibold">{typeof selectedAdvisor.total_calls === 'number' ? selectedAdvisor.total_calls : 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-yellow-400 text-lg">{renderStars(ratings[selectedAdvisor.account_id] || 0)}</span>
                    <span className="text-xs text-neutral-500">({(ratings[selectedAdvisor.account_id] || 0).toFixed(1)})</span>
                  </div>
                  <button
                    onClick={() => handleCallNow(selectedAdvisor)}
                    className="mt-6 w-full py-3 rounded-lg border font-semibold text-base text-center transition-colors border-blue-500 text-blue-600 hover:bg-blue-100/60 dark:hover:bg-blue-900/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    Call Now
                  </button>
                </div>
              </>
            )}
          </div>
      </div>
      </Dialog>
      {/* Call Modal for duration and cost check */}
      <Dialog open={callModalOpen} onClose={() => setCallModalOpen(false)} className="fixed z-50 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-md w-full mx-auto p-8 z-10">
            <button onClick={() => setCallModalOpen(false)} className="absolute top-4 right-4 text-2xl text-neutral-400 hover:text-neutral-700 dark:hover:text-white">&times;</button>
            <h3 className="text-xl font-bold mb-4">Start Call with {callAdvisorRef.current?.full_name}</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Call Duration (minutes):</label>
              <input type="number" min={1} max={60} value={callDuration} onChange={e => setCallDuration(Number(e.target.value))} className="w-full border rounded px-3 py-2" />
            </div>
            <button
              className="w-full py-2 rounded bg-blue-600 text-white font-semibold mb-2 disabled:opacity-60"
              disabled={callLoading}
              onClick={async () => {
                setCallError(null);
                setCallLoading(true);
                // 1. Check advisor status
                const advisorId = callAdvisorRef.current?.account_id;
                const { data: advisorData, error: advisorErr } = await supabase
                  .from('accounts')
                  .select('status, rate_per_minute_id')
                  .eq('account_id', advisorId)
                  .single();
                if (advisorErr || !advisorData) {
                  setCallError('Failed to fetch advisor info.');
                  setCallLoading(false);
                  return;
                }
                if (advisorData.status === 'Busy') {
                  setCallError('The advisor is currently on another call.');
                  setCallLoading(false);
                  return;
                }
                if (advisorData.status !== 'Available') {
                  setCallError('Advisor is not available for calls.');
                  setCallLoading(false);
                  return;
                }
                // 2. Fetch advisor rate
                const { data: rateData } = await supabase
                  .from('rates_per_minute')
                  .select('rate_value')
                  .eq('rate_per_minute_id', advisorData.rate_per_minute_id)
                  .single();
                if (!rateData) {
                  setCallError('Advisor rate not found.');
                  setCallLoading(false);
                  return;
                }
                const rate = Number(rateData.rate_value);
                // 3. Calculate total cost
                const totalCost = callDuration * rate;
                setCallTotalCost(totalCost);
                // 4. Get client user and wallet
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                  setCallError('You must be logged in as a client.');
                  setCallLoading(false);
                  return;
                }
                const { data: clientAccount } = await supabase
                  .from('accounts')
                  .select('account_id, wallet, user_type_id')
                  .eq('auth_user_id', user.id)
                  .single();
                if (!clientAccount || clientAccount.user_type_id === 2) {
                  setCallError('Only clients can initiate calls.');
                  setCallLoading(false);
                  return;
                }
                if (Number(clientAccount.wallet) < totalCost) {
                  setCallError('Insufficient Balance.');
                  setCallLoading(false);
                  return;
                }
                // 5. Generate unique channel name
                const timestamp = Date.now();
                const channelName = `call_${advisorId}_${clientAccount.account_id}_${timestamp}`;
                setCallChannelName(channelName);
                setCallLoading(false);
                // Insert call request into call_requests table
                const { error: insertError } = await supabase.from('call_requests').insert({
                  advisor_id: advisorId,
                  client_id: clientAccount.account_id,
                  channel_name: channelName,
                  duration_minutes: callDuration,
                  total_cost: totalCost,
                  status: 'pending',
                });
                if (insertError) {
                  setCallError('Failed to send call request. Please try again.');
                  setCallLoading(false);
                  return;
                }
                // Show toast for request sent
                setToast({ message: `Your request has been sent to ${callAdvisorRef.current?.full_name} for ${callDuration} minutes at a total cost of ₹${totalCost}.`, type: 'success' });
                setCallModalOpen(false);
              }}
            >
              Check & Continue
            </button>
            {callTotalCost !== null && callChannelName && !callError && (
              <div className="mt-4 p-3 rounded bg-green-100 text-green-700 text-center">
                Total Cost: <b>₹{callTotalCost}</b><br />
                Channel Name: <span className="font-mono">{callChannelName}</span>
              </div>
            )}
            {callError && <div className="mt-4 p-3 rounded bg-red-100 text-red-700 text-center">{callError}</div>}
          </div>
        </div>
      </Dialog>
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-8 left-1/2 transform -translate-x-1/2 z-50 min-w-[320px] max-w-[90vw] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl font-semibold text-base transition-all duration-300 animate-fade-in ${toast.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-white' : 'bg-gradient-to-r from-red-500 to-rose-400 text-white'}`}
          style={{ boxShadow: '0 8px 32px 0 rgba(34,197,94,0.15)' }}
          role="alert"
          aria-live="polite"
        >
          <span className="text-2xl">
            {toast.type === 'success' ? '✔️' : '❌'}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-3 text-white/80 hover:text-white text-xl font-bold focus:outline-none"
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}
      {/* Popup Modal for errors */}
      <Dialog open={!!popup} onClose={() => setPopup(null)} className="fixed z-50 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-md w-full mx-auto p-8 z-10 text-center">
            <div className="text-lg font-bold mb-4">{popup}</div>
            <button onClick={() => setPopup(null)} className="mt-2 px-6 py-2 rounded bg-blue-600 text-white font-semibold">OK</button>
          </div>
        </div>
      </Dialog>
    </section>
  );
} 