import React from "react";
import { AbsoluteFill, Audio, Img, Loop, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Chart } from "./components/Chart";

export const FPS = 30;

type Word = { text: string; start: number; end: number };
type Visual = Record<string, any> & { type: string };
type Beat = { narration: string; visual: Visual; audio: string; start: number; duration: number; words: Word[] };
type Scene = { kind: string; kicker: string; headline: string; start: number; duration: number; beats: Beat[] };
export type Palette = { accent: string; accent2: string; kicker: string };
export type Brand = { name: string; label: string; tagline: string; mark?: string };
export type Timeline = { title: string; total: number; scenes: Scene[]; sources?: Array<{ n: number; name: string; title?: string }>; music?: string | null; date?: string;
  style?: string; palette?: Palette | null; brand?: Brand; mainTitle?: string; mainVideo?: { title?: string; url?: string; id?: string } };
import channelProfile from "../../industry/channel.json";

/** The channel's brand on the cards: the running checkout's channel profile (industry/channel.json) — the
 *  same profile the voice step reads for the timeline's brand, which still wins when a render passes one.
 *  Only name/label/tagline are taken: the profile's mark is a path inside the industry folder, and the voice
 *  step copies it into the video's public folder only for real renders, so a bare preview keeps the dot. */
const PROFILE_BRAND = (channelProfile as { brand?: Partial<Brand> }).brand ?? {};
export const DEFAULT_BRAND: Brand = {
  name: PROFILE_BRAND.name ?? "PipelineX",
  label: PROFILE_BRAND.label ?? "AI NEWS",
  tagline: PROFILE_BRAND.tagline ?? "The AI news that matters, every day.",
};

/** The channel's mark (brand.mark, copied into the video's public folder by the voice step), else a dot. */
export const BrandMark = ({ brand, size, color }: { brand: Brand; size: number; color: string }) =>
  brand.mark ? <Img src={staticFile(brand.mark)} style={{ width: size, height: size, flexShrink: 0 }} />
    : <div style={{ width: size * 0.5, height: size * 0.5, borderRadius: size, background: color, flexShrink: 0 }} />;

/** Branded opening and the end card, around the narrated part (seconds). */
export const INTRO = 3;
export const OUTRO = 7;

const C = { bg: "#0b0f17", panel: "#141b2b", paper: "#f7f5ef", ink: "#f4f6fb", dark: "#111317", dim: "#8b95a8", accent: "#36d399", hot: "#ff5c5c", line: "#1f2838" };
const SANS = "Inter, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'New York', Georgia, 'Times New Roman', serif";
const BRAND: Record<string, string> = { "The Verge": "#5200ff", TechCrunch: "#0a9e01", "MIT Technology Review": "#e3122c" };

const useSpring = (delay = 0) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping: 200 } });
};
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

const Grid = () => {
  const f = useCurrentFrame();
  const shift = (f * 0.4) % 80;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
        backgroundSize: "80px 80px", backgroundPosition: `${shift}px ${shift}px`, opacity: 0.5 }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${35 + 10 * Math.sin(f / 90)}% 40%, ${C.accent}24, transparent 55%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${75 - 8 * Math.cos(f / 100)}% ${65 + 6 * Math.sin(f / 80)}%, ${C.hot}16, transparent 50%)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(4,6,11,0.7) 100%)" }} />
    </AbsoluteFill>
  );
};

// ── Visual beats ─────────────────────────────────────────────────────────────

/** Behind the words of a text beat: the video's nearest picture (assets.ts sets visual.backdrop), blurred and darkened
 * so the words stay readable, with a slow drift; without one, the grid. */
