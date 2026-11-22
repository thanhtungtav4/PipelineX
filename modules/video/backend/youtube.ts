// YouTube: the admin connects the channel once (OAuth), then a finished video is uploaded PRIVATE with its publish kit
// (title, description, tags, category, language), thumbnail and captions in the channel's language, and its Short likewise. It goes
// public only when a human clicks Publish on the Videos page; the editor MCP has no tool for either.
//
// Keys: YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET (a Google Cloud OAuth "Web application" client whose redirect URI is
// <SITE_URL>/api/admin/video/youtube/callback). The channel's refresh token is kept in <data>/youtube-auth.json (0600).
// Until Google audits the Cloud project, YouTube keeps API uploads private and refuses to make them public.
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync, createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { config, credential } from "@aihot/backend/config";
import { channelProfile } from "./channel-profile.ts";
import { workDir } from "./pipeline.ts";
import { captionsSrt, publishKit } from "./publishing.ts";

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.force-ssl", "https://www.googleapis.com/auth/yt-analytics.readonly"];
const AUTH_FILE = () => path.join(config.dataDir, "youtube-auth.json");
const redirectUri = () => `${config.siteUrl}/api/admin/video/youtube/callback`;
const client = () => ({ id: credential("integrations", "YOUTUBE_CLIENT_ID"), secret: credential("integrations", "YOUTUBE_CLIENT_SECRET") });

export class YouTubeError extends Error {}

interface Auth { refreshToken: string; channelId: string; channelTitle: string; connectedAt: string; connectedBy: string }
const readAuth = (): Auth | null => (existsSync(AUTH_FILE()) ? (JSON.parse(readFileSync(AUTH_FILE(), "utf8")) as Auth) : null);

/** Whether keys are set and a channel is connected (never the token itself). */
export function youtubeStatus() {
  const { id, secret } = client();
  const auth = readAuth();
  return { configured: !!(id && secret), connected: !!auth, channel: auth ? { id: auth.channelId, title: auth.channelTitle, connectedAt: auth.connectedAt } : null, redirectUri: redirectUri() };
}

