import { createWriteStream, mkdirSync } from "fs";
import { join, resolve } from "path";

const SAMPLE_RATE = 11025;
const BYTES_PER_SAMPLE = 1;
const CHANNELS = 1;

const SCALE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function writeWavHeader(
  header: Buffer,
  dataSize: number,
  sampleRate: number
): void {
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * CHANNELS * BYTES_PER_SAMPLE, 28);
  header.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32);
  header.writeUInt16LE(BYTES_PER_SAMPLE * 8, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);
}

function melodySample(
  time: number,
  noteIndex: number,
  noteDuration: number,
  rootFreq: number
): number {
  const notePos = Math.floor(time / noteDuration);
  const noteFreq = SCALE[(noteIndex + notePos) % SCALE.length] * (rootFreq / SCALE[0]);
  const t = time % noteDuration;

  const attack = Math.min(1, t / 0.02);
  const release = Math.min(1, (noteDuration - t) / 0.08);
  const env = Math.max(0, attack * release);

  const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5 * time);
  const fundamental = Math.sin(2 * Math.PI * noteFreq * vib * time);
  const harmonic = 0.3 * Math.sin(2 * Math.PI * noteFreq * 2 * vib * time);
  const sub = 0.15 * Math.sin(2 * Math.PI * noteFreq * 0.5 * time);

  return env * 0.6 * (fundamental + harmonic + sub);
}

function getNoteIndexForTrack(trackId: string): number {
  return hashString(trackId) % SCALE.length;
}

function getRootFreqForTrack(trackId: string): number {
  return 110 * (1 + (hashString(trackId) % 8) * 0.15);
}

export function generateAudioFile(
  outputDir: string,
  trackId: string,
  seconds: number
): string {
  const fileName = `${trackId}.wav`;
  const dir = resolve(outputDir);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, fileName);

  const totalSamples = Math.floor(seconds * SAMPLE_RATE);
  const header = Buffer.alloc(44);
  writeWavHeader(header, totalSamples, SAMPLE_RATE);

  const noteIndex = getNoteIndexForTrack(trackId);
  const rootFreq = getRootFreqForTrack(trackId);
  const noteDuration = 0.5 + (hashString(trackId) % 5) * 0.2;

  const stream = createWriteStream(filePath);
  stream.write(header);

  const CHUNK = SAMPLE_RATE; // 1 second per chunk
  for (let offset = 0; offset < totalSamples; offset += CHUNK) {
    const size = Math.min(CHUNK, totalSamples - offset);
    const buffer = Buffer.alloc(size);
    for (let i = 0; i < size; i++) {
      const time = (offset + i) / SAMPLE_RATE;
      const sample = melodySample(time, noteIndex, noteDuration, rootFreq);
      const clamped = Math.max(-1, Math.min(1, sample));
      buffer[i] = Math.round((clamped + 1) * 127.5);
    }
    stream.write(buffer);
  }

  return new Promise<string>((resolvePromise, reject) => {
    stream.on("error", reject);
    stream.end(() => resolvePromise(fileName));
  });
}