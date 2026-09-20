import { AdminShell } from "../../components/admin-shell";
import { OtpLoginForm } from "../../components/otp-login-form";

export default function LoginPage() {
  return (
    <AdminShell
      section="login"
      title="Admin sign in"
      lede={
        <>
          Local demo: request a code for <code>7010358490</code>, then enter <code>123456</code>.
        </>
      }
    >
      <OtpLoginForm nextPath="/" />
    </AdminShell>
  );
}