// OAuth state: one-use, ten minutes, bound to the admin who asked (the callback comes back in their browser).
const states = new Map<string, { actor: string; until: number }>();
export function connectUrl(actor: string): string {
  const { id } = client();
  if (!id) throw new YouTubeError("Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env first.");
  const state = randomBytes(24).toString("hex");
  states.set(state, { actor, until: Date.now() + 10 * 60_000 });
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for (const [k, v] of Object.entries({ client_id: id, redirect_uri: redirectUri(), response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", state }))
    u.searchParams.set(k, v);
  return u.toString();
}

async function token(params: Record<string, string>) {
  const { id, secret } = client();
  if (!id || !secret) throw new YouTubeError("YouTube keys are not set (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET).");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...params }), signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new YouTubeError(`Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
  return body;
}

/** The OAuth callback: exchanges the code, finds the channel, keeps the refresh token. */
export async function finishConnect(code: string, state: string, actor: string) {
  const pending = states.get(state);
  states.delete(state);
  if (!pending || pending.until < Date.now() || pending.actor !== actor) throw new YouTubeError("This sign-in link expired or was not started here. Connect again from the Videos page.");
  const t = await token({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!t.refresh_token) throw new YouTubeError("Google returned no refresh token. Remove the app's access in your Google account, then connect again.");
  const me = await api<{ items?: Array<{ id: string; snippet: { title: string } }> }>(t.access_token!, "GET", "/youtube/v3/channels?part=snippet&mine=true");
  const channel = me.items?.[0];
  if (!channel) throw new YouTubeError("This Google account has no YouTube channel.");
  writeFileSync(AUTH_FILE(), JSON.stringify({ refreshToken: t.refresh_token, channelId: channel.id, channelTitle: channel.snippet.title, connectedAt: new Date().toISOString(), connectedBy: actor } satisfies Auth, null, 2));
  chmodSync(AUTH_FILE(), 0o600);
  return { id: channel.id, title: channel.snippet.title };
}

let cachedAccess: { token: string; until: number } | null = null;
async function accessToken(): Promise<string> {
  if (cachedAccess && cachedAccess.until > Date.now() + 60_000) return cachedAccess.token;
  const auth = readAuth();
  if (!auth) throw new YouTubeError("No YouTube channel is connected. Connect it on the Videos page.");
  const t = await token({ refresh_token: auth.refreshToken, grant_type: "refresh_token" }) as { access_token: string; expires_in?: number };
  cachedAccess = { token: t.access_token, until: Date.now() + (t.expires_in ?? 3600) * 1000 };
  return t.access_token;
}

async function api<T>(access: string, method: string, pathAndQuery: string, body?: unknown, base = "https://www.googleapis.com"): Promise<T> {
  const res = await fetch(`${base}${pathAndQuery}`, {
    method, headers: { authorization: `Bearer ${access}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new YouTubeError(`YouTube ${res.status}: ${youtubeReason(text)}`);
  return (text ? JSON.parse(text) : {}) as T;
}
/** Google's error message, made plain for the ones an operator meets. */
function youtubeReason(text: string): string {
  let reason = "", message = text.slice(0, 300);
  try { const e = JSON.parse(text).error; reason = e?.errors?.[0]?.reason ?? ""; message = e?.message ?? message; } catch { /* not JSON */ }
  if (reason === "quotaExceeded") return "the project's daily quota is used up (an upload costs 1,600 of 10,000 units); try again tomorrow.";
  if (reason === "uploadLimitExceeded") return "the channel reached YouTube's upload limit for now; try again later.";
  if (reason === "forbidden" && /thumbnail/i.test(message)) return "custom thumbnails need a verified channel (youtube.com/verify).";
  return message;
}

const CATEGORY: Record<string, string> = { "News & Politics": "25", "Science & Technology": "28", Education: "27", "People & Blogs": "22" };

/** Uploads a file with YouTube's resumable protocol (one session, one PUT). */
async function uploadFile(access: string, file: string, metadata: unknown): Promise<{ id: string }> {
  const size = statSync(file).size;
  const start = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST", signal: AbortSignal.timeout(60_000),
    headers: { authorization: `Bearer ${access}`, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": "video/mp4", "x-upload-content-length": String(size) },
    body: JSON.stringify(metadata),
  });
  if (!start.ok) throw new YouTubeError(`YouTube ${start.status}: ${youtubeReason(await start.text())}`);
  const session = start.headers.get("location");
  if (!session) throw new YouTubeError("YouTube did not open an upload session.");
  const put = await fetch(session, {
    method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(size) },
    body: Readable.toWeb(createReadStream(file)) as unknown as ReadableStream, duplex: "half", signal: AbortSignal.timeout(30 * 60_000),
  } as RequestInit);
  const text = await put.text();
  if (!put.ok) throw new YouTubeError(`YouTube ${put.status}: ${youtubeReason(text)}`);
  return JSON.parse(text) as { id: string };
}

async function uploadPart(access: string, url: string, type: string, data: Buffer) {
  const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${access}`, "content-type": type }, body: data, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new YouTubeError(`YouTube ${res.status}: ${youtubeReason(await res.text())}`);
}

/** The channel profile's language (channel.json youtube.language, a display name) as a YouTube language code + name. */
const LANGUAGES: Record<string, { code: string; name: string }> = {
  English: { code: "en", name: "English" },
  Vietnamese: { code: "vi", name: "Vietnamese" },
};
const channelLanguage = () => LANGUAGES[channelProfile().youtube?.language ?? "English"] ?? LANGUAGES.English!;

/** Captions from the narration, in the channel profile's language (captions.insert: a JSON part and the SRT part). */
async function uploadCaptions(access: string, videoId: string, srt: string) {
  const language = channelLanguage();
  const boundary = `pipelinex${randomBytes(8).toString("hex")}`;
  const meta = JSON.stringify({ snippet: { videoId, language: language.code, name: language.name, isDraft: false } });
  const body = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/x-subrip\r\n\r\n${srt}\r\n--${boundary}--\r\n`);
  await uploadPart(access, "https://www.googleapis.com/upload/youtube/v3/captions?uploadType=multipart&part=snippet", `multipart/related; boundary=${boundary}`, body);
}

