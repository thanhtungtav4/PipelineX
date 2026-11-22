// Site identity, branding, and reader-facing copy (Điểm Tin Công Nghệ, the PipelineX technews pack: copied over site/site.ts in a technews channel).
// Read by both web and backend; changes take effect upon rebuild (e.g. docker compose up --build).
// The public domain is set via the environment variable SITE_URL.

import type { Founder } from "@aihot/contracts/site-config";

/**
 * Publication schedule (Beijing/UTC+8 time, HH:mm): Daily report covers the preceding 24h.
 * Weekly report generates every Monday; Monthly report generates on the 1st of each month.
 */
export const EDITION_TIMES = { daily: "07:30", weekly: "10:00", monthly: "10:30" };

export const EDITION_WHEN = {
  daily: `Daily at ${EDITION_TIMES.daily}`,
  weekly: `Mondays at ${EDITION_TIMES.weekly}`,
  monthly: `1st of each month at ${EDITION_TIMES.monthly}`,
};

export const SITE = {
  /** Site name: used in navigation, page titles, OG cards, RSS, MCP, and admin. */
  name: "Điểm Tin Công Nghệ",
  /** Industry keyword: interpolated into phrases like "AI Briefing", "AI Updates". */
  subject: "Công nghệ",
  /** Homepage full title (browser tab, search engines). */
  homeTitle: "Điểm Tin Công Nghệ — Tin công nghệ, kiểm chứng mỗi ngày · Bản tin & Luồng tin chọn lọc",
  /** Topics directory page (/topics) title. */
  topicsTitle: "Chủ đề công nghệ: Hãng, Lĩnh vực & Loại tin",
  /** Feedback form input placeholder. */
  feedbackExample: "e.g. When searching for a keyword, I encountered... I was expecting...",
  /** Subheading under the feedback page title. */
  feedbackLead: "Found a bug, want a new feature, or have suggestions? Let us know.",
  /** Feedback email input hint. */
  feedbackEmailHint: "Leave your email so we can follow up with you",
  /** One-line site summary used for SEO, share cards, RSS, and llms.txt. */
  description: `Chọn lọc tin công nghệ, AI và ưu đãi đáng chú ý từ nguồn công khai, gom các bài cùng sự kiện và xuất bản bản tin mỗi ngày ${EDITION_WHEN.daily}.`,
  /** Detailed description in llms.txt (optional). */
  llmsIntro: null as string | null,
  /** Tagline for social share cards and posters. */
  tagline: "Tin công nghệ đáng chú ý, kiểm chứng mỗi ngày",
  /** SEO keywords for homepage structured data. */
  keywords: ["Tin Công Nghệ", "Trí Tuệ Nhân Tạo", "AI News", "Ưu Đãi Công Nghệ"] as string[],
  /** Search engine site verification codes (optional). */
  siteVerification: {} as Record<string, string>,
  /** Starting publication year for structured data. */
  since: "2026",
  /** UI language (HTML lang, og:locale). */
  locale: "vi-VN",
  /** Default fallback URL when SITE_URL is unset. */
  defaultUrl: "http://localhost:3000",
  /** Root directory icons list. */
  rootIcons: [] as string[],
  /** MCP tool name prefix (e.g. pipelinex_get_latest). */
  mcpPrefix: "diem_tin_cong_nghe",
  /** Public interface version. */
  interfaceVersion: "4.0.0",
  /** Contact email address. */
  contactEmail: null as string | null,
  /** Footer note. */
  footerNote: "Vận hành bằng PipelineX. Tin tài chính chỉ để tham khảo, không phải lời khuyên đầu tư.",
  /** ICP license number (China-specific). */
  icp: null as string | null,
  /** Public security bureau record (China-specific). */
  psb: null as string | null,
  /** GitHub repository link. */
  github: null as string | null,
  /** Powered-by link. */
  poweredBy: { name: "AIHOT", url: "https://aihot.news" } as { name: string; url: string } | null,
  /** Organization operator for structured metadata. */
  organization: {
    name: "Điểm Tin Công Nghệ",
    founder: null as Founder | null,
  },
  /** User-Agent identification header used during scraping. */
  crawlerName: "DiemTinCongNgheBot/1.0",
} as const;

