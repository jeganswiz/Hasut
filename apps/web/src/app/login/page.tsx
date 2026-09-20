"use client";

import { AuthCard, HasutLogo } from "@hasut/ui";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SignInForm } from "../../components/auth/sign-in-form";

function SignIn() {
  const params = useSearchParams();
  return <SignInForm nextPath={params.get("next") ?? "/connections"} />;
}

export default function LoginPage() {
  return (
    <AuthCard
      eyebrow={<HasutLogo size={20} />}
      title="Welcome back"
      lede="Sign in to see who is nearby, connect, and chat."
      footer="Your phone number and exact location are never shown to other members."
    >
      <Suspense>
        <SignIn />
      </Suspense>
    </AuthCard>
  );
}
