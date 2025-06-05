"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import Navbar from "../../components/Navbar";
import { useRouter } from "next/navigation";
import Script from "next/script";

// Toast notification helper
function Toast({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) {
  return (
    <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded shadow-lg text-white font-semibold transition-all ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
      {message}
      <button className="ml-4 text-white underline" onClick={onClose}>Close</button>
    </div>
  );
}

export default function RechargePage() {
  type RechargeType = { id: number; price: number; credit: number };
  const [recharges, setRecharges] = useState<RechargeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [paying, setPaying] = useState(false);
  const router = useRouter();

  // Fetch recharge options and wallet balance
  useEffect(() => {
    async function fetchRecharges() {
      setLoading(true);
      const { data, error } = await supabase.from("recharge").select("id, price, credit").order("price");
      if (error) setError(error.message);
      setRecharges(data || []);
      setLoading(false);
    }
    async function fetchWallet() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: account } = await supabase
          .from('accounts')
          .select('wallet')
          .eq('auth_user_id', user.id)
          .single();
        setWallet(account?.wallet ?? 0);
      }
    }
    fetchRecharges();
    fetchWallet();
  }, []);

  // Auto-dismiss toast after 2 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Helper to load Razorpay script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.getElementById('razorpay-script')) return resolve(true);
      const script = document.createElement('script');
      script.id = 'razorpay-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Server-side order creation
  const createOrder = async (amount: number) => {
    try {
      const res = await fetch('/api/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.order) throw new Error(data.error || 'Order creation failed');
      return data.order;
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to create order', type: 'error' });
      return null;
    }
  };

  // Handle recharge click
  const handleRecharge = async (item: RechargeType) => {
    setPaying(true);
    setToast(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      setPaying(false);
      return;
    }
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setToast({ message: 'Failed to load Razorpay SDK.', type: 'error' });
      setPaying(false);
      return;
    }
    // Create order on server
    const order = await createOrder(item.price * 100); // in paise
    if (!order) {
      setPaying(false);
      return;
    }
    // Log order for debugging
    console.log('Razorpay order:', order);
    // Validate contact (should be 10 digits, no +91)
    let contact = user.phone || '';
    contact = contact.replace(/[^0-9]/g, '');
    if (contact.startsWith('91') && contact.length > 10) contact = contact.slice(2);
    if (contact.length > 10) contact = contact.slice(-10);
    if (contact.length !== 10) contact = '';
    const options = {
      key: 'rzp_test_YyT9pTMqYl4Tmh', // Razorpay test key
      amount: item.price * 100,
      currency: 'INR',
      name: 'Ultimate Advisor Platform',
      description: `Recharge for ₹${item.price}`,
      order_id: order.id,
      handler: async function (response: any) {
        try {
          // On successful payment, insert wallet transaction
          const { data: account } = await supabase
            .from('accounts')
            .select('account_id, wallet')
            .eq('auth_user_id', user.id)
            .single();
          if (!account) {
            setToast({ message: 'Account not found.', type: 'error' });
            setPaying(false);
            return;
          }
          const newBalance = (account.wallet || 0) + item.credit;
          const { error } = await supabase.from('wallet_transactions').insert({
            account_id: account.account_id,
            credit: item.credit,
            balance: newBalance,
            remark: `Recharge via Razorpay. Payment ID: ${response.razorpay_payment_id}`,
            date_time: new Date().toISOString(),
          });
          if (!error) {
            // Update wallet balance in accounts table
            await supabase.from('accounts').update({ wallet: newBalance }).eq('account_id', account.account_id);
            setWallet(newBalance);
            setToast({ message: 'Recharge successful!', type: 'success' });
          } else {
            setToast({ message: 'Recharge successful, but failed to update wallet.', type: 'error' });
          }
        } catch (err: any) {
          setToast({ message: err.message || 'Recharge failed after payment.', type: 'error' });
        }
        setPaying(false);
      },
      prefill: {
        email: user.email || '',
        contact,
      },
      theme: { color: '#2563eb' },
      modal: {
        ondismiss: () => setPaying(false),
      },
      retry: { enabled: true, max_count: 3 },
      notes: {
        user_id: user.id,
        recharge_id: item.id,
      },
    };
    try {
      // @ts-ignore
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setToast({ message: response.error.description || 'Payment failed.', type: 'error' });
        setPaying(false);
      });
      rzp.open();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to open Razorpay modal.', type: 'error' });
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-blue-50 dark:from-neutral-900 dark:to-blue-950 flex flex-col">
      <Navbar />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {paying && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg px-8 py-6 flex flex-col items-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
            <span className="text-blue-700 font-semibold">Processing payment...</span>
          </div>
        </div>
      )}
      <div className="px-4 pt-6">
        <button
          onClick={async () => {
            // Check if user is a logged-in client
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: account } = await supabase
                .from('accounts')
                .select('user_type_id')
                .eq('auth_user_id', user.id)
                .single();
              if (account && account.user_type_id !== 2) {
                router.push('/');
                return;
              }
            }
            router.back();
          }}
          className="mb-6 px-5 py-2 rounded-full border border-blue-600 text-blue-700 dark:text-blue-300 font-medium bg-white dark:bg-neutral-900 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          aria-label="Go back"
        >
          ← Go Back
        </button>
        {wallet !== null && (
          <div className="mb-6 text-right text-lg font-semibold text-blue-700">Wallet Balance: ₹{wallet}</div>
        )}
      </div>
      <main className="flex-1 max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">Recharge Options</h1>
        {loading ? (
          <div className="text-center text-lg">Loading...</div>
        ) : error ? (
          <div className="text-center text-red-500">{error}</div>
        ) : (
          recharges.length === 0 ? (
            <div className="text-center text-gray-500">No recharge options found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
              {recharges.map((item) => (
                <div key={item.id} className="bg-white rounded-xl shadow p-6 flex flex-col items-center border border-blue-100 hover:shadow-lg transition">
                  <div className="text-lg text-gray-500 mb-1">Price</div>
                  <div className="text-2xl font-bold text-blue-700 mb-2">₹{item.price}</div>
                  <div className="text-lg text-gray-500 mb-1">Points</div>
                  <div className="text-xl font-semibold text-green-600 mb-4">{item.credit}</div>
                  <button
                    className="mt-auto px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                    disabled={paying}
                    onClick={() => handleRecharge(item)}
                  >
                    Recharge
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
} 