/** Policy and terms pages. */
export const POLICY = {
  terms: {
    name: "Terms of Use",
    description: "Terms of use for web, RSS, Public API, and MCP services.",
    covers: null as string | null,
    notes: null as null | { rss: string; api: string },
    license: null as null | { llms: string; agent: string },
    headers: null as null | Record<string, string>,
  },
  privacy: {
    description: "How local storage, feedback data, and access logs are handled.",
    covers: null as string | null,
  },
  xPostIsFullText: true,
} as const;

/** Navigation menu configuration. */
export const NAV = {
  hidden: [] as Array<"/hot" | "/topics">,
};

/** Item presentation copy. */
export const ITEM_COPY = {
  reasonLabel: "Why it matters",
  showScore: true,
};

interface ContactCard {
  kind: string;
  title: string;
  note: string;
  alias?: string;
}

export const ABOUT = {
  kicker: `About ${SITE.name}`,
  description: `About ${SITE.name}: ${SITE.description}`,
  headline: ["Công nghệ thay đổi mỗi ngày.", "Chỉ vài tin thật sự đáng xem."] as [string, string],
  lead: `${SITE.name} monitors {sources} sources for you: ingesting, clustering, scoring, and curating, publishing a daily briefing ${EDITION_WHEN.daily}. Free, no login required.`,
  sourcesFallback: "dozens of",
  steps: {
    collect: "Theo dõi các hãng công nghệ, phòng nghiên cứu, blog chính thức và truyền thông công nghệ; nguồn đang hoạt động được quét tối đa mỗi 15 phút.",
    store: "All ingested articles are deduplicated and clustered into events to compute trend momentum.",
    select: `Models evaluate industry relevance and concrete facts, drafting Vietnamese headlines, summaries, and ${ITEM_COPY.reasonLabel}.`,
    publish: `Publishing daily briefings ${EDITION_WHEN.daily}, weekly reviews ${EDITION_WHEN.weekly}, and monthly recaps ${EDITION_WHEN.monthly}.`,
  },
  maker: null as null | {
    name: string;
    avatarSourceId?: string | null;
    greeting: string[];
    wechat?: ContactCard;
    feishu?: ContactCard;
  },
  copyright: [`${SITE.name} provides aggregated summaries and index links. Original copyright belongs to source authors. For corrections or takedowns, please `, "contact us via feedback."] as [string, string],
  termsAnchor: null as string | null,
} as const;

export const ADMIN = {
  feedbackNote: null as string | null,
  banNote: null as string | null,
  budgetNote: null as string | null,
};

export const AGENT = {
  search: { scope: "Search across companies, institutions, markets, or topics in the past 7 days", ask: "Tuần này có mô hình AI nào mới ra mắt?" },
};

export const REPORTS = {
  imprint: SITE.name.toUpperCase(),
  motto: SITE.subject as string,
  descriptions: {
    daily: `${SITE.name} Curated Daily Briefing published ${EDITION_WHEN.daily}`,
    weekly: "Weekly Comprehensive Industry Review",
    monthly: "Monthly Industry Roundup",
  },
  entry: { measure: "items", noun: "Tin" },
  metricUnits: { sourcesCount: " sources", firstPartyEvents: " direct releases", selectedCount: " curated items", reportsCovered: " daily editions" },
  shareUnit: "Tin",
  quiet: { title: "Quiet day, no major events", paragraph: "No major updates occurred between {start} and {end}." },
};

export const ALERTS = {
  quietMinutes: 360,
  quietWhileFetchingMinutes: 720,
  usualFlow: null as string | null,
  workerLogs: "Check worker logs (docker compose logs worker)",
};

export const SOURCE_DEFAULTS = {
  siteFulltext: false,
};

