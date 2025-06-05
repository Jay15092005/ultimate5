import { supabase } from "../../../supabaseClient";
import React from "react";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: advisor } = await supabase
    .from('accounts')
    .select('full_name, bio')
    .eq('account_id', id)
    .maybeSingle();
  if (!advisor) {
    return {
      title: 'Advisor Not Found',
      description: 'This advisor profile does not exist.'
    };
  }
  return {
    title: `${advisor.full_name} - Advisor Profile | Ultimate Advisor Platform`,
    description: advisor.bio || `Connect with ${advisor.full_name}, a top advisor on Ultimate Advisor Platform.`
  };
}

export default async function AdvisorProfilePage({ params }: { params: { id: string } }) {
  const { id } = params;
  // Fetch advisor details
  const { data: advisor, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', id)
    .maybeSingle();
  if (error || !advisor) {
    return <div className="text-center py-16 text-red-500">Advisor not found.</div>;
  }
  // Fetch mapping tables
  const [expRes, rateRes, langRes] = await Promise.all([
    supabase.from('expertises').select('expertise_id, expertise_name'),
    supabase.from('rates_per_minute').select('rate_per_minute_id, rate_value'),
    supabase.from('languages').select('language_id, language_name'),
  ]);
  const expertises = Object.fromEntries((expRes.data || []).map((e: any) => [String(e.expertise_id), e.expertise_name]));
  const rates = Object.fromEntries((rateRes.data || []).map((r: any) => [String(r.rate_per_minute_id), r.rate_value]));
  const languages = Object.fromEntries((langRes.data || []).map((l: any) => [String(l.language_id), l.language_name]));
  // Expertise
  const expertiseNames = (advisor.expertise_id || "").split(',').map((id: string) => expertises[String(id)]).filter(Boolean).join(', ');
  // Languages
  const languageNames = (advisor.language_id || "").split(',').map((id: string) => languages[String(id)]).filter(Boolean).join(', ');
  // Rate
  const rate = rates[String(advisor.rate_per_minute_id)] ? `${rates[String(advisor.rate_per_minute_id)]} rs/min` : "-";
  // Render
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-neutral-50 to-blue-50 dark:from-neutral-900 dark:to-blue-950 py-12 px-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg p-8 max-w-xl w-full border border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-col items-center gap-6">
          <img
            src={advisor.profile_pic || "/next.svg"}
            alt={`Profile of ${advisor.full_name}`}
            className="w-32 h-32 rounded-full object-cover border-4 border-neutral-100 dark:border-neutral-800 shadow"
          />
          <h1 className="text-3xl font-bold mb-2">{advisor.full_name}</h1>
          <p className="text-lg text-neutral-500 mb-2">Status: {advisor.status}</p>
          <p className="text-md text-neutral-700 dark:text-neutral-300 mb-2">Expertise: {expertiseNames || '-'}</p>
          <p className="text-md text-neutral-700 dark:text-neutral-300 mb-2">Rate: {rate}</p>
          <p className="text-md text-neutral-700 dark:text-neutral-300 mb-2">Languages: {languageNames || '-'}</p>
          <p className="text-md text-neutral-700 dark:text-neutral-300 mb-2">Bio: {advisor.bio || '-'}</p>
          {/* Add more fields as needed */}
        </div>
      </div>
    </div>
  );
} 