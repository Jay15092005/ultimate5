// Advisors listing page for Ultimate Advisor Platform
// Shows a list of advisors with infinite scroll and a back button

"use client";
import AdvisorSection from "@/components/AdvisorSection";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { AdvisorCallHandler } from "@/components/AdvisorCallHandler";

// Main AdvisorsPage component
export default function AdvisorsPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-blue-50 dark:from-neutral-900 dark:to-blue-950 flex flex-col">
      <Navbar />
      <AdvisorCallHandler />
      <main className="flex-1 flex flex-col gap-8 py-8 px-2 md:px-0">
        {/* Back button to previous page */}
        <button
          onClick={() => router.back()}
          className="self-start ml-4 mt-4 mb-2 px-5 py-2 rounded-full border border-blue-600 text-blue-700 dark:text-blue-300 font-medium bg-white dark:bg-neutral-900 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          aria-label="Go back"
        >
          ← Go Back
        </button>
        {/* AdvisorSection handles advisor list and infinite scroll */}
        <AdvisorSection initialCount={30} batchCount={30} infiniteScroll={true} />
      </main>
    </div>
  );
} 