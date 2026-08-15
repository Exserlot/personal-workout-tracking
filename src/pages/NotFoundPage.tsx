import { Link } from "react-router-dom";
import { PageFrame } from "../components/layout/PageFrame";
import { EmptyState } from "../components/ui/EmptyState";
import { buttonStyles } from "../components/ui/buttonStyles";

export function NotFoundPage() {
  return (
    <PageFrame pageId="404" eyebrow="P-404 · NOT FOUND" title="ไม่พบหน้านี้" description="Route นี้ไม่ได้อยู่ใน MVP page inventory">
      <EmptyState
        marker="404"
        title="กลับไปยัง operational home"
        description="เลือก Today เพื่อดู static application foundation"
        action={<Link to="/today" className={buttonStyles()}>กลับไป Today</Link>}
      />
    </PageFrame>
  );
}
