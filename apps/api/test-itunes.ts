import { httpRequestText } from "./src/utils/http.js";

for (const url of [
  "https://itunes.apple.com/search?term=cbjr&media=music&limit=5",
  "https://itunes.apple.com/search?term=charlie+brown+jr&media=music&limit=3",
]) {
  try {
    const text = await httpRequestText(url, { timeoutMs: 15000 });
    const j = JSON.parse(text);
    console.log("OK", url.slice(0, 60), "=>", j.resultCount, "results");
    for (const r of j.results?.slice(0, 3) ?? []) {
      console.log("   ", r.artistName, "-", r.trackName, "|", r.previewUrl?.slice(0, 60));
    }
  } catch (e) {
    console.log("FAIL", url.slice(0, 60), "=>", e instanceof Error ? e.message.split("\n")[0] : e);
  }
}