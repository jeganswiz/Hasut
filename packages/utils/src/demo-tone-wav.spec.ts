import { encodePcmWavTone } from "./demo-tone-wav";

describe("encodePcmWavTone", () => {
  it("writes a RIFF WAVE header and enough PCM for the duration", () => {
    const wav = encodePcmWavTone({ frequencyHz: 440, durationSeconds: 1, sampleRate: 8_000 });
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...wav.subarray(8, 12))).toBe("WAVE");
    expect(wav.byteLength).toBe(44 + 8_000 * 2);
  });
});
