"use client";

import { AuthCard, HasutLogo } from "@hasut/ui";
import { ForgotPasswordForm } from "../../components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      eyebrow={<HasutLogo size={20} />}
      title="Reset your password"
      lede="Enter the phone number or email on your account and we will send a one-time code."
      footer="Setting a new password signs out every device that is still signed in."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
