// Makes one video: story material -> script (LLM) -> pictures (Pixabay/Commons/Openverse, vision-checked) ->
// voice (edge-tts) -> render (Remotion). Each step is a program in renderer/, run with the video's work
// directory; each prints a last line "RESULT {json}" that is kept in video_jobs.result.
import { spawn, type ChildProcess } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "@aihot/backend/config";
import { EXTRAS, finishVideo, getVideo, markStep, recordStep, reviewVideo, STEPS, storyMaterial, styleInputs, type Step } from "./videos.ts";
import { activeRules } from "./style.ts";
import { chooseStyle, STYLES, type StyleKey } from "./styles.ts";
import { channelProfile } from "./channel-profile.ts";
import { sql } from "@aihot/backend/db";

export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const RENDERER = process.env.VIDEO_RENDERER_DIR || path.join(ROOT, "renderer");
export const WORK_ROOT = process.env.VIDEO_WORK_DIR || path.join(ROOT, ".data", "videos");

/** The voice step's interpreter: $VIDEO_PYTHON, else the setup script's venv (Scripts on Windows, bin elsewhere). */
function python(): string {
  if (process.env.VIDEO_PYTHON) return process.env.VIDEO_PYTHON;
  const windows = process.platform === "win32";
  const venv = path.join(RENDERER, ".venv", windows ? "Scripts" : "bin", windows ? "python.exe" : "python");
  return existsSync(venv) ? venv : windows ? "python" : "python3";
}

export const workDir = (id: number) => path.join(WORK_ROOT, String(id));
export const videoFile = (id: number) => path.join(workDir(id), "video.mp4");
export const shortFile = (id: number) => path.join(workDir(id), "short.mp4");
export const thumbnailFile = (id: number) => path.join(workDir(id), "thumbnail.jpg");

const MINUTE = 60_000;

/**
 * What the renderer's programs may see of the worker's environment: the system basics and the settings and keys they
 * read (renderer/lib.ts, background.ts, assets.ts, tts.py). Nothing else (database address, admin password, session
 * secrets) reaches them. renderer/.env (PIXABAY_API_KEY) is read by the programs themselves.
 */
const SYSTEM_ENV = [
  "PATH", "HOME", "USERPROFILE", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "USER", "USERNAME", "SHELL",
  // Windows: spawn replaces the child's whole environment, and Python, Node and Chrome read these for sockets,
  // certificates, temp files and browser profiles.
  "SystemRoot", "windir", "SystemDrive", "ComSpec", "PATHEXT", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA",
  "NUMBER_OF_PROCESSORS",
];
const RENDERER_ENV = [
  "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "LLM_REASONING_TOKENS",
  "NVIDIA_BASE_URL", "NVIDIA_API_KEY", "NVIDIA_MODEL", "OPENROUTER_BASE_URL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL",
  "ORCAROUTER_BASE_URL", "ORCAROUTER_API_KEY", "ORCAROUTER_MODEL", "VIDEO_PROVIDERS",
  "TINYFISH_API_KEY", "TINYFISH_SEARCH_URL", "TINYFISH_FETCH_URL", "PIXABAY_API_KEY",
  "AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION", "VIDEO_TTS", "VIDEO_ALT_VOICE_QUOTE", "VIDEO_ALT_VOICE_CONFLICT",
  "VIDEO_SCRIPT_MODEL", "VIDEO_SCRIPT_WORDS", "VIDEO_MATERIAL_CHARS", "VIDEO_DOSSIER", "VIDEO_DOSSIER_CHARS", "VIDEO_MUSIC",
  "FRED_API_KEY", "SEC_USER_AGENT", "PEXELS_API_KEY",
];
const rendererEnv = () => ({
  ...Object.fromEntries([...SYSTEM_ENV, ...RENDERER_ENV].flatMap((k) => (process.env[k] === undefined ? [] : [[k, process.env[k]!]]))),
  // The shared renderer works for this checkout's channel: its profile, sources and trusted sites.
  VIDEO_INDUSTRY_DIR: path.join(ROOT, "industry"),
});
// 7-8 minute videos: a script with an editing pass, about 80 sentences to check and 40 beats of pictures and voice.
const LIMITS: Record<Exclude<Step, "story">, number> = { thumbnail: 5 * MINUTE, short: 15 * MINUTE, shortvoice: 10 * MINUTE, shortrender: 20 * MINUTE, background: 15 * MINUTE, dossier: 15 * MINUTE, script: 25 * MINUTE, verify: 20 * MINUTE, assets: 35 * MINUTE, voice: 30 * MINUTE, render: 40 * MINUTE };

