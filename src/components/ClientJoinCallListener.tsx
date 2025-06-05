'use client';
import { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { supabase } from '../supabaseClient';

const AGORA_APP_ID = 'a3b82070172d41e086e637b4c3cd3f6e'; // Replace with your App ID

export function ClientJoinCallListener() {
  const [acceptedCall, setAcceptedCall] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  const [agoraClient, setAgoraClient] = useState<any>(null);

  useEffect(() => {
    let channel: any;
    let clientAccountId: number | null = null;
    let isClient = false;
    (async () => {
      if (typeof window === 'undefined') return;
      // Get user
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) console.error('Supabase getUser error (join modal):', userErr);
      if (!user) return;
      // Get account info
      const { data: account, error: accErr } = await supabase
        .from('accounts')
        .select('account_id, user_type_id')
        .eq('auth_user_id', user.id)
        .single();
      if (accErr) console.error('Supabase get account error (join modal):', accErr);
      if (!account) return;
      clientAccountId = account.account_id;
      isClient = account.user_type_id !== 2;
      if (!isClient) return;
      // Subscribe to call_requests for this client
      channel = supabase
        .channel('global-client-join-call')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_requests',
          filter: `client_id=eq.${clientAccountId}`
        }, (payload) => {
          const req = payload.new;
          if (req.status === 'advisor_accepted') {
            setAcceptedCall(req);
            setModalOpen(true);
            console.log('[ClientJoinCallListener] Modal opened for advisor_accepted:', req);
          } else if (['declined', 'in_progress', 'completed', 'advisor_declined'].includes(req.status)) {
            setModalOpen(false);
            setAcceptedCall(null);
            console.log('[ClientJoinCallListener] Modal closed for status:', req.status);
          }
        })
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (!acceptedCall || !modalOpen) return null;

  return (
    <Dialog open={modalOpen} onClose={() => { setModalOpen(false); console.log('[ClientJoinCallListener] Modal manually closed.'); }} className="fixed z-50 inset-0 overflow-y-auto">
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
              try {
                const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
                const token = acceptedCall.client_token;
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

                await client.join(AGORA_APP_ID, acceptedCall.channel_name, token, acceptedCall.client_id);
                const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                await client.publish([localAudioTrack]);
                setJoined(true);
                setModalOpen(false);
                setAcceptedCall(null);
                // Set call_requests status to in_progress
                const { error: inProgressErr } = await supabase
                  .from('call_requests')
                  .update({ status: 'in_progress' })
                  .eq('id', acceptedCall.id);
                if (inProgressErr) console.error('Supabase set in_progress error (join modal):', inProgressErr);
                console.log('[ClientJoinCallListener] Joined Agora call and set in_progress.');
              } catch (err) {
                console.error('[ClientJoinCallListener] Error joining Agora call:', err);
              }
            }}
          >
            Join Call
          </button>
          <button
            className="w-full py-2 rounded bg-red-600 text-white font-semibold mt-2"
            onClick={async () => {
              try {
                // Decline after advisor accepted
                const { error: declineErr } = await supabase
                  .from('call_requests')
                  .update({ status: 'declined' })
                  .eq('id', acceptedCall.id);
                if (declineErr) console.error('Supabase decline error (join modal):', declineErr);
                setModalOpen(false);
                setAcceptedCall(null);
                console.log('[ClientJoinCallListener] Call declined by client from modal.');
              } catch (err) {
                console.error('[ClientJoinCallListener] Error declining call:', err);
              }
            }}
          >
            Decline
          </button>
        </div>
      </div>
    </Dialog>
  );
} 