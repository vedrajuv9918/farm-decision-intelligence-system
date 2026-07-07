import { AlertTriangle, ArrowLeftCircle, Eye, EyeOff, Leaf, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Field, inputClass } from "../components/ui";
import { ApiError, loginAccount, registerAccount } from "../services/api";

type AuthProps = {
  navigate: (path: string) => void;
  onLogin: (hasFarmProfile: boolean) => void;
  onRegister: () => void;
};

type AuthAlertProps = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  showForgot?: boolean;
};

function AuthAlert({
  title,
  body,
  actionLabel,
  onAction,
  showForgot
}: AuthAlertProps) {
  return (
    <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-red-800 shadow-sm transition-all duration-300 ease-out">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0" size={20} />
        <div className="min-w-0">
          <p className="font-display text-lg font-bold">{title}</p>
          <p className="mt-1 text-sm leading-6">{body}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {actionLabel && onAction ? (
              <button onClick={onAction} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">
                {actionLabel}
              </button>
            ) : null}
            {showForgot ? (
              <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">
                Forgot Password
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthShell({
  children,
  title,
  subtitle,
  onBack
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  return (
    <div className="relative grid min-h-screen bg-farm-bg lg:grid-cols-[0.9fr_1.1fr]">
      {onBack ? (
        <button
          onClick={onBack}
          className="absolute left-6 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-md hover:bg-slate-50 hover:text-slate-900 transition"
          title="Back to Landing Page"
        >
          <ArrowLeftCircle size={24} />
        </button>
      ) : null}
      <section className="flex items-center justify-center bg-farm-green px-6 py-10 text-white">
        <div className="max-w-xl">
          <div className="flex items-center gap-3">
            <Leaf size={36} />
            <span className="font-display text-4xl font-bold">FarmWise</span>
          </div>
          <h1 className="mt-8 font-display text-4xl font-bold leading-tight md:text-5xl">
            Smart Farming Decisions Powered by AI & Real-Time Data
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-green-50">
            A modular agriculture intelligence workspace for crops, markets, expenses, and climate risk.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-farm-green">Welcome</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  );
}

export function RegisterPage({ navigate, onRegister }: Pick<AuthProps, "navigate" | "onRegister">) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });

  async function submit() {
    if (!form.fullName.trim() || !form.email.includes("@") || form.password.length < 6) {
      setError("Enter your name, a valid email, and a password with at least 6 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await registerAccount({
        full_name: form.fullName,
        email: form.email,
        password: form.password
      });
      localStorage.setItem("farmwise_user", JSON.stringify(response.user));
      localStorage.removeItem("farmwise_profile");
      onRegister();
      navigate("/auth/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Register first, then sign in to create your farm profile." onBack={() => navigate("/")}>
      <div className="mt-7 space-y-4">
        <Field label="Full Name">
          <input className={inputClass} placeholder="Example: Ananya Rao" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputClass} placeholder="farmer@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </Field>
        <Field label="Password" helper="Use at least 6 characters.">
          <div className="relative">
            <input
              className={`${inputClass} pr-12`}
              placeholder="Create password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-500">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </Field>
        <Field label="Confirm Password">
          <input
            className={inputClass}
            placeholder="Re-enter password"
            type={showPassword ? "text" : "password"}
            value={form.confirmPassword}
            onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
          />
        </Field>
        {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}
        <button
          onClick={submit}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-farm-green px-4 py-3 font-semibold text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : null}
          {loading ? "Creating account..." : "Register Account"}
        </button>
        <button onClick={() => navigate("/auth/login")} className="w-full text-sm font-semibold text-farm-blue">
          Already have an account? Login
        </button>
      </div>
    </AuthShell>
  );
}

export function LoginPage({ navigate, onLogin }: Pick<AuthProps, "navigate" | "onLogin">) {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<{ kind: "validation" | "not_found" | "wrong_password" | "generic"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  async function submit() {
    if (!form.email.trim() || !form.email.includes("@")) {
      setError({ kind: "validation", message: "Enter a valid registered email address." });
      return;
    }
    if (form.password.length < 1) {
      setError({ kind: "validation", message: "Enter your password." });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await loginAccount({ email: form.email, password: form.password });
      if (!response.user) {
        setError({ kind: "generic", message: "Login failed. Please try again." });
        return;
      }
      localStorage.setItem("farmwise_session", JSON.stringify({ email: response.user.email, remember }));
      localStorage.setItem("farmwise_user", JSON.stringify(response.user));
      onLogin(response.user.has_farm_profile);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError({ kind: "not_found", message: "Account not found" });
      } else if (err instanceof ApiError && err.status === 401) {
        setError({ kind: "wrong_password", message: "Incorrect password" });
      } else {
        setError({ kind: "generic", message: err instanceof Error ? err.message : "Login failed. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Login to FarmWise" subtitle="Existing users go directly to the dashboard after login. New users complete farm setup once." onBack={() => navigate("/")}>
      <div className="mt-7 space-y-4">
        <Field label="Email">
          <input className={inputClass} placeholder="farmer@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </Field>
        <Field label="Password">
          <div className="relative">
            <input
              className={`${inputClass} pr-12`}
              placeholder="Enter password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-500">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </Field>
        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Remember me
          </label>
          <button className="font-semibold text-farm-blue">Forgot password?</button>
        </div>
        {error?.kind === "not_found" ? (
          <AuthAlert
            title="Account not found."
            body="This email is not registered with FarmWise."
            actionLabel="Create Account"
            onAction={() => navigate("/auth/register")}
          />
        ) : null}
        {error?.kind === "wrong_password" ? (
          <AuthAlert title="Incorrect password." body="Please try again." showForgot />
        ) : null}
        {error && !["not_found", "wrong_password"].includes(error.kind) ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition-all duration-300">{error.message}</p>
        ) : null}
        <button
          onClick={submit}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-farm-green px-4 py-3 font-semibold text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : null}
          {loading ? "Checking account..." : "Login"}
        </button>
        <button onClick={() => navigate("/auth/register")} className="w-full text-sm font-semibold text-farm-blue">
          New to FarmWise? Register
        </button>
      </div>
    </AuthShell>
  );
}
