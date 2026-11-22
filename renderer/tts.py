"""Step "voice": the script -> one MP3 per beat + word timings -> timeline.json.

Voice: Azure AI Speech when AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are set (licensed for commercial use; free tier
500,000 characters a month), else edge-tts (the Edge browser's read-aloud service: no commercial licence, throttles).
Both speak the same neural voice, so a beat Azure fails on can fall back to edge-tts without a change of voice.
VIDEO_TTS=edge forces edge-tts.

Usage: VIDEO_WORKDIR=<dir> [VIDEO_VARIANT=short] python tts.py [voice]
  (reads <dir>/script-final.json or script-short.json, writes <dir>/public/audio and <dir>/timeline.json or timeline-short.json)
"""
import asyncio, datetime, json, os, shutil, subprocess, sys
from pathlib import Path

try:
    import edge_tts
    import aiohttp
except ImportError:
    raise SystemExit("edge-tts is not installed: run `npm run video:setup` in the project root")

# The pipeline reads this program's output as UTF-8; a Windows console otherwise uses a legacy code page.
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).resolve().parent

AZURE_KEY = os.environ.get("AZURE_SPEECH_KEY", "")
AZURE_REGION = os.environ.get("AZURE_SPEECH_REGION", "")
USE_AZURE = bool(AZURE_KEY and AZURE_REGION) and os.environ.get("VIDEO_TTS", "") != "edge"

VOICE = sys.argv[1] if len(sys.argv) > 1 else "en-US-AndrewMultilingualNeural"
ALT_VOICE_QUOTE = os.environ.get("VIDEO_ALT_VOICE_QUOTE", "en-US-GuyNeural")
ALT_VOICE_CONFLICT = os.environ.get("VIDEO_ALT_VOICE_CONFLICT", "en-US-AvaMultilingualNeural")
W = Path(os.environ.get("VIDEO_WORKDIR", "work"))
VARIANT = os.environ.get("VIDEO_VARIANT", "")
IN = "script-short.json" if VARIANT == "short" else "script-final.json"
TIMELINE = f"timeline-{VARIANT}.json" if VARIANT else "timeline.json"
PREFIX = f"{VARIANT}-" if VARIANT else ""
OUT = W / "public" / "audio"; OUT.mkdir(parents=True, exist_ok=True)
SHORT = VARIANT == "short"
BEAT_GAP = 0.1 if SHORT else 0.25   # pause between beats inside a scene (a Short keeps moving)
SCENE_GAP = 0.3 if SHORT else 0.7   # pause between scenes
# The video's style (style-preset.json, written by the pipeline) sets the pace and the music's mood.
PRESET = json.loads((W / "style-preset.json").read_text(encoding="utf-8")) if (W / "style-preset.json").exists() else None
# The channel's brand for the title cards (industry/channel.json of the checkout that runs the pipeline).
INDUSTRY = Path(os.environ.get("VIDEO_INDUSTRY_DIR") or HERE.parent / "industry")
CHANNEL = json.loads((INDUSTRY / "channel.json").read_text(encoding="utf-8"))
RATE = (PRESET["voice"]["shortRate"] if SHORT else PRESET["voice"]["rate"]) if PRESET else ("+10%" if SHORT else "+4%")


def duration(path: Path) -> float:
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                             capture_output=True, text=True, encoding="utf-8", errors="replace", check=True).stdout
    except FileNotFoundError:
        raise SystemExit("ffprobe not found on PATH: install FFmpeg (it includes ffprobe), then open a new terminal")
    return float(out.strip())


ENGINES: dict = {"azure": 0, "edge": 0, "cached": 0}


PREFERRED = "azure" if USE_AZURE else "edge"


def resolve_beat_voice(b: dict) -> str:
    """Multi-voice dialogue: alternate Edge-TTS neural voices for quotes, conflicts, or distinct speakers."""
    if b.get("voice"):
        return b["voice"]
    vis = b.get("visual") or {}
    if vis.get("type") == "quote" or vis.get("speaker"):
        return ALT_VOICE_QUOTE
    if vis.get("conflict") or b.get("conflict") or vis.get("perspective"):
        return ALT_VOICE_CONFLICT
    return VOICE


