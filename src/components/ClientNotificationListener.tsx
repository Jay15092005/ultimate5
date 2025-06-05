'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';

const AGORA_APP_ID = 'a3b82070172d41e086e637b4c3cd3f6e'; // Replace with your App ID
const JOIN_SOUND_URL = 'https://cdn.pixabay.com/audio/2022/07/26/audio_124bfa4c82.mp3'; // Free short notification sound

export function ClientNotificationListener() {
  const [toast, setToast] = useState<string | null>(null);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [pendingCallId, setPendingCallId] = useState<number | null>(null);
  const [pendingCall, setPendingCall] = useState<any | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [showJoinButton, setShowJoinButton] = useState(false);
  const [agoraClient, setAgoraClient] = useState<any>(null);

  // Play sound utility
  const playSound = () => {
    if (typeof window !== 'undefined') {
      const audio = new window.Audio(JOIN_SOUND_URL);
      audio.play();
    }
  };

  // Vibrate utility (mobile)
  const vibrate = () => {
    if (typeof window !== 'undefined' && 'vibrate' in window.navigator) {
      window.navigator.vibrate(400); // vibrate for 400ms
    }
  };

  useEffect(() => {
    let channel: any;
    let clientAccountId: number | null = null;
    let isClient = false;
    (async () => {
      if (typeof window === 'undefined') return;
      // Get user
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) console.error('Supabase getUser error:', userErr);
      if (!user) return;
      // Get account info
      const { data: account, error: accErr } = await supabase
        .from('accounts')
        .select('account_id, user_type_id, full_name')
        .eq('auth_user_id', user.id)
        .single();
      if (accErr) console.error('Supabase get account error:', accErr);
      if (!account) return;
      clientAccountId = account.account_id;
      isClient = account.user_type_id !== 2;
      if (!isClient) return;
      // Subscribe to call_requests for this client
      channel = supabase
        .channel('global-client-notifications')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_requests',
          filter: `client_id=eq.${clientAccountId}`
        }, async (payload) => {
          const req = payload.new;
          // Prevent duplicate notifications
          if (payload.commit_timestamp === lastEventId) return;
          setLastEventId(payload.commit_timestamp);
          console.log('[ClientNotificationListener] call_requests update:', req.status, req);
          if (req.status === 'advisor_declined') {
            // Fetch advisor name
            const { data: advisor, error: advErr } = await supabase
              .from('accounts')
              .select('full_name')
              .eq('account_id', req.advisor_id)
              .single();
            if (advErr) console.error('Supabase get advisor error:', advErr);
            setToast(`${advisor?.full_name || 'Advisor'} declined your call request.`);
            setPendingCallId(null);
            setShowJoinButton(false);
            setPendingCall(null);
          } else if (req.status === 'advisor_accepted') {
            setToast('Advisor accepted your call. Join now!');
            setPendingCallId(req.id); // Store call_request id
            setPendingCall(req);
            setShowJoinButton(true);
            playSound();
            vibrate();
            console.log('[ClientNotificationListener] Advisor accepted call, showing join button and playing sound/vibration.');
            // Start 15s timer for auto-decline
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(async () => {
              // Check if still advisor_accepted (not joined/declined)
              const { data: checkReq, error: checkErr } = await supabase
                .from('call_requests')
                .select('status')
                .eq('id', req.id)
                .single();
              if (checkErr) console.error('Supabase check call_request error:', checkErr);
              if (checkReq && checkReq.status === 'advisor_accepted') {
                // Auto-decline
                const { error: autoDeclineErr } = await supabase
                  .from('call_requests')
                  .update({ status: 'declined' })
                  .eq('id', req.id);
                if (autoDeclineErr) console.error('Supabase auto-decline error:', autoDeclineErr);
                setToast('You did not respond. Call auto-declined.');
                setPendingCallId(null);
                setShowJoinButton(false);
                setPendingCall(null);
                console.log('[ClientNotificationListener] Call auto-declined after 15s inactivity.');
              }
            }, 15000);
          } else if (req.status === 'declined') {
            setToast('You declined the call.');
            setPendingCallId(null);
            setShowJoinButton(false);
            setPendingCall(null);
            if (timerRef.current) clearTimeout(timerRef.current);
            console.log('[ClientNotificationListener] Call declined by client.');
          } else if (req.status === 'in_progress') {
            setToast('Call started!');
            setPendingCallId(null);
            setShowJoinButton(false);
            setPendingCall(null);
            if (timerRef.current) clearTimeout(timerRef.current);
            console.log('[ClientNotificationListener] Call in progress.');
          } else if (req.status === 'completed') {
            setToast('Call completed.');
            setPendingCallId(null);
            setShowJoinButton(false);
            setPendingCall(null);
            if (timerRef.current) clearTimeout(timerRef.current);
            console.log('[ClientNotificationListener] Call completed.');
          }
        })
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Dismiss toast after 2s unless it's advisor_accepted (then 15s or on interaction)
  useEffect(() => {
    if (toast && !pendingCallId) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast, pendingCallId]);

  // Join call from toast button
  const handleJoinCall = async () => {
    if (!pendingCall) return;
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      const token = pendingCall.client_token;
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      setAgoraClient(client);
      await client.join(AGORA_APP_ID, pendingCall.channel_name, token, pendingCall.client_id);
      const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      await client.publish([localAudioTrack]);
      setShowJoinButton(false);
      setToast(null);
      setPendingCallId(null);
      setPendingCall(null);
      // Set call_requests status to in_progress
      const { error: inProgressErr } = await supabase
        .from('call_requests')
        .update({ status: 'in_progress' })
        .eq('id', pendingCall.id);
      if (inProgressErr) console.error('Supabase set in_progress error:', inProgressErr);
      console.log('[ClientNotificationListener] Joined Agora call and set in_progress.');
    } catch (err) {
      console.error('[ClientNotificationListener] Error joining Agora call:', err);
      setToast('Error joining call. Please try again.');
    }
  };

  // Decline call from toast button
  const handleDeclineCall = async () => {
    if (!pendingCall) return;
    try {
      const { error: declineErr } = await supabase
        .from('call_requests')
        .update({ status: 'declined' })
        .eq('id', pendingCall.id);
      if (declineErr) console.error('Supabase decline error (toast):', declineErr);
      setShowJoinButton(false);
      setToast(null);
      setPendingCallId(null);
      setPendingCall(null);
      console.log('[ClientNotificationListener] Call declined by client from toast.');
    } catch (err) {
      console.error('[ClientNotificationListener] Error declining call from toast:', err);
      setToast('Error declining call. Please try again.');
    }
  };

  if (!toast) return null;
  // Toast UI (centered, beautiful)
  return (
    <div
      className="fixed top-8 left-1/2 transform -translate-x-1/2 z-[9999] min-w-[320px] max-w-[90vw] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl font-semibold text-base transition-all duration-300 animate-fade-in bg-gradient-to-r from-blue-500 to-blue-400 text-white"
      style={{ boxShadow: '0 8px 32px 0 rgba(59,130,246,0.15)' }}
      role="alert"
      aria-live="polite"
    >
      <span className="text-2xl">🔔</span>
      <span className="flex-1">{toast}</span>
      {showJoinButton && (
        <>
          <button
            className="ml-4 px-4 py-2 rounded bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition"
            onClick={handleJoinCall}
          >
            Join Call
          </button>
          <button
            className="ml-2 px-4 py-2 rounded bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition"
            onClick={handleDeclineCall}
          >
            Decline
          </button>
        </>
      )}
    </div>
  );
} 