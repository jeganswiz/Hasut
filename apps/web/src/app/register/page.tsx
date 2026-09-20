"use client";

import { AuthCard, HasutLogo } from "@hasut/ui";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RegisterForm } from "../../components/auth/register-form";

function Register() {
  const params = useSearchParams();
  return <RegisterForm nextPath={params.get("next") ?? "/me"} />;
}

export default function RegisterPage() {
  return (
    <AuthCard
      eyebrow={<HasutLogo size={20} />}
      title="Create your account"
      lede="One membership. Add a professional profile or a business later."
      footer="Your phone number and exact location are never shown to other members."
    >
      <Suspense>
        <Register />
      </Suspense>
    </AuthCard>
  );
}
