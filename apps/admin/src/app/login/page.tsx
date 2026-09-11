import { OtpLoginForm } from "../../components/otp-login-form";

export default function LoginPage() {
  return (
    <main>
      <h1>Admin sign in</h1>
      <p className="lede">
        Local demo: request a code for <code>7010358490</code>, then enter <code>123456</code>.
      </p>
      <OtpLoginForm nextPath="/categories" />
    </main>
  );
}
