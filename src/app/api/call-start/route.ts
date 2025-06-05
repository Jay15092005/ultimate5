import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { call_request_id } = await req.json();
    if (!call_request_id) {
      return NextResponse.json({ error: 'Missing call_request_id' }, { status: 400 });
    }
    // Fetch call_request
    const { data: callReq, error: callReqErr } = await supabase
      .from('call_requests')
      .select('*')
      .eq('id', call_request_id)
      .single();
    if (callReqErr || !callReq) {
      return NextResponse.json({ error: 'Call request not found' }, { status: 404 });
    }
    const { advisor_id, client_id, duration_minutes, total_cost, channel_name } = callReq;
    // Fetch client and advisor wallets
    const { data: client } = await supabase.from('accounts').select('wallet').eq('account_id', client_id).single();
    const { data: advisor } = await supabase.from('accounts').select('wallet').eq('account_id', advisor_id).single();
    if (!client || !advisor) {
      return NextResponse.json({ error: 'Client or advisor not found' }, { status: 404 });
    }
    if (Number(client.wallet) < Number(total_cost)) {
      return NextResponse.json({ error: 'Insufficient client balance' }, { status: 400 });
    }
    // Calculate new balances
    const clientNewBalance = Number(client.wallet) - Number(total_cost);
    const advisorNewBalance = Number(advisor.wallet) + Number(total_cost);
    // Start transaction (simulate with sequential queries)
    // 1. Debit client wallet
    const { error: clientWalletErr } = await supabase
      .from('accounts')
      .update({ wallet: clientNewBalance })
      .eq('account_id', client_id);
    if (clientWalletErr) throw clientWalletErr;
    // 2. Insert client wallet transaction
    await supabase.from('wallet_transactions').insert({
      account_id: client_id,
      debit: total_cost,
      credit: 0,
      balance: clientNewBalance,
      remark: `Call started with advisor ${advisor_id}`,
      date_time: new Date().toISOString(),
      call_id: null // will update after call row is created
    });
    // 3. Credit advisor wallet
    const { error: advisorWalletErr } = await supabase
      .from('accounts')
      .update({ wallet: advisorNewBalance })
      .eq('account_id', advisor_id);
    if (advisorWalletErr) throw advisorWalletErr;
    // 4. Insert advisor wallet transaction
    await supabase.from('wallet_transactions').insert({
      account_id: advisor_id,
      debit: 0,
      credit: total_cost,
      balance: advisorNewBalance,
      remark: `Call started with client ${client_id}`,
      date_time: new Date().toISOString(),
      call_id: null // will update after call row is created
    });
    // 5. Insert into calls table
    const { data: callRow, error: callInsertErr } = await supabase.from('calls').insert({
      client_account_id: client_id,
      advisor_account_id: advisor_id,
      request_time: callReq.request_time,
      start_time: new Date().toISOString(),
      duration_minutes,
      per_minute_charge: Number(total_cost) / Number(duration_minutes),
      call_charge: total_cost,
      call_total_charge: total_cost,
      call_status: 'in_progress',
    }).select('*').single();
    if (callInsertErr) throw callInsertErr;
    // 6. Update wallet_transactions with call_id
    await supabase.from('wallet_transactions').update({ call_id: callRow.call_id }).eq('account_id', client_id).order('date_time', { ascending: false }).limit(1);
    await supabase.from('wallet_transactions').update({ call_id: callRow.call_id }).eq('account_id', advisor_id).order('date_time', { ascending: false }).limit(1);
    return NextResponse.json({ success: true, call: callRow });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
} 