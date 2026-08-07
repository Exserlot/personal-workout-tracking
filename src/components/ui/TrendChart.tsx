export function TrendChart() {
  return (
    <figure className="min-w-0 border border-line bg-recessed p-4 tablet:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.05em] text-ink-muted">ESTIMATED 1RM</p>
          <p className="mt-2 text-data tabular-nums">84.2 <span className="text-xs text-ink-muted">KG</span></p>
        </div>
        <p className="text-xs text-ink-muted">12 WEEKS</p>
      </div>
      <svg
        viewBox="0 0 560 180"
        className="mt-6 block h-auto w-full"
        role="img"
        aria-labelledby="trend-title trend-desc"
      >
        <title id="trend-title">ตัวอย่างแนวโน้ม estimated one rep max</title>
        <desc id="trend-desc">ค่าตัวอย่างเพิ่มจาก 72 เป็น 84.2 กิโลกรัมในช่วง 12 สัปดาห์</desc>
        <path d="M0 30H560M0 90H560M0 150H560" stroke="rgb(var(--color-border-subtle))" strokeWidth="1" />
        <path
          d="M8 145 62 133 116 138 170 108 224 114 278 92 332 86 386 62 440 68 494 39 552 27"
          fill="none"
          stroke="rgb(var(--color-text-primary))"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="552" cy="27" r="5" fill="rgb(var(--color-accent))" />
      </svg>
      <figcaption className="mt-4 border-t border-line-subtle pt-3 text-sm leading-6 text-ink-secondary">
        Sample data: แนวโน้มเพิ่มขึ้น 12.2 kg; จุดล่าสุดเป็นเพียง placeholder และยังไม่เชื่อมฐานข้อมูล
      </figcaption>
    </figure>
  );
}
