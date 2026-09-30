/**
 * Tiny PCM WAV used by local seed so a soundtrack can play without a vendor file.
 */
export function encodePcmWavTone(input: {
  frequencyHz: number;
  durationSeconds: number;
  sampleRate?: number;
}): Uint8Array {
  const sampleRate = input.sampleRate ?? 22_050;
  const samples = Math.max(1, Math.floor(sampleRate * Math.max(0.1, input.durationSeconds)));
  const dataSize = samples * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
  for (let index = 0; index < samples; index += 1) {
    const sample = Math.sin((2 * Math.PI * input.frequencyHz * index) / sampleRate) * 0.35;
    view.setInt16(44 + index * 2, Math.round(sample * 32_767), true);
  }
  return bytes;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}
