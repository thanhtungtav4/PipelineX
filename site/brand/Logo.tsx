// The word mark (Market Decoded: mark + name) and ring mark of the site: Use Wordmark to draw the site name on the page (size is the height, the unit is pixels), RingMark is a small mark, and it is a loading animation when turned around.
// Use the site name for typing here; if you have your own logo, set SITE_LOGO_URL in .env or replace Wordmark with your SVG (keep the same parameters).
import { SITE } from "../site.ts";
import { useRouteLoaderData } from "react-router";

/** The channel's mark (brand/mark.svg): three candlesticks rising inside code brackets, on a navy disc. */
export function Mark({ className = "" }: { className?: string }) {
  const rootData = useRouteLoaderData("root") as { logoUrl?: string | null } | undefined;
  const logoUrl = rootData?.logoUrl ?? SITE.logoUrl;
  if (logoUrl) {
    return <img src={logoUrl} alt={SITE.name} className={className} />;
  }
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <circle cx="80" cy="80" r="80" fill="#0B2239" />
      <path d="M40 58 L28 80 L40 102 M120 58 L132 80 L120 102" fill="none" stroke="#5DCAA5" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M58 84v28M80 66v38" stroke="#9FB3C8" strokeWidth="4" strokeLinecap="round" />
      <rect x="51" y="90" width="14" height="16" rx="2" fill="#9FB3C8" /><rect x="73" y="72" width="14" height="24" rx="2" fill="#9FB3C8" />
      <path d="M102 44v48" stroke="#5DCAA5" strokeWidth="4" strokeLinecap="round" /><rect x="95" y="50" width="14" height="32" rx="2" fill="#5DCAA5" />
    </svg>
  );
}

export function Wordmark({ size = 24, className = "", title = SITE.name }: { size?: number; className?: string; title?: string }) {
  // "Market Decoded": the first word in ink, the rest in the accent colour.
  // If a custom logo URL is set (via SITE_LOGO_URL env or root loader), render it as an image.
  const rootData = useRouteLoaderData("root") as { logoUrl?: string | null } | undefined;
  const logoUrl = rootData?.logoUrl ?? SITE.logoUrl;
  if (logoUrl) {
    return (
      <span className={`inline-flex items-center ${className}`} aria-label={title} role="img">
        <img src={logoUrl} alt={title} style={{ height: size, width: "auto", maxWidth: size * 4 }} />
      </span>
    );
  }
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