function command(step: Exclude<Step, "story">, dir: string): [string, string[]] {
  // Node reads the app's .env and the renderer's own (PIXABAY_API_KEY); the worker's env already carries the app's.
  const node = (file: string): [string, string[]] => [process.execPath, ["--env-file-if-exists=.env", file]];
  switch (step) {
    case "background": return node("background.ts");
    case "dossier": return node("dossier.ts");
    case "script": return node("script.ts");
    case "verify": return node("verify.ts");
    case "assets": return node("assets.ts");
    case "voice": return [python(), ["tts.py"]];
    case "thumbnail": return remotion([
      "still", "src/index.ts", "Thumbnail", path.join(dir, "thumbnail.jpg"), `--props=${path.join(dir, "timeline.json")}`,
      `--public-dir=${path.join(dir, "public")}`, "--image-format=jpeg", "--jpeg-quality=88", "--bundle-cache"]);
    case "short": return node("short.ts");
    case "shortvoice": return [python(), ["tts.py"]];
    case "shortrender": return remotion([
      "render", "src/index.ts", "ShortVideo", path.join(dir, "short.mp4"), `--props=${path.join(dir, "timeline-short.json")}`,
      `--public-dir=${path.join(dir, "public")}`, "--codec", "h264", "--crf", "20",
      "--bundle-cache", "--hardware-acceleration", "if-possible",
      "--concurrency", process.env.VIDEO_RENDER_CONCURRENCY || "4"]);
    case "render": return remotion([
      "render", "src/index.ts", "NewsVideo", path.join(dir, "video.mp4"), `--props=${path.join(dir, "timeline.json")}`,
      `--public-dir=${path.join(dir, "public")}`, "--codec", "h264", "--crf", "20",
      "--bundle-cache", "--hardware-acceleration", "if-possible",
      "--concurrency", process.env.VIDEO_RENDER_CONCURRENCY || "4"]);
  }
}

/**
 * Remotion's CLI, started with node. node_modules/.bin/remotion is a .cmd shim on Windows, and spawn cannot run a
 * .cmd without a shell; the package's own entry behaves the same on every platform.
 */
const remotion = (args: string[]): [string, string[]] =>
  [process.execPath, [path.join(RENDERER, "node_modules", "@remotion", "cli", "remotion-cli.js"), ...args]];

/** Runs one program; resolves with the parsed RESULT line, rejects with the end of its output. */
export function run(step: Exclude<Step, "story">, dir: string, extraEnv: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const [bin, args] = command(step, dir);
  const log = path.join(dir, "log.txt");
  appendFileSync(log, `\n=== ${step} ${new Date().toISOString()}\n`);
  return new Promise((resolve, reject) => {
    const variant = step === "shortvoice" ? { VIDEO_VARIANT: "short", ...extraEnv } : extraEnv;
    const child = spawn(bin, args, { cwd: RENDERER, env: { ...rendererEnv(), VIDEO_WORKDIR: dir, ...variant }, stdio: ["ignore", "pipe", "pipe"] });
    let tail = "";
    let result: Record<string, unknown> | null = null;
    let pending = "";
    const take = (chunk: Buffer) => {
      const text = chunk.toString();
      appendFileSync(log, text);
      tail = (tail + text).slice(-4000);
      pending += text;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) if (line.startsWith("RESULT ")) {
        try { result = JSON.parse(line.slice(7)); } catch { /* not a RESULT line */ }
      }
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    // On Windows taskkill also takes the Chrome helpers Remotion started; elsewhere SIGTERM reaches the step.
    const timer = setTimeout(() => {
      if (process.platform === "win32" && child.pid) spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" }).on("error", () => {});
      else child.kill("SIGTERM");
    }, LIMITS[step]);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject((error as NodeJS.ErrnoException).code === "ENOENT"
        ? new Error(`${step}: cannot start ${bin}. Run \`npm run video:setup\` (voice) and \`npm install\` in renderer/ (renders) once.`)
        : error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (pending.startsWith("RESULT ")) { try { result = JSON.parse(pending.slice(7)); } catch { /* not a RESULT line */ } }
      // Remotion prints no RESULT line: a clean exit is enough.
      if (code === 0) resolve(result ?? {});
      else reject(new Error(`${step} ${signal ? `stopped (${signal}, limit ${LIMITS[step] / MINUTE} min)` : `exited ${code}`}: ${lastLines(tail)}`));
    });
  });
}

