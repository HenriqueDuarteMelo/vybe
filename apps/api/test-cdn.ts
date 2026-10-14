import { httpRequestText } from "./src/utils/http.js";

const urls = [
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  "https://archive.org/metadata/nasatexaswaltz",
  "https://ia800605.us.archive.org/24/items/NASATexasWaltz/nasa1_512kb.mp3",
  "https://www.w3schools.com/html/horse.mp3",
  "https://file-examples.com/wp-content/storage/2017/11/file_example_MP3_700KB.mp3",
  "https://cdn.pixabay.com/audio/2022/...",
  "https://freemusicarchive.org/api/get/...",
];

for (const url of urls) {
  try {
    const text = await httpRequestText(url, { timeoutMs: 10000 });
    console.log("OK  ", url.slice(0, 70), "bytes:", text.length, "head:", text.slice(0, 12).replace(/[^ -~]/g, "."));
  } catch (e) {
    console.log("FAIL", url.slice(0, 70), "=>", e instanceof Error ? e.message.split("\n")[0] : e);
  }
}