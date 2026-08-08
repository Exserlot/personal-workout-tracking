import { PageFrame } from "../components/layout/PageFrame";
import { Button } from "../components/ui/Button";
import { Divider } from "../components/ui/Divider";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { SectionHeader } from "../components/ui/SectionHeader";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export function SettingsPage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <PageFrame pageId="P-13" title="ตั้งค่าและการซิงก์" description="Component states และ preferences แบบ static placeholder">
      <div className="page-grid">
        <section className="col-span-4 min-w-0 space-y-8 tablet:col-span-5 desktop:col-span-7">
          <SectionHeader eyebrow="PREFERENCES" title="หน่วยและตัวจับเวลา" />
          <div className="grid gap-5 tablet:grid-cols-2">
            <Input label="หน่วยน้ำหนัก" value="Kilograms (kg)" readOnly helperText="รองรับ kg ใน MVP" />
            <Input label="เวลาพักเริ่มต้น" value="90" unit="SEC" readOnly />
          </div>
          <Divider />
          <SectionHeader eyebrow="COMPONENT PREVIEW" title="Button variants" />
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="quiet">Quiet</Button>
            <Button variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
          </div>
          <Divider />
          <SectionHeader eyebrow="OWNER ACCOUNT" title="บัญชีที่กำลังใช้งาน" />
          <div className="flex flex-col items-start justify-between gap-4 border-y border-line py-5 tablet:flex-row tablet:items-center">
            <div className="min-w-0">
              <p className="text-sm text-ink-muted">SIGNED IN AS</p>
              <p className="mt-1 break-all font-semibold text-ink">{session?.user.email}</p>
            </div>
            <Button variant="secondary" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
            </Button>
          </div>
        </section>
        <aside className="col-span-4 mt-10 tablet:col-span-3 tablet:mt-0 desktop:col-span-4 desktop:col-start-9">
          <EmptyState
            marker="SYNC"
            title="ยังไม่มีการเชื่อมต่อข้อมูล"
            description="สถานะ synced, pending, offline และ conflict จะเพิ่มใน feature implementation; foundation นี้ไม่มี database integration"
            action={<Button variant="secondary" disabled>Retry unavailable</Button>}
          />
        </aside>
      </div>
    </PageFrame>
  );
}
