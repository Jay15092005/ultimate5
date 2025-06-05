import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { userId, userType } = await req.json();
    if (!userId || !userType) {
      return NextResponse.json({ error: 'Missing userId or userType' }, { status: 400 });
    }
    // Update status to 'Approved' for both client and advisor on JWT expiry
    const { error } = await supabase
      .from('accounts')
      .update({ status: 'Approved' })
      .eq('account_id', userId)
      .eq('user_type_id', userType === 'client' ? 1 : 2);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unexpected error' }, { status: 500 });
  }
} 