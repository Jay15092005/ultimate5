import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Supabase server client (service role key recommended for webhooks)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for RLS bypass in backend
);

// Disable Next.js body parsing for raw body access
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to get raw body as buffer
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  if (!webhookSecret) {
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // 1. Get raw body and signature
  const rawBody = await getRawBody(req);
  const signature = req.headers['x-razorpay-signature'] as string;

  // 2. Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // 3. Parse event
  const event = JSON.parse(rawBody.toString());

  // 4. Handle event types
  try {
    if (event.event === 'payment.captured') {
      // Payment successful
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      const amount = payment.amount / 100; // paise to INR
      const email = payment.email;
      // Find account by email (or use metadata if you pass account_id in order creation)
      const { data: account } = await supabase
        .from('accounts')
        .select('account_id, wallet')
        .eq('email', email)
        .single();

      if (account) {
        const newBalance = (account.wallet || 0) + amount;
        // Log transaction
        await supabase.from('wallet_transactions').insert({
          account_id: account.account_id,
          credit: amount,
          balance: newBalance,
          remark: `Recharge success via Razorpay. Payment ID: ${paymentId}`,
          date_time: new Date().toISOString(),
        });
        // Update wallet
        await supabase.from('accounts').update({ wallet: newBalance }).eq('account_id', account.account_id);
      }
    } else if (event.event === 'payment.failed') {
      // Payment failed
      const payment = event.payload.payment.entity;
      const paymentId = payment.id;
      const amount = payment.amount / 100;
      const email = payment.email;
      const { data: account } = await supabase
        .from('accounts')
        .select('account_id, wallet')
        .eq('email', email)
        .single();

      if (account) {
        await supabase.from('wallet_transactions').insert({
          account_id: account.account_id,
          debit: 0,
          credit: 0,
          balance: account.wallet,
          remark: `Recharge failed via Razorpay. Payment ID: ${paymentId}`,
          date_time: new Date().toISOString(),
        });
      }
    } else if (event.event === 'refund.processed') {
      // Refund processed
      const refund = event.payload.refund.entity;
      const paymentId = refund.payment_id;
      const amount = refund.amount / 100;
      // Find account by payment_id (if you store payment_id in remark or metadata)
      // This requires you to store payment_id in wallet_transactions for mapping
      // For now, just log a refund event
      await supabase.from('wallet_transactions').insert({
        // account_id: ... (find by payment_id if possible)
        debit: amount,
        credit: 0,
        balance: 0, // You may want to fetch and update the real balance
        remark: `Refund processed via Razorpay. Payment ID: ${paymentId}`,
        date_time: new Date().toISOString(),
      });
    }
    // Always respond 200 to Razorpay
    res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
} 