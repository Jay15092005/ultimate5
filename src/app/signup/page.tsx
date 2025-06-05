// Signup page for Ultimate Advisor Platform
// Delegates to PhoneOtpSignupSection for client signup flow

"use client";
import PhoneOtpSignupSection from '../../components/PhoneOtpSignupSection';

// Main SignupPage component
export default function SignupPage() {
  return <PhoneOtpSignupSection initialUserType="client" />;
} 