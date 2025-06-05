import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

const AGORA_APP_ID = process.env.AGORA_APP_ID!;
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE!;

export async function POST(req: NextRequest) {
  try {
    const { channelName, uid, role, expireSeconds = 3600 } = await req.json();
    if (!channelName || !uid || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      agoraRole,
      Math.floor(Date.now() / 1000) + expireSeconds
    );
    return NextResponse.json({ token });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} 