def get_cached(name: str, text: str, voice: str = VOICE):
    """A beat recorded before with the same words, voice, rate and engine is reused (remakes from 'voice' after an
    edit_script re-record only the edited beats). A beat that fell back to edge-tts is recorded again once Azure works."""
    path, meta_path = OUT / f"{name}.mp3", OUT / f"{name}.meta.json"
    if not (path.exists() and path.stat().st_size > 0 and meta_path.exists()):
        return None
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except ValueError:
        return None
    if (meta.get("engine"), meta.get("voice"), meta.get("rate"), meta.get("text")) != (PREFERRED, voice, RATE, text):
        return None
    return path, meta.get("words", []), meta.get("duration")


def put_cache(name: str, text: str, engine: str, words: list, d: float, voice: str = VOICE):
    (OUT / f"{name}.meta.json").write_text(json.dumps({"engine": engine, "voice": voice, "rate": RATE, "text": text, "words": words, "duration": d}), encoding="utf-8")


def speak_azure(name: str, text: str, voice: str = VOICE):
    """Azure AI Speech: SSML with the same voice and rate; word timings from its word-boundary events."""
    import azure.cognitiveservices.speech as sdk
    from xml.sax.saxutils import escape
    path = OUT / f"{name}.mp3"
    cfg = sdk.SpeechConfig(subscription=AZURE_KEY, region=AZURE_REGION)
    cfg.set_speech_synthesis_output_format(sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3)
    synth = sdk.SpeechSynthesizer(speech_config=cfg, audio_config=sdk.audio.AudioOutputConfig(filename=str(path)))
    words = []

    def boundary(evt):
        if evt.boundary_type == sdk.SpeechSynthesisBoundaryType.Word:
            start = evt.audio_offset / 1e7
            words.append({"text": evt.text, "start": round(start, 3), "end": round(start + evt.duration.total_seconds(), 3)})
    synth.synthesis_word_boundary.connect(boundary)
    ssml = (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="{voice}">'
            f'<prosody rate="{RATE}">{escape(text)}</prosody></voice></speak>')
    result = synth.speak_ssml_async(ssml).get()
    if result.reason != sdk.ResultReason.SynthesizingAudioCompleted:
        detail = result.cancellation_details
        raise RuntimeError(f"Azure TTS {result.reason}: {getattr(detail, 'reason', '')} {getattr(detail, 'error_details', '')}".strip())
    del synth  # closes the output file
    return path, words


async def speak(name: str, text: str, voice: str = VOICE):
    if USE_AZURE:
        for attempt in range(3):
            try:
                path, words = await asyncio.to_thread(speak_azure, name, text, voice)
                ENGINES["azure"] += 1
                return path, words, "azure"
            except Exception as error:  # throttling (429) or a network error: wait, then try again
                print(f"{name}: Azure failed ({str(error)[:160]}), {'retrying' if attempt < 2 else 'using edge-tts for this beat'}")
                if attempt < 2:
                    await asyncio.sleep(3 * (attempt + 1))
    ENGINES["edge"] += 1
    path, words = await speak_edge(name, text, voice)
    return path, words, "edge"


async def speak_edge(name: str, text: str, voice: str = VOICE):
    # The service sometimes answers with no audio; try again before failing the video.
    # The service throttles bursts: wait longer each time (5, 10, 20, 40 s) before giving up.
    for attempt in range(5):
        try:
            return await speak_once(name, text, voice)
        except (edge_tts.exceptions.EdgeTTSException, aiohttp.ClientError, TimeoutError):
            if attempt == 4:
                raise
            print(f"{name}: {type(error).__name__}: {str(error)[:120]}, retrying")
            await asyncio.sleep(5 * 2 ** attempt)