const lastLines = (text: string) => text.trim().split("\n").filter((l) => !/^\s+at /.test(l)).slice(-6).join("\n").slice(-800);

/** The story's reports as the script step reads them. */
async function writeStory(storyId: number, dir: string): Promise<Record<string, unknown>> {
  const rows = await storyMaterial(storyId);
  const usable = rows.filter((r) => r.body.length > 200 || (r.summary?.length ?? 0) > 80);
  if (usable.length < 2) throw new Error(`story: only ${usable.length} report(s) with enough text; a video needs at least 2`);
  writeFileSync(path.join(dir, "story.json"), JSON.stringify(usable.map((r) => ({
    title: r.title, source: r.source, url: r.url, published_at: r.published_at?.toISOString() ?? "",
    headline: r.headline ?? r.title, summary: r.summary ?? "", body: r.body,
  })), null, 2));
  return { reports: usable.length };
}

/** Runs a video's steps from `from` on; the row records each step, its cost and the outcome. */
export async function makeVideo(id: number, from: Step = "story"): Promise<void> {
  const video = await getVideo(id);
  if (!video) return;
  const dir = workDir(id);
  mkdirSync(dir, { recursive: true });
  let step: Step = from;
  let shortFailed = false;
  // The video's style: chosen from its story the first time, kept (or as the editor or agent set it) afterwards.
  let style = (video.style && video.style in STYLES ? video.style : null) as StyleKey | null;
  if (!style && video.story_id) {
    const channel = channelProfile();
    const chosen = chooseStyle(await styleInputs(video.story_id), channel.styles.byCategory, channel.styles.allowed);
    style = chosen.style;
    await sql`UPDATE video_jobs SET style = ${style}, result = result || ${sql.json({ style: { style, why: chosen.why } } as never)} WHERE id = ${id}`;
  }
  writeFileSync(path.join(dir, "style-preset.json"), JSON.stringify(STYLES[style ?? "news"]));
  try {
    if (!config.modelCallsEnabled) throw new Error("MODEL_CALLS_ENABLED is not true: the script and picture checks call paid models.");
    for (step of STEPS.slice(STEPS.indexOf(from))) {
      await markStep(id, step);
      // The writers follow the channel's approved style rules (style.ts), as they stand when the words are written.
      if (step === "script" || step === "short") writeFileSync(path.join(dir, "style.json"), JSON.stringify(await activeRules()));
      if (step === "story") {
        if (!video.story_id) throw new Error("story: the story was deleted");
        await recordStep(id, step, await writeStory(video.story_id, dir));
      } else if (EXTRAS.includes(step)) {
        // Thumbnail and Short come after the long video: a failure is recorded, the video stays ready.
        if (shortFailed && step !== "thumbnail") { await recordStep(id, step, { skipped: "the Short's earlier step failed" }); continue; }
        const outcome = await run(step, dir).catch((error: Error) => ({ error: error.message.slice(0, 300) }));
        if ("error" in outcome && step !== "thumbnail") shortFailed = true;
        await recordStep(id, step, outcome);
      } else if (step === "verify" || step === "background") {
        // Background research and the fact-check help the video and the reviewer; their failure does not stop it.
        await recordStep(id, step, await run(step, dir).catch((error: Error) => ({ error: error.message.slice(0, 300) })));
      } else {
        await recordStep(id, step, await run(step, dir));
      }
    }
    await finishVideo(id, null);

    // Auto-publish to YouTube if enabled and channel is connected
    if (process.env.VIDEO_AUTO_PUBLISH === "true") {
      try {
        const { youtubeStatus, uploadPrivate, publishPublic } = await import("./youtube.ts");
        const yt = youtubeStatus();
        if (yt.configured && yt.connected) {
          console.log(`[video ${id}] auto-publishing to YouTube...`);
          await reviewVideo(id, "approved");
          await uploadPrivate(id, "auto");
          const pub = await publishPublic(id, "auto");
          console.log(`[video ${id}] successfully auto-published to YouTube! (long: ${pub.longId}, short: ${pub.shortId})`);
        } else {
          console.log(`[video ${id}] auto-publish skipped: YouTube not configured or not connected.`);
        }
      } catch (ytErr) {
        console.error(`[video ${id}] auto-publish to YouTube error:`, (ytErr as Error).message);
      }
    }
  } catch (error) {
    await finishVideo(id, (error as Error).message.slice(0, 1500));
  }
}

