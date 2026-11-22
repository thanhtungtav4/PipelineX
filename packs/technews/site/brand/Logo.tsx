// The word mark (Điểm Tin Công Nghệ: mark + name) and ring mark of the site: Use Wordmark to draw the site name on the page (size is the height, the unit is pixels), RingMark is a small mark, and it is a loading animation when turned around.
// Use the site name for typing here; if you have your own logo, replace Wordmark with your SVG (keep the same parameters).
import { SITE } from "../site.ts";

/** The channel's mark (brand/mark.svg): two gold signal bars and a dot on a navy disc. */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <circle cx="80" cy="80" r="80" fill="#13204F" />
      <path d="M52 44v72M108 44v72" stroke="#F49F40" strokeWidth="10" strokeLinecap="round" />
      <circle cx="80" cy="80" r="13" fill="#F49F40" />
      <path d="M52 62h56M52 98h56" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

export function Wordmark({ size = 24, className = "", title = SITE.name }: { size?: number; className?: string; title?: string }) {
  // "Điểm Tin Công Nghệ": the first words in ink, the rest in the accent colour.
  const [first, ...rest] = SITE.name.split(" ");
  return (
    <span className={`inline-flex items-center font-black leading-none tracking-[-0.03em] ${className}`} style={{ fontSize: Math.round(size * 0.92) }} aria-label={title} role="img">
      <Mark className="mr-[0.32em] inline-block size-[1.15em] shrink-0" />
      <span aria-hidden="true" className="font-semibold">{first}</span>
      {rest.length > 0 && <span aria-hidden="true" className="ml-[0.25em] text-accent">{rest.join(" ")}</span>}
    </span>
  );
}

/** The small mark: the channel's mark at rest; spinning, a ring with a dot (the loader). */
export function RingMark({ className = "", spinning = false }: { className?: string; spinning?: boolean }) {
  if (!spinning) return <Mark className={className} />;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g style={spinning ? { transformOrigin: "12px 12px", animation: "spin-slow 1.1s linear infinite" } : undefined}>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="42 15" />
      </g>
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  );
}
