// Rescue tools for the local agent (editor MCP) when the free model providers stall.
// - Articles: the agent can see which articles are stuck and send them back through AIHOT's own analysis
//   (retry_failed_articles). It never scores or selects articles itself: selection stays with the engine's prompts,
//   two independent scores, thresholds per channel, and receipts (PIPELINEX.md, "decisions that must be kept").
// - Videos: when the script step keeps failing, the agent may write the long video's script itself. The video is
//   claimed first (requeueVideo refuses a video that is being made), then the script is written, then the video is
//   made again from 'verify', so every sentence is still fact-checked against the reports.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "@aihot/backend/db";
import { enqueueOn } from "@aihot/backend/jobs/queue";
import type { ModuleQueue } from "@aihot/backend/modules";
import { recordEdit } from "./editing.ts";
import { workDir } from "./pipeline.ts";
import { getVideo, requeueVideo, type Step } from "./videos.ts";

export interface StalledArticleRow { id: string; title: string; source: string; url: string; state: string; error: string | null; attempts: number; discoveredAt: Date }

/** Articles that failed, or are waiting to retry after a provider error (403, 429, timeouts), newest first. */
export async function listStalledArticles(limit = 20): Promise<StalledArticleRow[]> {
  const rows = await sql<{ id: string; title: string; source_name: string; url: string; processing_state: string; processing_error: string | null; processing_attempts: number; discovered_at: Date }[]>`
    SELECT a.id, a.title, s.name AS source_name, a.url, a.processing_state, a.processing_error, a.processing_attempts, a.discovered_at
    FROM articles a JOIN sources s ON s.id = a.source_id
    WHERE a.processing_state = 'failed' OR (a.processing_state = 'new' AND a.processing_error IS NOT NULL)
    ORDER BY a.discovered_at DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ id: r.id, title: r.title, source: r.source_name, url: r.url, state: r.processing_state, error: r.processing_error, attempts: r.processing_attempts, discoveredAt: r.discovered_at }));
}

export interface VideoScriptInput {
  title: string;
  description?: string;
  thumbnailText?: string;
  scenes: Array<{ kind: "hook" | "story" | "outro"; kicker: string; headline: string; beats: Array<{ narration: string; visual: { type: "photo" | "broll" | "card"; query?: string; text?: string }; facts?: string[] }> }>;
}

/** Saves an agent-written long-video script and makes the video again from 'verify' (fact-check, pictures, voice…). */
export async function rescueVideoScript(id: number, actor: string, input: VideoScriptInput, makeQueue: ModuleQueue<{ id: number; from: Step }>, note?: string) {
  if (!(await getVideo(id))) throw new Error(`No video #${id}.`);
  for (const scene of input.scenes) for (const beat of scene.beats) {
    const v = beat.visual;
    if ((v.type === "photo" || v.type === "broll") && !v.query) throw new Error(`A ${v.type} beat needs a search query ("${beat.narration.slice(0, 40)}…").`);
  }
  // Claim the video before touching its files: this throws VideoConflict while it is queued or being made.
  await requeueVideo(id, "verify");
  const dir = workDir(id);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "script.json");
  // The report list (for citations and the publish kit) comes from the script step; keep it when there is one.
  const previous = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { sources?: unknown }) : null;
  const script = {
    title: input.title,
    description: input.description ?? "",
    ...(input.thumbnailText ? { thumbnail_text: input.thumbnailText } : {}),
    scenes: input.scenes.map((s) => ({ ...s, beats: s.beats.map((b) => ({ ...b, facts: b.facts ?? [] })) })),
    sources: previous?.sources ?? [],
    written_by: actor,
  };
  writeFileSync(file, JSON.stringify(script, null, 2));
  await enqueueOn(makeQueue, { id, from: "verify" });
  recordEdit(id, { actor, kind: "edit", detail: { variant: "long", script: "rescue", title: input.title }, note: note ?? "Script written by the agent (script step stalled)" });
  return { id, title: input.title, from: "verify" as Step, message: `Script saved. Video #${id} is queued from 'verify' (fact-check, pictures, voice, render).` };
}
