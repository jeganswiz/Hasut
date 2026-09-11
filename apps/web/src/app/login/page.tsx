"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { OtpLoginForm } from "../../components/otp-login-form";

function LoginForm() {
  const params = useSearchParams();
  const nextPath = params.get("next") ?? "/connections";
  return <OtpLoginForm nextPath={nextPath} />;
}

export default function LoginPage() {
  return (
    <main>
      <h1>Sign in</h1>
      <p className="lede">
        Use phone OTP to connect and chat. Local demo: <code>7010358490</code> / <code>123456</code>
        . Phone numbers stay private.
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
