import { Link } from "react-router-dom";
import { Input } from "../components/ui/Input";
import { buttonStyles } from "../components/ui/buttonStyles";

export function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-canvas tablet:grid-cols-8 desktop:grid-cols-12">
      <section className="flex min-h-[36vh] flex-col justify-between border-b border-line bg-recessed p-6 tablet:col-span-3 tablet:min-h-dvh tablet:border-b-0 tablet:border-r desktop:col-span-5 desktop:p-10">
        <div>
          <p className="text-2xl font-bold tracking-[-0.03em]">FORM</p>
          <p className="mt-1 text-[11px] font-semibold tracking-[0.08em] text-ink-muted">PERSONAL TRAINING SYSTEM</p>
        </div>
        <div className="mt-16 max-w-xl">
          <p className="text-xs font-semibold tracking-[0.08em] text-accent">P-01 · STATIC PREVIEW</p>
          <h1 className="mt-4 text-[36px] font-bold leading-10 tracking-[-0.03em] tablet:text-display-lg desktop:text-display-xl">ฝึกอย่างมีระบบ<br />เห็นความก้าวหน้าจริง</h1>
        </div>
      </section>
      <section className="flex items-center p-6 tablet:col-span-5 tablet:p-10 desktop:col-span-7 desktop:p-16">
        <div className="w-full max-w-md">
          <p className="text-xs font-semibold tracking-[0.08em] text-accent">PRIVATE OWNER ACCESS</p>
          <h2 className="mt-4 text-h1">เข้าสู่ระบบ</h2>
          <p className="mt-3 text-base leading-7 text-ink-secondary">Authentication ยังไม่ถูกติดตั้ง ปุ่มนี้เปิด static application shell เท่านั้น</p>
          <div className="mt-8 space-y-5">
            <Input label="อีเมล" type="email" defaultValue="owner@example.com" />
            <Input label="รหัสผ่าน" type="password" defaultValue="placeholder" />
            <Link to="/today" className={buttonStyles({ variant: "primary", size: "large", fullWidth: true })}>เปิด Static Preview</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
