// Generates SPARK's original, short mechanical palette-detent sound.
// No third-party or device/OEM audio is copied.
const fs = require('node:fs');
const path = require('node:path');

const SAMPLE_RATE = 44_100;
const DURATION_SECONDS = 0.012;
const SAMPLE_COUNT = Math.round(SAMPLE_RATE * DURATION_SECONDS);
const outputPath = path.join(__dirname, '..', 'assets', 'audio', 'palette-detent.wav');

let randomState = 0x53_50_41_52;
function noise() {
  randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
  return ((randomState / 0xffff_ffff) * 2) - 1;
}

const samples = new Float64Array(SAMPLE_COUNT);
let peak = 0;
let previousNoise = 0;
for (let index = 0; index < SAMPLE_COUNT; index += 1) {
  const t = index / SAMPLE_RATE;
  const tickEnvelope = Math.exp(-t * 720);
  const edgeEnvelope = Math.exp(-t * 980);
  const currentNoise = noise();
  const highPassedNoise = currentNoise - previousNoise;
  previousNoise = currentNoise;

  // Tek ve tiz “tik”: bas gövdesi, gecikmeli ikinci mandal ve uzun rezonans yok.
  // Bu özgün sentez herhangi bir Samsung/OEM ses örneğini kopyalamaz.
  let value = Math.sin((2 * Math.PI * 3_850 * t) + 0.38) * tickEnvelope * 0.34;
  value += Math.sin((2 * Math.PI * 7_100 * t) + 0.75) * edgeEnvelope * 0.13;
  value += highPassedNoise * edgeEnvelope * 0.38;

  const fadeOut = Math.min(1, Math.max(0, (DURATION_SECONDS - t) / 0.0015));
  samples[index] = value * fadeOut;
  peak = Math.max(peak, Math.abs(samples[index]));
}

const dataSize = SAMPLE_COUNT * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write('WAVE', 8);
wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(SAMPLE_RATE, 24);
wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(dataSize, 40);

const gain = peak > 0 ? 0.88 / peak : 0;
for (let index = 0; index < SAMPLE_COUNT; index += 1) {
  const pcm = Math.round(Math.max(-1, Math.min(1, samples[index] * gain)) * 32_767);
  wav.writeInt16LE(pcm, 44 + (index * 2));
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, wav);
console.log(`Generated ${path.relative(process.cwd(), outputPath)} (${SAMPLE_COUNT} samples)`);