export interface YouTubeRecord {
  longId?: string; shortId?: string; uploadedAt?: string; uploadedBy?: string;
  /** Ids made public, and when the last of them was. */
  publicIds?: string[]; publishedAt?: string; publishedBy?: string;
  thumbnailSet?: boolean; notes?: string[];
}
const recordFile = (id: number) => path.join(workDir(id), "youtube.json");
export const youtubeRecord = (id: number): YouTubeRecord | null => (existsSync(recordFile(id)) ? (JSON.parse(readFileSync(recordFile(id), "utf8")) as YouTubeRecord) : null);
/** Merges into the saved record (ids, once known, are never dropped). */
function saveRecord(id: number, patch: YouTubeRecord): YouTubeRecord {
  const merged = { ...(youtubeRecord(id) ?? {}), ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } as YouTubeRecord;
  writeFileSync(recordFile(id), JSON.stringify(merged, null, 2));
  return merged;
}
/** One YouTube command per video at a time (a double click, or Publish pressed while the upload still runs). */
const busy = new Set<number>();
async function exclusive<T>(id: number, work: () => Promise<T>): Promise<T> {
  if (busy.has(id)) throw new YouTubeError(`Video #${id} is being sent to YouTube right now; wait for it to finish.`);
  busy.add(id);
  try { return await work(); } finally { busy.delete(id); }
}
/** Every video still private, for the Videos page: "Publish" stays until both the video and its Short are public. */
export const pendingPublic = (r: YouTubeRecord | null) => [r?.longId, r?.shortId].filter((v): v is string => !!v && !(r?.publicIds ?? []).includes(v));

/** Uploads the long video and its Short as private, with the kit, thumbnail and captions. Parts that fail after the
 * video itself is up (thumbnail, captions) are noted, not fatal: the human can add them in Studio. */
export function uploadPrivate(id: number, actor: string): Promise<YouTubeRecord> {
  return exclusive(id, () => upload(id, actor));
}
async function upload(id: number, actor: string): Promise<YouTubeRecord> {
  const done = youtubeRecord(id);
  if (done?.longId && done?.shortId) throw new YouTubeError(`Video #${id} is already on YouTube (https://youtu.be/${done.longId}).`);
  const kit = publishKit(id);
  const dir = workDir(id);
  if (!kit || !existsSync(path.join(dir, "video.mp4"))) throw new YouTubeError(`Video #${id} is not finished yet.`);
  const access = await accessToken();
  const yt = channelProfile().youtube;
  const lang = channelLanguage().code; // the channel profile's language (channel.json youtube.language)
  const status = { privacyStatus: "private", selfDeclaredMadeForKids: false, containsSyntheticMedia: false, embeddable: true, license: "youtube" };
  const snippet = (p: { title: string; description: string; tags: string[] }) =>
    ({ title: p.title, description: p.description, tags: p.tags, categoryId: CATEGORY[yt?.category ?? "News & Politics"] ?? "25", defaultLanguage: lang, defaultAudioLanguage: lang });
  const notes: string[] = done?.notes?.filter((n) => !n.startsWith("short:")) ?? [];
  let longId = done?.longId;
  if (!longId) {
    const long = await uploadFile(access, path.join(dir, "video.mp4"), { snippet: snippet(kit.long), status });
    longId = long.id;
    saveRecord(id, { longId, uploadedBy: actor, notes });
  }
  const mainUrl = `https://youtu.be/${longId}`;
  const extra = async (what: string, work: () => Promise<void>) => { try { await work(); } catch (e) { notes.push(`${what}: ${(e as Error).message}`); } };
  if (!done?.thumbnailSet && existsSync(path.join(dir, "thumbnail.jpg")))
    await extra("thumbnail", async () => { await sendThumbnail(access, id, longId!); saveRecord(id, { thumbnailSet: true }); });
  const srt = captionsSrt(id, "long");
  if (!done?.longId && srt) await extra("captions", () => uploadCaptions(access, longId!, srt));
  if (!done?.shortId && kit.short && existsSync(path.join(dir, "short.mp4"))) {
    await extra("short", async () => {
      // Auto-insert or replace main video link into Short's description
      let shortDesc = kit.short!.description;
      const placeholderRegex = /👉 WATCH FULL DEEP DIVE: \[Link auto-inserted[^\n]*\n(?:Full Video: [^\n]*\n)?/;
      if (placeholderRegex.test(shortDesc)) {
        shortDesc = shortDesc.replace(placeholderRegex, `👉 WATCH FULL VIDEO: ${mainUrl}\n(Tap "Related video" right above the channel name)\n`);
      } else if (!shortDesc.includes(mainUrl)) {
        shortDesc = `👉 WATCH FULL VIDEO: ${mainUrl}\n(Tap "Related video" right above the channel name)\n\n` + shortDesc;
      }
      kit.short!.description = shortDesc;
      writeFileSync(path.join(dir, "publish.json"), JSON.stringify(kit, null, 2));

      const short = await uploadFile(access, path.join(dir, "short.mp4"), { snippet: { ...snippet(kit.short!), description: shortDesc }, status });
      saveRecord(id, { shortId: short.id });

      const shortSrt = captionsSrt(id, "short");
      if (shortSrt) await extra("short captions", () => uploadCaptions(access, short.id, shortSrt));
    });
  }
  return saveRecord(id, { uploadedAt: new Date().toISOString(), notes });
}

const sendThumbnail = (access: string, id: number, videoId: string) =>
  uploadPart(access, `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, "image/jpeg", readFileSync(path.join(workDir(id), "thumbnail.jpg")));

/** Sets the video's thumbnail again (the first try fails until the channel is verified at youtube.com/verify). */
export function setThumbnail(id: number): Promise<YouTubeRecord> {
  return exclusive(id, async () => {
    const record = youtubeRecord(id);
    if (!record?.longId) throw new YouTubeError(`Video #${id} is not on YouTube yet: upload it first.`);
    if (!existsSync(path.join(workDir(id), "thumbnail.jpg"))) throw new YouTubeError(`Video #${id} has no thumbnail.`);
    await sendThumbnail(await accessToken(), id, record.longId);
    return saveRecord(id, { thumbnailSet: true, notes: (record.notes ?? []).filter((n) => !n.startsWith("thumbnail:")) });
  });
}