async def speak_once(name: str, text: str, voice: str = VOICE):
    path = OUT / f"{name}.mp3"
    words = []
    comm = edge_tts.Communicate(text, voice, rate=RATE, boundary="WordBoundary")
    with open(path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({"text": chunk["text"], "start": round(chunk["offset"] / 1e7, 3),
                              "end": round((chunk["offset"] + chunk["duration"]) / 1e7, 3)})
    return path, words


def brand() -> dict:
    """The channel's brand for the cards; its mark (brand.mark in channel.json, relative to the industry folder) is
    copied into the video's public folder so the renderer can draw it."""
    b = dict(CHANNEL["brand"])
    mark = INDUSTRY / b["mark"] if b.get("mark") else None
    if mark and mark.exists():
        shutil.copy(mark, W / "public" / "brand-mark.svg")
        b["mark"] = "brand-mark.svg"
    else:
        b.pop("mark", None)
    return b


async def main():
    script = json.loads((W / IN).read_text(encoding="utf-8"))
    t = 0.0
    scenes = []
    for si, s in enumerate(script["scenes"]):
        scene_start = t
        beats = []
        for bi, b in enumerate(s["beats"]):
            beat_name = f"{PREFIX}s{si:02d}b{bi:02d}"
            beat_voice = resolve_beat_voice(b)
            cached = get_cached(beat_name, b["narration"], beat_voice)
            if cached:
                path, words, d = cached
                ENGINES["cached"] += 1
                if d is None:
                    d = duration(path)
            else:
                path, words, engine = await speak(beat_name, b["narration"], beat_voice)
                d = duration(path)
                put_cache(beat_name, b["narration"], engine, words, d, beat_voice)
            gap = SCENE_GAP if bi == len(s["beats"]) - 1 else BEAT_GAP
            beats.append({**b, "voice": beat_voice, "audio": f"audio/{path.name}", "start": round(t - scene_start, 3), "duration": round(d + gap, 3), "words": words})
            t += d + gap
        scenes.append({k: s[k] for k in ("kind", "kicker", "headline")} | {"start": round(scene_start, 3), "duration": round(t - scene_start, 3), "beats": beats})
        print(f"scene {si}: {t - scene_start:5.1f}s, {len(beats)} beats")
    # Optional music bed: VIDEO_MUSIC, else the first track in renderer/music/ (e.g. from the YouTube Audio Library).
    music_dir = HERE / "music"
    mood_tracks = sorted((music_dir / PRESET["music"]).glob("*.mp3")) if PRESET else []
    music = os.environ.get("VIDEO_MUSIC") or next((str(p) for p in mood_tracks), None) or next((str(p) for p in sorted(music_dir.glob("*.mp3"))), None)
    if music and Path(music).exists() and str(Path(music).resolve()) != str((W / "public" / "music.mp3").resolve()):
        shutil.copy(music, W / "public" / "music.mp3")
    today = datetime.date.today()
    timeline = {"title": script["title"], "thumbnail_text": script.get("thumbnail_text"), "voice": VOICE, "total": round(t, 3), "scenes": scenes, "sources": script["sources"],
                "mainTitle": script.get("mainTitle"),
                "mainVideo": script.get("mainVideo"),
                "music": "music.mp3" if music and Path(music).exists() else None,
                "date": f"{today:%b} {today.day}, {today.year}",
                "style": PRESET["key"] if PRESET else "news", "palette": PRESET["visual"] if PRESET else None,
                "brand": brand()}
    (W / TIMELINE).write_text(json.dumps(timeline, indent=2), encoding="utf-8")
    print(f"total {t:.1f}s")
    chars = sum(len(b["narration"]) for s in script["scenes"] for b in s["beats"])
    engine = ("azure" if ENGINES["azure"] and not ENGINES["edge"]
              else "edge" if ENGINES["edge"] and not ENGINES["azure"]
              else "mixed" if (ENGINES["azure"] or ENGINES["edge"])
              else "cached")
    print("RESULT " + json.dumps({"duration": round(t, 1), "engine": engine,
                                  "beats": ENGINES, "characters": chars}))


asyncio.run(main())
