// Prepares the Python environment the video voice step needs (renderer/tts.py) on Windows, macOS and Linux.
// Idempotent: installs the pinned requirements into renderer/.venv, or into $VIDEO_PYTHON when it is set.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const RENDERER = path.join(ROOT, "renderer");
const VENV = path.join(RENDERER, ".venv");
const WINDOWS = process.platform === "win32";
const VENV_PYTHON = path.join(VENV, WINDOWS ? "Scripts" : "bin", WINDOWS ? "python.exe" : "python");

/** Runs a command the user can watch; exits with its code when it fails. */
function run(bin: string, args: string[], cwd = ROOT) {
  const result = spawnSync(bin, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** The first Python 3.10+ on this machine: $VIDEO_PYTHON, the Windows launcher, then python/python3. */
function findPython(): [string, string[]] {
  const candidates: Array<[string, string[]]> = process.env.VIDEO_PYTHON
    ? [[process.env.VIDEO_PYTHON, []]]
    : WINDOWS ? [["py", ["-3"]], ["python", []], ["python3", []]] : [["python3", []], ["python", []]];
  let tooOld = "";
  for (const [bin, prefix] of candidates) {
    const result = spawnSync(bin, [...prefix, "--version"], { encoding: "utf8" });
    if (result.error || result.status !== 0) continue;
    const version = /Python (\d+)\.(\d+)/.exec(`${result.stdout ?? ""}${result.stderr ?? ""}`);
    if (!version) continue;
    if (Number(version[1]) === 3 && Number(version[2]) >= 10) return [bin, prefix];
    tooOld = `${bin}: ${(result.stdout ?? "").trim()}`;
  }
  if (process.env.VIDEO_PYTHON) {
    throw new Error(`VIDEO_PYTHON (${process.env.VIDEO_PYTHON}) is not a working Python 3.10+; fix the path or unset it to use renderer/.venv.`);
  }
  throw new Error(tooOld
    ? `${tooOld} is too old; Python 3.10 or newer is needed (https://www.python.org/downloads/).`
    : "No Python 3.10+ found. Install it from https://www.python.org/downloads/ and run this again.");
}

try {
  const [python, prefix] = findPython();
  if (!process.env.VIDEO_PYTHON) {
    if (!existsSync(VENV_PYTHON)) {
      if (existsSync(VENV)) throw new Error(`renderer/.venv is incomplete (${VENV_PYTHON} is missing). Delete renderer/.venv and run this again.`);
      console.log(`Creating renderer/.venv with ${python} ...`);
      run(python, [...prefix, "-m", "venv", VENV]);
    }
  }
  const interpreter = process.env.VIDEO_PYTHON || VENV_PYTHON;

  console.log(`Installing renderer/requirements.txt into ${interpreter} ...`);
  run(interpreter, ["-m", "pip", "install", "--disable-pip-version-check", "-r", path.join(RENDERER, "requirements.txt")], RENDERER);
  run(interpreter, ["-c", "import edge_tts, azure.cognitiveservices.speech"]);

  if (spawnSync("ffprobe", ["-version"], { stdio: "ignore" }).status !== 0) {
    console.warn("Warning: ffprobe is not on PATH; the voice step needs FFmpeg (https://ffmpeg.org/download.html).");
  }
  if (!existsSync(path.join(RENDERER, "node_modules", "@remotion", "cli", "remotion-cli.js"))) {
    console.warn("Warning: renderer/node_modules is missing; run `npm install` in renderer/ before rendering.");
  }
  console.log(`Voice environment ready: ${interpreter}`);
} catch (error) {
  console.error(`video:setup: ${(error as Error).message}`);
  process.exit(1);
}
