import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(req: NextRequest) {
  try {
    const { amount } = await req.json();

    if (!amount || typeof amount !== 'number') {
      console.log('Invalid amount:', amount);
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const options = {
      amount, // amount in paise
      currency: 'INR',
      receipt: `receipt_order_${Date.now()}`,
    };

    try {
      const order = await razorpay.orders.create(options);
      console.log('Razorpay order created:', order);
      return NextResponse.json({ order });
    } catch (orderError) {
      console.log('Razorpay order creation error:', orderError);
      return NextResponse.json({ error: (orderError as Error).message || 'Order creation failed' }, { status: 500 });
    }
  } catch (error: any) {
    console.log('API route error:', error);
    return NextResponse.json({ error: error.message || 'Order creation failed' }, { status: 500 });
  }
} 