/** A human's decision on the Videos page: makes the uploaded video (and its Short) public. */
export function publishPublic(id: number, actor: string): Promise<YouTubeRecord> {
  return exclusive(id, () => publish(id, actor));
}
async function publish(id: number, actor: string): Promise<YouTubeRecord> {
  const record = youtubeRecord(id);
  if (!record?.longId) throw new YouTubeError(`Video #${id} is not on YouTube yet: upload it first.`);
  if (!record.uploadedAt) throw new YouTubeError(`Video #${id} is still being uploaded; publish it when the upload has finished.`);
  const access = await accessToken();
  const status = { privacyStatus: "public", selfDeclaredMadeForKids: false, containsSyntheticMedia: false, embeddable: true, license: "youtube" };
  const publicIds = [...(record.publicIds ?? [])];
  for (const videoId of pendingPublic(record)) {
    try {
      await api(access, "PUT", "/youtube/v3/videos?part=status", { id: videoId, status });
    } catch (e) {
      // Unaudited Cloud projects: YouTube keeps the upload private ("locked") whatever the API asks.
      throw new YouTubeError(`${(e as Error).message} If YouTube says the video is locked as private, the Google Cloud project needs YouTube's API audit before API uploads can go public; until then, publish it in YouTube Studio.`);
    }
    let now: string | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 5000));
      const check = await api<{ items?: Array<{ status?: { privacyStatus?: string } }> }>(access, "GET", `/youtube/v3/videos?part=status&id=${videoId}`);
      now = check.items?.[0]?.status?.privacyStatus;
      if (now === "public") break;
      if (attempt < 4) await api(access, "PUT", "/youtube/v3/videos?part=status", { id: videoId, status }).catch(() => {});
    }
    if (now !== "public") throw new YouTubeError(`YouTube kept ${videoId} ${now ?? "unknown"}: API uploads from an unaudited Google Cloud project stay private. Request YouTube's API audit, or publish it in YouTube Studio for now.`);
    publicIds.push(videoId);
    saveRecord(id, { publicIds });
  }
  return saveRecord(id, { publicIds, publishedAt: new Date().toISOString(), publishedBy: actor });
}
