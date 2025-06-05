'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AGORA_APP_ID = 'a3b82070172d41e086e637b4c3cd3f6e';

export function AdvisorCallHandler() {
  const [currentCall, setCurrentCall] = useState<any | null>(null);
  const [agoraClient, setAgoraClient] = useState<any>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);

  useEffect(() => {
    let channel: any;
    let advisorAccountId: number | null = null;

    (async () => {
      if (typeof window === 'undefined') return;
      
      // Get user
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) console.error('Supabase getUser error (advisor call):', userErr);
      if (!user) return;

      // Get account info
      const { data: account, error: accErr } = await supabase
        .from('accounts')
        .select('account_id, user_type_id')
        .eq('auth_user_id', user.id)
        .single();
      
      if (accErr) console.error('Supabase get account error (advisor call):', accErr);
      if (!account) return;
      
      advisorAccountId = account.account_id;

      // Subscribe to call_requests for this advisor
      channel = supabase
        .channel('global-advisor-call')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_requests',
          filter: `advisor_id=eq.${advisorAccountId}`
        }, async (payload) => {
          const req = payload.new;
          if (req.status === 'in_progress') {
            setCurrentCall(req);
            await joinCall(req);
          } else if (['declined', 'completed'].includes(req.status)) {
            await leaveCall();
            setCurrentCall(null);
          }
        })
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
      leaveCall();
    };
  }, []);

  const joinCall = async (callRequest: any) => {
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      setAgoraClient(client);

      // Set up event handlers for remote users
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      client.on('user-unpublished', async (user, mediaType) => {
        await client.unsubscribe(user, mediaType);
      });

      // Join the channel
      await client.join(AGORA_APP_ID, callRequest.channel_name, callRequest.advisor_token, callRequest.advisor_id);
      
      // Create and publish local audio track
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      setLocalAudioTrack(audioTrack);
      await client.publish([audioTrack]);

      console.log('[AdvisorCallHandler] Successfully joined call');
    } catch (err) {
      console.error('[AdvisorCallHandler] Error joining call:', err);
    }
  };

  const leaveCall = async () => {
    try {
      if (localAudioTrack) {
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }
      if (agoraClient) {
        await agoraClient.leave();
        setAgoraClient(null);
      }
      console.log('[AdvisorCallHandler] Successfully left call');
    } catch (err) {
      console.error('[AdvisorCallHandler] Error leaving call:', err);
    }
  };

  return null; // This is a background component, no UI needed
} 