const Backdrop = ({ v }: { v: Visual }) => {
  const f = useCurrentFrame();
  if (!v.backdrop?.file) return <Grid />;
  const z = 1.08 + f * 0.0004;
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})`, filter: "blur(10px) saturate(0.85) brightness(0.55)" };
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      {v.backdrop.kind === "video" ? <OffthreadVideo src={staticFile(v.backdrop.file)} muted style={style} /> : <Img src={staticFile(v.backdrop.file)} style={style} />}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.bg}b3 0%, ${C.bg}73 45%, ${C.bg}cc 100%)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 35%, rgba(4,6,11,0.75) 100%)" }} />
    </AbsoluteFill>
  );
};


/** Full-bleed photo with a slow Ken Burns move and an on-screen credit. */
const PhotoBeat = ({ v, frames, index }: { v: Visual; frames: number; index: number }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, frames], [0, 1], { extrapolateRight: "clamp" });
  const dir = index % 2 === 0 ? 1 : -1;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {v.asset.kind === "video" ? (
        // Stock clip: muted, slight push-in, looped if shorter than the beat.
        <Loop durationInFrames={Math.max(1, Math.floor((v.asset.duration ?? 10) * FPS))}>
          <OffthreadVideo src={staticFile(v.asset.file)} muted style={{ width: "100%", height: "100%", objectFit: "cover",
            transform: `scale(${1.02 + 0.04 * p})` }} />
        </Loop>
      ) : (
        <Img src={staticFile(v.asset.file)} style={{ width: "100%", height: "100%", objectFit: "cover",
          transform: `scale(${1.06 + 0.08 * p}) translateX(${dir * (p - 0.5) * 40}px)` }} />
      )}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.75) 100%)" }} />
      {v.type === "illustration" ? (
        // An AI-made illustration is always labelled, clearly, for the whole beat.
        <div style={{ position: "absolute", right: 40, top: 110, fontFamily: SANS, fontSize: 26, fontWeight: 800, letterSpacing: 2, color: "#0b0f17",
          background: "rgba(255,255,255,0.88)", padding: "8px 18px", borderRadius: 10 }}>AI ILLUSTRATION</div>
      ) : (
        <div style={{ position: "absolute", right: 40, bottom: 28, color: "rgba(255,255,255,0.75)", fontFamily: SANS, fontSize: 18 }}>
          {v.asset.kind === "video" ? "Video" : "Photo"}: {v.asset.credit} · {v.asset.license}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** A news article as a paper card: outlet, date, headline and an optional highlighted quote. */
const ArticleBeat = ({ v }: { v: Visual }) => {
  const enter = useSpring();
  const hl = useSpring(20);
  const brand = BRAND[v.name] ?? C.hot;
  return (
    <AbsoluteFill>
      <Backdrop v={v} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 1360, background: C.paper, borderRadius: 18, padding: "56px 72px", boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
          transform: `translateY(${(1 - enter) * 80}px) rotate(${(1 - enter) * -2}deg)`, opacity: enter }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: SANS }}>
            <div style={{ background: brand, color: "white", fontWeight: 900, fontSize: 30, padding: "6px 16px", borderRadius: 6 }}>{v.name}</div>
            <div style={{ color: "#5c6170", fontSize: 26 }}>{fmtDate(v.date)}</div>
          </div>
          <div style={{ marginTop: 30, fontFamily: SERIF, fontWeight: 700, fontSize: 64, lineHeight: 1.12, color: C.dark }}>{v.headline}</div>
          {v.quote && (
            <div style={{ marginTop: 34, fontFamily: SERIF, fontSize: 38, lineHeight: 1.4, color: "#2a2d35" }}>
              <span style={{ backgroundImage: `linear-gradient(transparent 55%, rgba(54,211,153,0.55) 55%)`,
                backgroundSize: `${hl * 100}% 100%`, backgroundRepeat: "no-repeat" }}>“{v.quote}”</span>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A direct quote, revealed word by word, with the speaker and perspective indicator. */
const QuoteBeat = ({ v, frames }: { v: Visual; frames: number }) => {
  const f = useCurrentFrame();
  const words = String(v.text).split(/\s+/);
  const shown = Math.ceil(interpolate(f, [8, Math.min(frames * 0.6, 90)], [0, words.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const by = useSpring(20);
  const perspective = v.perspective || (v.conflict ? "Disputed Perspective" : undefined);
  return (
    <AbsoluteFill>
      <Backdrop v={v} />
      <AbsoluteFill style={{ padding: "0 200px", justifyContent: "center", fontFamily: SERIF }}>
        {perspective && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, alignSelf: "flex-start",
            background: "rgba(10,16,28,0.85)", border: `2px solid ${C.hot}`, color: C.hot,
            padding: "8px 20px", borderRadius: 8, fontFamily: SANS, fontSize: 24, fontWeight: 900,
            letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: C.hot }} />
            {perspective}
          </div>
        )}
        <div style={{ color: C.accent, fontSize: 220, lineHeight: 0.6, height: 110 }}>“</div>
        <div style={{ color: C.ink, fontSize: 72, lineHeight: 1.2, fontWeight: 600 }}>
          {words.map((w, i) => <span key={i} style={{ opacity: i < shown ? 1 : 0.12 }}>{w} </span>)}
        </div>
        <div style={{ marginTop: 44, display: "flex", alignItems: "center", gap: 28, fontFamily: SANS, color: C.dim, fontSize: 36, opacity: by }}>
          {v.portrait?.file && (
            <Img src={staticFile(v.portrait.file)} style={{ width: 150, height: 150, borderRadius: 75, objectFit: "cover", objectPosition: "50% 25%",
              border: `4px solid ${C.accent}`, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", transform: `scale(${0.85 + 0.15 * by})` }} />
          )}
          <div>— {v.speaker}{v.portrait?.credit && <div style={{ marginTop: 8, fontSize: 18, color: "rgba(255,255,255,0.55)" }}>Photo: {v.portrait.credit} · {v.portrait.license}</div>}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** One big number, counted up, with its label. */
const StatBeat = ({ v }: { v: Visual }) => {
  const f = useCurrentFrame();
  const m = String(v.value).match(/^(\D*)([\d,.]+)(.*)$/);
  const target = m ? Number(m[2].replace(/,/g, "")) : 0;
  const decimals = m && m[2].includes(".") ? m[2].split(".")[1].length : 0;
  const cur = interpolate(f, [0, 36], [0, target], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const text = m ? `${m[1]}${cur.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${m[3]}` : v.value;
  const lab = useSpring(14);
  return (
    <AbsoluteFill>
      <Backdrop v={v} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: SANS, textAlign: "center" }}>
        <div style={{ color: C.accent, fontSize: 230, fontWeight: 900, letterSpacing: -6, textShadow: `0 0 60px ${C.accent}44, 0 10px 40px rgba(0,0,0,0.6)` }}>{text}</div>
        <div style={{ color: C.ink, fontSize: 52, fontWeight: 600, maxWidth: 1300, opacity: lab, transform: `translateY(${(1 - lab) * 30}px)` }}>{v.label}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A data series: bars for a few values, an animated line for a longer series (official data: 8-12 months or
 * quarters), the change between first and last (points for a rate, percent otherwise) and the source. */
const ChartBeat = ({ v, frames = 120 }: { v: Visual; frames?: number }) => {
  return (
    <AbsoluteFill>
      <Backdrop v={v} />
      <AbsoluteFill style={{ padding: "160px 200px 200px", justifyContent: "center" }}>
        <Chart v={v} frames={frames} isVertical={false} accentColor={C.accent} hotColor={C.hot} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Cause and effect: 3-5 short steps joined by arrows, each lighting up in turn. */
const FlowBeat = ({ v, frames }: { v: Visual; frames: number }) => {
  const f = useCurrentFrame();
  const steps = (v.steps as string[]).slice(0, 5);
  const each = Math.max(12, Math.min(36, (frames * 0.6) / steps.length));
  return (
    <AbsoluteFill>
      <Backdrop v={v} />
      <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center", fontFamily: SANS }}>
        {v.title && <div style={{ color: C.accent, fontSize: 34, fontWeight: 800, letterSpacing: 4, marginBottom: 50, textTransform: "uppercase" }}>{v.title}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {steps.map((step, i) => {
            const on = interpolate(f, [i * each, i * each + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
            return (
              <React.Fragment key={i}>
                {i > 0 && <div style={{ color: C.accent, fontSize: 80, fontWeight: 900, opacity: on, transform: `translateX(${(1 - on) * -20}px)` }}>→</div>}
                <div style={{ flex: 1, minHeight: 230, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "28px 26px",
                  borderRadius: 22, background: "rgba(10,16,28,0.72)", border: `3px solid ${i === steps.length - 1 ? C.hot : C.accent}`,
                  color: C.ink, fontSize: steps.length > 4 ? 38 : 46, fontWeight: 750, lineHeight: 1.2, opacity: on, transform: `translateY(${(1 - on) * 30}px) scale(${0.94 + 0.06 * on})` }}>{step}</div>
              </React.Fragment>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Two figures side by side (expected vs reported, this year vs last, one company vs another), sized to scale. */
const VersusBeat = ({ v }: { v: Visual }) => {
  const sides = [v.left, v.right] as Array<{ name: string; value: string }>;
  const nums = sides.map((x) => Number(String(x.value).replace(/[^0-9.-]/g, "")) || 0);
  const max = Math.max(...nums.map(Math.abs), 1);
  const grow = useSpring(8);
  return (
    <AbsoluteFill>
      <Backdrop v={v} />
      <AbsoluteFill style={{ padding: "150px 220px 200px", justifyContent: "center", fontFamily: SANS }}>
        {v.label && <div style={{ color: C.ink, fontSize: 54, fontWeight: 800, marginBottom: 60, textAlign: "center" }}>{v.label}</div>}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 160, height: 520 }}>
          {sides.map((side, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", width: 420 }}>
              <div style={{ color: i === 1 ? C.accent : C.ink, fontSize: 92, fontWeight: 900, marginBottom: 18, opacity: grow }}>{side.value}</div>
              <div style={{ width: "100%", height: `${(Math.abs(nums[i]!) / max) * 62 * grow}%`, minHeight: 12, borderRadius: "18px 18px 0 0",
                background: i === 1 ? C.accent : "rgba(255,255,255,0.35)" }} />
              <div style={{ marginTop: 22, color: C.dim, fontSize: 40, fontWeight: 700, textAlign: "center" }}>{side.name}</div>
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A value against a target or a range (inflation against the Fed's 2% goal): a needle on an arc. */
const GaugeBeat = ({ v }: { v: Visual }) => {
  const value = Number(v.value), target = Number(v.target);
  const top = Number(v.max ?? Math.max(value, target) * 1.6), low = Number(v.min ?? 0);
  const t = useSpring(10);
  const angle = (x: number) => Math.PI * (1 - Math.min(1, Math.max(0, (x - low) / (top - low || 1))));
  const R = 330, cx = 400, cy = 400;
  const point = (a: number, r = R) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  const needle = angle(low + (value - low) * t);
  const [nx, ny] = point(needle, R - 40);
  const [tx, ty] = point(angle(target), R + 46);
  const [tx1, ty1] = point(angle(target), R - 26), [tx2, ty2] = point(angle(target), R + 26);
  const unit = v.unit ?? "";
  return (
    <AbsoluteFill>
      <Backdrop v={v} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: SANS }}>
        <svg width={800} height={470} viewBox="0 0 800 470" style={{ overflow: "visible" }}>
          <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={46} strokeLinecap="round" />
          <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${point(needle)[0]} ${point(needle)[1]}`} fill="none" stroke={value > target ? C.hot : C.accent} strokeWidth={46} strokeLinecap="round" />
          <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke={C.ink} strokeWidth={8} />
          <text x={tx} y={ty} fill={C.ink} fontSize={34} fontWeight={700} textAnchor="middle">{v.targetLabel ?? "Target"} {target}{unit}</text>
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.ink} strokeWidth={12} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={22} fill={C.ink} />
        </svg>
        <div style={{ marginTop: -10, color: value > target ? C.hot : C.accent, fontSize: 130, fontWeight: 900 }}>{(value * t).toFixed(String(v.value).split(".")[1]?.length ?? 0)}{unit}</div>
        <div style={{ color: C.ink, fontSize: 50, fontWeight: 700, maxWidth: 1400, textAlign: "center" }}>{v.label}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Dated events appearing one after another on a line. */
