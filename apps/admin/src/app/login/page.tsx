import { AuthCard, HasutLogo } from "@hasut/ui";
import { StaffLoginForm } from "../../components/staff-login-form";

export default function LoginPage() {
  return (
    <AuthCard
      tone="staff"
      eyebrow={
        <>
          <HasutLogo size={18} />
          HASUT operations
        </>
      }
      title="Staff sign in"
      lede="Restricted console. Admin, support, and moderation only."
      footer="Every sign-in and moderation action is recorded in the audit log."
    >
      <StaffLoginForm nextPath="/" />
    </AuthCard>
  );
}
