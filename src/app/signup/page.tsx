import { LoginForm } from "@/components/login-form";
import { isDemoMode } from "@/lib/auth/config";

export default function SignupPage() {
  const demoEnabled = isDemoMode();

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="mb-10 text-center">
        <p className="mb-3 text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
          Create account
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-6xl tracking-[0.12em] text-[var(--pitch)] sm:text-7xl">
          PREGIT
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-[var(--muted)]">
          Register with email and password, or continue in demo mode.
        </p>
      </div>

      <LoginForm mode="signup" demoEnabled={demoEnabled} />
    </main>
  );
}