const TimelineBeat = ({ v, frames }: { v: Visual; frames: number }) => {
  const f = useCurrentFrame();
  const ev = v.events as Array<{ date: string; text: string }>;
  const step = Math.max(10, Math.min(30, (frames * 0.6) / ev.length));
  const line = interpolate(f, [0, step * ev.length], [0, 100], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Backdrop v={v} />
      <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center", fontFamily: SANS }}>
        <div style={{ position: "relative", height: 360 }}>
          <div style={{ position: "absolute", top: 120, left: 0, height: 6, width: `${line}%`, background: C.accent, borderRadius: 3 }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {ev.map((e, i) => {
              const s = spring({ frame: f - i * step, fps: FPS, config: { damping: 200 } });
              return (
                <div key={i} style={{ width: `${90 / ev.length}%`, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
                  <div style={{ color: C.accent, fontSize: 40, fontWeight: 900, height: 90 }}>{e.date}</div>
                  <div style={{ width: 34, height: 34, borderRadius: 17, background: C.accent, border: `6px solid ${C.bg}`, marginTop: 8 }} />
                  <div style={{ color: C.ink, fontSize: 36, fontWeight: 600, marginTop: 34, lineHeight: 1.25 }}>{e.text}</div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A comparison table / side-by-side card for specs, benchmarks, pricing or versions. */
const ComparisonBeat = ({ v }: { v: Visual }) => {
  const enter = useSpring();
  const leftLabel = v.left_label ?? v.left?.label ?? "Option A";
  const rightLabel = v.right_label ?? v.right?.label ?? "Option B";
  const items: Array<{ label: string; left: string; right: string }> = v.items ?? (
    v.left && v.right ? [{ label: v.metric ?? "Value", left: String(v.left.value ?? v.left), right: String(v.right.value ?? v.right) }] : []
  );

  return (
    <AbsoluteFill>
      <Backdrop v={v} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 140px", fontFamily: SANS }}>
        <div style={{ width: "100%", maxWidth: 1400, opacity: enter, transform: `translateY(${(1 - enter) * 40}px)` }}>
          {v.title && (
            <div style={{ color: C.ink, fontSize: 52, fontWeight: 900, marginBottom: 36, textAlign: "center", letterSpacing: -1 }}>
              {v.title}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 16, marginBottom: 16, padding: "0 24px" }}>
            <div />
            <div style={{ color: C.dim, fontSize: 30, fontWeight: 800, textAlign: "center", textTransform: "uppercase", letterSpacing: 2 }}>{leftLabel}</div>
            <div style={{ color: C.accent, fontSize: 30, fontWeight: 800, textAlign: "center", textTransform: "uppercase", letterSpacing: 2 }}>{rightLabel}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {items.map((row, i) => {
              const rowEnter = useSpring(10 + i * 8);
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", alignItems: "center", gap: 16,
                  background: "linear-gradient(135deg, rgba(20, 27, 43, 0.94), rgba(12, 16, 26, 0.96))", border: `1px solid ${C.line}`,
                  padding: "20px 28px", borderRadius: 14, opacity: rowEnter, transform: `translateX(${(1 - rowEnter) * -20}px)` }}>
                  <div style={{ color: C.ink, fontSize: 32, fontWeight: 700 }}>{row.label}</div>
                  <div style={{ color: C.dim, fontSize: 32, fontWeight: 600, textAlign: "center" }}>{row.left}</div>
                  <div style={{ color: C.accent, fontSize: 34, fontWeight: 800, textAlign: "center" }}>{row.right}</div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A stylized developer terminal/code window with syntax accent. */
const CodeBeat = ({ v, frames }: { v: Visual; frames: number }) => {
  const enter = useSpring();
  const f = useCurrentFrame();
  const codeLines: string[] = typeof v.code === "string" ? v.code.split("\n") : Array.isArray(v.code) ? v.code : [String(v.snippet ?? "")];
  const shownLines = Math.min(codeLines.length, Math.ceil(interpolate(f, [10, Math.min(frames * 0.7, 90)], [1, codeLines.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));

  return (
    <AbsoluteFill>
      <Backdrop v={v} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 120px", fontFamily: SANS }}>
        <div style={{ width: "100%", maxWidth: 1360, background: "#0e131d", borderRadius: 18, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 100px rgba(0,0,0,0.7)", opacity: enter, transform: `scale(${0.96 + 0.04 * enter})` }}>
          <div style={{ background: "#161c28", padding: "16px 24px", display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: "#ff5f56" }} />
              <div style={{ width: 14, height: 14, borderRadius: 7, background: "#ffbd2e" }} />
              <div style={{ width: 14, height: 14, borderRadius: 7, background: "#27c93f" }} />
            </div>
            <div style={{ flex: 1, textAlign: "center", color: C.dim, fontSize: 22, fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
              {v.title ?? v.filename ?? "terminal ~ zsh"}
            </div>
          </div>
          <div style={{ padding: "36px 44px", fontFamily: "'SF Mono', Monaco, Menlo, Consolas, monospace", fontSize: 32, lineHeight: 1.6, color: C.ink }}>
            {codeLines.slice(0, shownLines).map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 24 }}>
                <span style={{ color: "#475266", userSelect: "none", width: 40, textAlign: "right", fontSize: 26 }}>{i + 1}</span>
                <span style={{ color: line.startsWith("$") || line.startsWith("#") ? C.accent : line.includes("import") || line.includes("export") || line.includes("const") ? "#ff79c6" : C.ink }}>
                  {line}
                </span>
              </div>
            ))}
            {shownLines < codeLines.length && (
              <span style={{ display: "inline-block", width: 12, height: 26, background: C.accent, marginLeft: 64, opacity: Math.sin(f / 4) > 0 ? 1 : 0 }} />
            )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Semantic vector icon for structured card items */
const CardIcon = ({ text, index }: { text: string; index: number }) => {
  const lower = text.toLowerCase();
  if (lower.includes("pay") || lower.includes("card") || lower.includes("purchase") || lower.includes("bill") || lower.includes("$") || lower.includes("cost") || lower.includes("fee")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />
      </svg>
    );
  }
  if (lower.includes("security") || lower.includes("safe") || lower.includes("privacy") || lower.includes("isolated") || lower.includes("virtual machine") || lower.includes("vm")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      </svg>
    );
  }
  if (lower.includes("call") || lower.includes("phone") || lower.includes("voice") || lower.includes("speak") || lower.includes("dealership")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    );
  }
  if (lower.includes("app") || lower.includes("mobile") || lower.includes("toggle") || lower.includes("device") || lower.includes("account")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" />
      </svg>
    );
  }
  if (lower.includes("cap") || lower.includes("limit") || lower.includes("setting") || lower.includes("control") || lower.includes("spend")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" />
        <line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" />
        <line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" />
        <line x1="2" x2="6" y1="14" y2="14" /><line x1="10" x2="14" y1="8" y2="8" /><line x1="18" x2="22" y1="16" y2="16" />
      </svg>
    );
  }
  if (lower.includes("allow") || lower.includes("check") || lower.includes("opt") || lower.includes("feedback") || lower.includes("disconnect") || lower.includes("confirm")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  }
  return <span>{index + 1}</span>;
};

/** Key takeaways or structured points card. */
const CardBeat = ({ v }: { v: Visual }) => {
  const enter = useSpring();
  const items: string[] = Array.isArray(v.items) ? v.items : typeof v.text === "string" ? [v.text] : [];

  return (
    <AbsoluteFill>
      <Backdrop v={v} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 160px", fontFamily: SANS }}>
        <div style={{ width: "100%", maxWidth: 1300, opacity: enter, transform: `translateY(${(1 - enter) * 30}px)` }}>
          {v.title && (
            <div style={{ color: C.accent, fontSize: 34, fontWeight: 900, letterSpacing: 4, textTransform: "uppercase", marginBottom: 30 }}>
              {v.title}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {items.map((item, i) => {
              const itemEnter = useSpring(8 + i * 8);
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 24,
                  background: "linear-gradient(135deg, rgba(20, 27, 43, 0.94), rgba(12, 16, 26, 0.96))",
                  border: `1px solid ${C.line}`, padding: "26px 36px", borderRadius: 16,
                  opacity: itemEnter, transform: `translateX(${(1 - itemEnter) * -20}px)` }}>
                  <div style={{ width: 48, height: 48, borderRadius: 24, background: `${C.accent}22`, border: `2px solid ${C.accent}`,
                    color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, flexShrink: 0,
                    boxShadow: `0 0 16px ${C.accent}28` }}>
                    <CardIcon text={item} index={i} />
                  </div>
                  <div style={{ color: C.ink, fontSize: 38, fontWeight: 600, lineHeight: 1.35, paddingTop: 4 }}>{item}</div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Spoken phrases split like the captions: a new one at a pause or after `max` words. */
const phrasesOf = (words: Word[], max = 7) => {
  const groups: Word[][] = [];
  for (const w of words) {
    const cur = groups[groups.length - 1]; const prev = cur?.[cur.length - 1];
    if (!cur || cur.length >= max || (prev && w.start - prev.end > 0.18)) groups.push([w]); else cur.push(w);
  }
  return groups;
};

/**
 * Kinetic text: the narration itself, large, phrase by phrase, each word lighting up as it is spoken. Used when a
 * beat has no picture (none fitted, or the same article was already shown), so the screen always says what is heard.
 */
const KineticBeat = ({ scene, beat }: { scene: Scene; beat: Beat }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const groups = phrasesOf(beat.words, 9);
  const gi = Math.max(0, groups.findIndex((g) => t <= g[g.length - 1]!.end + 0.25));
  const g = groups[gi] ?? groups[groups.length - 1] ?? [];
  const enter = spring({ frame: f - Math.round((g[0]?.start ?? 0) * FPS), fps: FPS, config: { damping: 200 } });
  return (
    <AbsoluteFill>
      <Backdrop v={beat.visual} />
      <AbsoluteFill style={{ padding: "0 160px", justifyContent: "center", fontFamily: SANS }}>
        <div style={{ color: C.accent, fontSize: 30, fontWeight: 800, letterSpacing: 6, marginBottom: 28 }}>{scene.kicker.toUpperCase()}</div>
        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.12, maxWidth: 1600, opacity: enter, transform: `translateY(${(1 - enter) * 30}px)` }}>
          {g.map((w, i) => (
            <span key={i} style={{ color: t >= w.start - 0.05 ? (t <= w.end + 0.1 ? C.accent : C.ink) : "rgba(244,246,251,0.22)" }}>{w.text} </span>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A slow push on graphic beats, so no frame stands still. */
const Push = ({ frames, children }: { frames: number; children: React.ReactNode }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, frames], [1, 1.045], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ transform: `scale(${z})` }}>{children}</AbsoluteFill>;
};

/** Opening: channel mark, date and the video's title. */
const Intro = ({ title, date, brand }: { title: string; date?: string; brand: Brand }) => {
  const f = useCurrentFrame();
  const a = spring({ frame: f, fps: FPS, config: { damping: 200 } });
  const b = spring({ frame: f - 10, fps: FPS, config: { damping: 200 } });
  const out = interpolate(f, [INTRO * FPS - 10, INTRO * FPS], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Grid />
      <AbsoluteFill style={{ padding: "0 160px", justifyContent: "center", fontFamily: SANS }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: a, transform: `translateX(${(1 - a) * -40}px)` }}>
          <BrandMark brand={brand} size={72} color={C.hot} />
          <div style={{ color: C.ink, fontWeight: 900, fontSize: 44, letterSpacing: 8 }}>{brand.name.toUpperCase()}</div>
          <div style={{ color: C.dim, fontSize: 36, letterSpacing: 4 }}>{brand.label}{date ? ` · ${date}` : ""}</div>
        </div>
        <div style={{ marginTop: 40, color: C.ink, fontSize: 96, fontWeight: 900, lineHeight: 1.05, maxWidth: 1600, opacity: b, transform: `translateY(${(1 - b) * 40}px)` }}>{title}</div>
        <div style={{ marginTop: 48, height: 8, width: `${interpolate(f, [10, INTRO * FPS], [0, 100], { extrapolateRight: "clamp" })}%`, background: C.accent, borderRadius: 4 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** End card: the sources the video was made from, and the invitation to subscribe. */
const Outro = ({ sources, brand }: { sources: Array<{ n: number; name: string; title?: string }>; brand: Brand }) => {
  const f = useCurrentFrame();
  const a = spring({ frame: f, fps: FPS, config: { damping: 200 } });
  // Background pages are listed by site ("cnbc.com (background)"): show the site once, without the label.
  const outlets = [...new Set(sources.map((s) => s.name.replace(/\s*\(background\)$/, "")))];
  return (
    <AbsoluteFill>
      <Grid />
      <AbsoluteFill style={{ padding: "120px 160px", fontFamily: SANS, justifyContent: "center", opacity: a }}>
        <div style={{ color: C.accent, fontSize: 30, fontWeight: 800, letterSpacing: 6 }}>SOURCES</div>
        <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 16, maxWidth: 1600 }}>
          {outlets.map((o, i) => {
            const s = spring({ frame: f - 6 - i * 3, fps: FPS, config: { damping: 200 } });
            return <div key={o} style={{ color: C.ink, fontSize: 34, fontWeight: 600, padding: "10px 22px", borderRadius: 10, background: C.panel, border: `1px solid ${C.line}`, opacity: s }}>{o}</div>;
          })}
        </div>
        <div style={{ marginTop: 90, display: "flex", alignItems: "center", gap: 32 }}>
          {brand.mark && <BrandMark brand={brand} size={132} color={C.hot} />}
          <div style={{ color: C.ink, fontSize: 84, fontWeight: 900 }}>{brand.tagline}</div>
        </div>
        <div style={{ marginTop: 34, display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 18, background: C.hot, color: "white",
          fontSize: 44, fontWeight: 900, padding: "18px 40px", borderRadius: 14, transform: `scale(${1 + 0.03 * Math.sin(f / 8)})` }}>Subscribe</div>
        <div style={{ marginTop: 26, color: C.dim, fontSize: 30 }}>Links to every report are in the description.</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Overlays ────────────────────────────────────────────────────────────────

const Header = ({ at, total, brand }: { at: number; total: number; brand: Brand }) => {
  const f = useCurrentFrame();
  const pct = Math.min(100, (at / total) * 100);
  return (
    <div style={{ position: "absolute", top: 40, left: 64, right: 64, display: "flex", alignItems: "center", gap: 16, fontFamily: SANS }}>
      {brand.mark ? <BrandMark brand={brand} size={40} color={C.hot} /> : (
        <div style={{ position: "relative", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", width: "100%", height: "100%", borderRadius: 7, background: C.hot, opacity: 0.8 }} />
          <div style={{ position: "absolute", width: "180%", height: "180%", borderRadius: 14, background: C.hot, opacity: 0.3 * (1 + Math.sin(f / 6)) }} />
        </div>
      )}
      <div style={{ color: C.ink, fontWeight: 800, fontSize: 24, letterSpacing: 3, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>{brand.name.toUpperCase()}</div>
      <div style={{ color: "#c6ccd8", fontSize: 22, letterSpacing: 2, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>{brand.label}</div>
      <div style={{ flex: 1 }} />
      <div style={{ width: 300, height: 6, background: "rgba(255,255,255,0.18)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${C.accent}, ${C.hot})`, borderRadius: 3 }} />
      </div>
    </div>
  );
};

/** Scene label: kicker + headline, shown for the first seconds of every scene. */
const LowerThird = ({ scene }: { scene: Scene }) => {
  const f = useCurrentFrame();
  const inn = spring({ frame: f, fps: FPS, config: { damping: 200 } });
  const out = interpolate(f, [4.5 * FPS, 5 * FPS], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 64, top: 104, fontFamily: SANS, opacity: inn * out, transform: `translateX(${(1 - inn) * -60}px)` }}>
      <div style={{ display: "inline-block", background: scene.kind === "hook" ? C.hot : C.accent, color: "#06110c", fontWeight: 900,
        fontSize: 26, letterSpacing: 4, padding: "8px 18px", borderRadius: 6, boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>
        {scene.kicker.toUpperCase()}
      </div>
      <div style={{ marginTop: 10, background: "linear-gradient(135deg, rgba(8, 12, 20, 0.95), rgba(4, 6, 10, 0.97))",
        border: "1px solid rgba(255,255,255,0.12)",
        color: C.ink, fontWeight: 800, fontSize: 40, padding: "12px 24px", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
        {scene.headline}
      </div>
    </div>
  );
};

/** Captions: one line per speech phrase (break at pauses or after 7 words), the spoken word highlighted, with optional perspective cue. */
const Captions = ({ words, perspective }: { words: Word[]; perspective?: string }) => {
  const t = useCurrentFrame() / FPS;
  if (!words || !words.length) return null;
  const groups = phrasesOf(words);
  const g = groups.find((grp) => t >= grp[0]!.start - 0.05 && t <= grp[grp.length - 1]!.end + 0.25);
  if (!g) return null;
  return (
    <div style={{ position: "absolute", bottom: 64, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontFamily: SANS, zIndex: 40 }}>
      {perspective && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(10, 16, 28, 0.90)",
          border: `1.5px solid ${C.accent}`, color: C.accent, fontSize: 20, fontWeight: 800, letterSpacing: 2,
          padding: "4px 14px", borderRadius: 8, textTransform: "uppercase", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: C.accent }} />
          {perspective}
        </div>
      )}
      <div style={{ background: "linear-gradient(135deg, rgba(8, 12, 20, 0.95), rgba(4, 6, 10, 0.97))",
        border: "1px solid rgba(255,255,255,0.14)", backdropFilter: "blur(12px)",
        padding: "16px 36px", borderRadius: 16, maxWidth: 1520, textAlign: "center",
        boxShadow: "0 12px 38px rgba(0,0,0,0.65)", fontSize: 44, fontWeight: 700, lineHeight: 1.25, color: C.ink }}>
        {g.map((w, i) => {
          const active = t >= w.start && t <= w.end + 0.08;
          const isNumeric = /[\d%$]/.test(w.text);
          return (
            <span key={i} style={{
              color: active ? (isNumeric ? C.hot : C.accent) : C.ink,
              fontWeight: active ? 800 : 700,
              textShadow: active ? `0 0 16px ${isNumeric ? C.hot : C.accent}bb` : undefined,
            }}>
              {w.text}{" "}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const BeatView = ({ scene, beat, index, at, total, repeat, brand }: { scene: Scene; beat: Beat; index: number; at: number; total: number; repeat: boolean; brand: Brand }) => {
  const frames = Math.round(beat.duration * FPS);
  const f = useCurrentFrame();
  // Enter: smooth cinematic transition with subtle directional variety across beats
  const enter = interpolate(f, [0, 10], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  // Directional motion dynamics: push-in, right-glide, pull-back, left-glide
  const mod = index % 4;
  const transform = mod === 0
    ? `scale(${1.035 - 0.035 * enter})`
    : mod === 1
    ? `scale(${1.015 - 0.015 * enter}) translateX(${(1 - enter) * 28}px)`
    : mod === 2
    ? `scale(${0.98 + 0.02 * enter})`
    : `scale(${1.015 - 0.015 * enter}) translateX(${(1 - enter) * -28}px)`;

  // Subtle luminous accent hairline sweeping across the top on beat cut
  const sweep = interpolate(f, [0, 12], [0, 100], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const sweepOpacity = interpolate(f, [0, 9, 13], [0.85, 0.85, 0], { extrapolateRight: "clamp" });

  const v = beat.visual;
  const pictured = v.type === "photo" || v.type === "broll" || v.type === "illustration";
  const kinetic = pictured ? !v.asset : (v.type === "card" && !v.items && !v.text) || (v.type === "article" && repeat);
  const perspectiveBadge = v.perspective || (v.conflict ? "Disputed Claim" : undefined);
  const body = kinetic ? <KineticBeat scene={scene} beat={beat} />
    : pictured ? <PhotoBeat v={v} frames={frames} index={index} />
    : <Push frames={frames}>{
        v.type === "article" ? <ArticleBeat v={v} />
        : v.type === "quote" ? <QuoteBeat v={v} frames={frames} />
        : v.type === "stat" ? <StatBeat v={v} />
        : v.type === "chart" ? <ChartBeat v={v} frames={frames} />
        : v.type === "timeline" ? <TimelineBeat v={v} frames={frames} />
        : v.type === "compare" || v.type === "comparison" ? <ComparisonBeat v={v} />
        : v.type === "flow" && Array.isArray(v.steps) && v.steps.length >= 2 ? <FlowBeat v={v} frames={frames} />
        : v.type === "versus" && v.left && v.right ? <VersusBeat v={v} />
        : v.type === "gauge" && Number.isFinite(Number(v.value)) && Number.isFinite(Number(v.target)) ? <GaugeBeat v={v} />
        : v.type === "code" || v.type === "terminal" ? <CodeBeat v={v} frames={frames} />
        : v.type === "card" && (v.items || v.text) ? <CardBeat v={v} />
        : <KineticBeat scene={scene} beat={beat} />
      }</Push>;
  return (
    <AbsoluteFill style={{ opacity: enter, transform }}>
      {body}
      <Header at={at + f / FPS} total={total} brand={brand} />
      {!kinetic && <Captions words={beat.words} perspective={perspectiveBadge} />}
      <Audio src={staticFile(beat.audio)} />
      {/* Broadcast accent sweep hairline on cut */}
      {sweepOpacity > 0 && (
        <div style={{ position: "absolute", top: 0, left: 0, height: 3, width: `${sweep}%`,
          background: `linear-gradient(90deg, transparent, ${C.accent}, ${C.hot})`, opacity: sweepOpacity,
          boxShadow: `0 0 10px ${C.accent}` }} />
      )}
    </AbsoluteFill>
  );
};

/**
 * The video's style colours (styles.ts, through the timeline). Every frame of one render uses the same timeline, so
 * setting the shared palette before drawing is safe.
 */
export function applyPalette(target: { accent: string; hot: string }, palette?: Palette | null) {
  target.accent = palette?.accent ?? "#36d399";
  target.hot = palette?.accent2 ?? "#ff5c5c";
}

export const NewsVideo = ({ scenes, total, title, sources = [], music, date, palette, brand = DEFAULT_BRAND }: Timeline) => {
  applyPalette(C, palette);
  let index = 0;
  const shown = new Set<string>();
  const end = Math.round((INTRO + total) * FPS);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Sequence durationInFrames={INTRO * FPS}><Intro title={title} date={date} brand={brand} /></Sequence>
      <Sequence from={INTRO * FPS}>
        {scenes.map((s, si) => (
          <Sequence key={si} from={Math.round(s.start * FPS)} durationInFrames={Math.round(s.duration * FPS)}>
            {s.beats.map((b, bi) => {
              const i = index++;
              // The same article twice reads as a loop: its second showing becomes kinetic text.
              const key = b.visual.type === "article" ? String(b.visual.url ?? b.visual.headline) : "";
              const repeat = !!key && shown.has(key);
              if (key) shown.add(key);
              return (
                <Sequence key={bi} from={Math.round(b.start * FPS)} durationInFrames={Math.round(b.duration * FPS)}>
                  <BeatView scene={s} beat={b} index={i} at={s.start + b.start} total={total} repeat={repeat} brand={brand} />
                </Sequence>
              );
            })}
            {s.kind !== "outro" && <LowerThird scene={s} />}
          </Sequence>
        ))}
      </Sequence>
      <Sequence from={end}><Outro sources={sources} brand={brand} /></Sequence>
      {music && (
        <Audio
          src={staticFile(music)}
          loop
          volume={(f) => {
            const introFrames = INTRO * FPS;
            // Dynamic Audio Ducking: Confident branded theme music during Intro
            if (f < introFrames) {
              return interpolate(f, [0, 20, introFrames - 15, introFrames], [0, 0.10, 0.10, 0.038], { extrapolateRight: "clamp" });
            }
            // Swell up during Outro card
            if (f >= end) {
              return interpolate(f, [end, end + 30, end + OUTRO * FPS - 30, end + OUTRO * FPS], [0.038, 0.15, 0.15, 0], { extrapolateRight: "clamp" });
            }
            // Narrated speech body: Ducked to 0.038 for punchy voice intelligibility
            return 0.038;
          }}
        />
      )}
    </AbsoluteFill>
  );
};
