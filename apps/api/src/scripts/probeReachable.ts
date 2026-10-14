import { httpRequestText } from "../utils/http.js";
const probes: Array<{ name: string; url: string }> = [
  { name: "api.deezer.com search", url: "https://api.deezer.com/search?q=rick%20astley&limit=1&output=json" },
  { name: "api.deezer.com track", url: "https://api.deezer.com/track/3135552" },
  { name: "itunes searchfeed", url: "https://itunes.apple.com/search?term=rick+astley&media=music&limit=1" },
  { name: "archive.org metadata", url: "https://archive.org/metadata/SEARCHTERM/rick-astley" },
  { name: "soundhelix sample", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
];
for (const p of probes) {
  const t0 = Date.now();
  try {
    const text = await httpRequestText(p.url, { timeoutMs: 10000 });
    console.log(`OK  ${String(Date.now() - t0).padStart(5)}ms  ${p.name}   bytes=${text.length}  head=${JSON.stringify(text.slice(0, 48))}`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.log(`ERR ${String(Date.now() - t0).padStart(5)}ms  ${p.name}  -> ${m.slice(0, 80)}`);
  }
}
