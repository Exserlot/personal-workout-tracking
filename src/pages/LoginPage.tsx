import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuth } from "../features/auth/AuthContext";
import { AuthError } from "../features/auth/SupabaseAuthClient";

interface LoginLocationState {
  from?: string;
}

export function LoginPage() {
  const { signIn, status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const from = (location.state as LoginLocationState | null)?.from ?? "/today";

  if (status === "authenticated") return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("กรอกอีเมลและรหัสผ่านให้ครบ");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(caught instanceof AuthError ? caught.message : "เข้าสู่ระบบไม่สำเร็จ โปรดลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-canvas tablet:grid-cols-8 desktop:grid-cols-12">
      <section className="flex min-h-[36vh] flex-col justify-between border-b border-line bg-recessed p-6 tablet:col-span-3 tablet:min-h-dvh tablet:border-b-0 tablet:border-r desktop:col-span-5 desktop:p-10">
        <div>
          <p className="text-2xl font-bold tracking-[-0.03em]">FORM</p>
          <p className="mt-1 text-[11px] font-semibold tracking-[0.08em] text-ink-muted">PERSONAL TRAINING SYSTEM</p>
        </div>
        <div className="mt-16 max-w-xl">
          <p className="text-xs font-semibold tracking-[0.08em] text-accent">P-01 · OWNER ACCESS</p>
          <h1 className="mt-4 text-[36px] font-bold leading-10 tracking-[-0.03em] tablet:text-display-lg desktop:text-display-xl">
            ฝึกอย่างมีระบบ<br />เห็นความก้าวหน้าจริง
          </h1>
        </div>
      </section>
      <section className="flex items-center p-6 tablet:col-span-5 tablet:p-10 desktop:col-span-7 desktop:p-16">
        <div className="w-full max-w-md">
          <p className="text-xs font-semibold tracking-[0.08em] text-accent">PRIVATE OWNER ACCESS</p>
          <h2 className="mt-4 text-h1">เข้าสู่ระบบ</h2>
          <p className="mt-3 text-base leading-7 text-ink-secondary">
            ใช้บัญชี owner ที่สร้างไว้ใน Supabase ไม่มีการสมัครสมาชิกสาธารณะ
          </p>
          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            <Input
              label="อีเมล"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              label="รหัสผ่าน"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error ? (
              <p role="alert" className="border-l-2 border-error pl-3 text-sm leading-6 text-error">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="large" fullWidth disabled={submitting || status === "loading"}>
              {submitting ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