/** What the admin page shows of a video's files: its script, picture credits and the end of its log. */
export function videoFiles(id: number) {
  const dir = workDir(id);
  const read = (name: string) => (existsSync(path.join(dir, name)) ? readFileSync(path.join(dir, name), "utf8") : null);
  const script = JSON.parse(read("script-final.json") ?? read("script.json") ?? "null") as null | {
    title: string; description: string; sources?: Array<{ n: number; name: string; url: string; title: string }>;
    scenes: Array<{ kind: string; kicker: string; headline: string; beats: Array<{ narration: string; visual: { type: string; [k: string]: unknown } }> }>;
  };
  const dossier = JSON.parse(read("dossier.json") ?? "null") as null | {
    angle: string; summary: string; facts: unknown[]; quotes: unknown[]; open_questions: string[];
    conflicts: Array<{ topic: string; versions: Array<{ claim: string; sources: number[] }> }>;
  };
  const verify = JSON.parse(read("verify.json") ?? "null") as null | {
    summary: Record<string, number>; checks: Array<{ id: string; text: string; verdict: string; note: string; sources: number[] }>;
  };
  return {
    dossier: dossier && { angle: dossier.angle, summary: dossier.summary, facts: dossier.facts.length, quotes: dossier.quotes.length,
      conflicts: dossier.conflicts, openQuestions: dossier.open_questions },
    verify: verify && { summary: verify.summary, flagged: verify.checks.filter((c) => c.verdict === "partial" || c.verdict === "unsupported") },
    script: script && {
      title: script.title, description: script.description, sources: script.sources ?? [],
      scenes: script.scenes.map((s) => ({ kind: s.kind, kicker: s.kicker, headline: s.headline,
        beats: s.beats.map((b) => ({ narration: b.narration, visual: b.visual.type, detail: visualDetail(b.visual) })) })),
    },
    credits: (read("ATTRIBUTIONS.txt") ?? "").split("\n").filter(Boolean),
    log: (read("log.txt") ?? "").split("\n").slice(-40).join("\n"),
    hasVideo: existsSync(videoFile(id)),
    hasShort: existsSync(shortFile(id)),
    hasThumbnail: existsSync(thumbnailFile(id)),
    short: (() => {
      const s = JSON.parse(read("script-short.json") ?? "null") as null | { title: string; scenes: Array<{ beats: Array<{ narration: string }> }> };
      const v = JSON.parse(read("verify-short.json") ?? "null") as null | { summary: Record<string, number>; checks: Array<{ id: string; text: string; verdict: string; note: string }> };
      return s && { title: s.title, narration: s.scenes.flatMap((x) => x.beats.map((b) => b.narration)),
        verify: v && { summary: v.summary, flagged: v.checks.filter((c) => c.verdict === "partial" || c.verdict === "unsupported") } };
    })(),
  };
}

function visualDetail(v: Record<string, unknown>): string {
  if (v.type === "photo" || v.type === "broll") return String(v.query ?? "");
  if (v.type === "article") return String(v.name ?? "");
  if (v.type === "quote") return String(v.speaker ?? "");
  if (v.type === "stat") return `${v.value ?? ""} ${v.label ?? ""}`.trim();
  if (v.type === "chart") return String(v.title ?? "");
  return "";
}