export const COMMUNITY_FEEDS: { dev: string[]; hn: string[] } = {
  dev: [],
  hn: [],
};

export const CARDS: Record<string, { kicker: string; title: string; subtitle: string; accent?: "hot" | "amber" }> = {
  site: { kicker: "Daily Curated", title: SITE.tagline, subtitle: SITE.description },
  all: { kicker: "All Updates", title: "Latest updates from all sources, all in one place", subtitle: "Chronological feed across all sources with category and tag filtering." },
  hot: { kicker: "Trending", title: "What everyone is discussing over the past 48 hours", subtitle: "Heat index, trend momentum, and multi-source public discussion signals.", accent: "hot" },
  daily: { kicker: `${SITE.subject} Daily`, title: `Every day at ${spokenTime(EDITION_TIMES.daily)}, a briefing you can actually finish`, subtitle: "Notable developments from the preceding 24 hours." },
  weekly: { kicker: `${SITE.subject} Weekly`, title: "A week of major stories, at a glance", subtitle: "Key storylines, breakthrough releases, and notable discussions." },
  monthly: { kicker: `${SITE.subject} Monthly`, title: "A month of progress", subtitle: "Monthly developments and milestones reviewed." },
  about: { kicker: "About", title: `About ${SITE.name}`, subtitle: SITE.description },
  terms: { kicker: "Terms", title: `${SITE.name} Terms of Use`, subtitle: "Web, API, RSS, and MCP scope of use." },
  privacy: { kicker: "Privacy", title: `${SITE.name} Privacy Notice`, subtitle: "How access logs, local storage, and feedback are handled." },
  changelog: { kicker: "Changelog", title: `${SITE.name} Changelog`, subtitle: "Product updates, optimizations, and release notes." },
  feedback: { kicker: "Feedback", title: "Help us make this better", subtitle: "Feedback on content, features, integrations, or takedown requests." },
  agent: { kicker: "Agent Access", title: `Connect ${SITE.name} to your AI Agent`, subtitle: "MCP, RSS, and REST API: anonymous, read-only, no API keys required." },
};

export const ACCESS = {
  ratePerMinute: null as number | null,
  userAgent: null as string | null,
};

export const DEPLOYMENT = {
  credentialsDir: null as string | null,
  credentialFiles: {} as Partial<Record<string, string>>,
  requiredSecrets: [] as const,
  originHost: null as string | null,
  loginReturnHeader: null as string | null,
  imageUpstreamBudget: null as null | { mbPerMinute: number; gbPerDay: number },
  directFetchHosts: [] as string[],
  selectionGold: null as null | { file: string; sample: number; split: string; sweep: [number, number] },
};

export const FEED_COPY = {
  allLeavesOut: [] as string[],
};

export const PUBLIC_CATEGORIES = {
  merge: {},
  feedLabels: {},
} as const;

export function withSubject(noun: string): string {
  return `${SITE.subject} ${noun}`;
}

export function subjectAfter(text: string, noun?: string): string {
  return noun ? `${text} ${withSubject(noun)}` : `${text} ${SITE.subject}`;
}

function spokenTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${period}`;
}

export const SEO_TITLES = {
  hot: `${withSubject("Trending")}: Top Stories & Event Rankings`,
  all: `${subjectAfter("Latest", "Updates")}: Real-time Feed`,
  agent: `${withSubject("News")} API, MCP & RSS for AI Agents`,
  about: `About ${SITE.name}: ${SITE.tagline}`,
  latestReport: (kind: "daily" | "weekly" | "monthly", date: string): string =>
    ({
      daily: `${withSubject("Daily Briefing")} (${date})`,
      weekly: `${withSubject("Weekly Review")} (${date})`,
      monthly: `${withSubject("Monthly Briefing")} (${date})`,
    })[kind],
  topic: (name: string, group: "company" | "field" | "genre", updated: string | null): string =>
    `${name} ${group === "company" ? "Latest News & Updates" : "Latest Updates & Developments"}${updated ? ` (Updated ${updated})` : ""}`,
};
