# Applications

Practical filter recipes by domain. Each recipe shows the exact code, explains the parameter choices, and links to the relevant module.

All examples assume:

```js
import {
  biquad, filter, freqz, mag2db,
  butterworth, elliptic, bessel, chebyshev,
  linkwitzRiley, crossover,
  graphicEq, parametricEq,
  kWeighting, aWeighting, riaa,
  svf, moogLadder, formant,
  allpass, comb, onePole, envelope,
  emphasis, deemphasis, levinson,
  nlms, lms,
  raisedCosine, matchedFilter,
  decimate, interpolate, noiseShaping,
  octaveBank, convolution, filtfilt,
  dcBlocker
} from 'digital-filter'
```

---

## Audio processing

### Parametric EQ

Boost/cut specific frequency bands. Each band is a `biquad.peaking` bell curve controlled by center frequency, Q (bandwidth), and gain.

```js
let data = new Float64Array(buffer)
let fs = 44100

// Warm up low-mids, tame harshness, add air
parametricEq(data, {
  fs,
  bands: [
    { fc: 200,   Q: 0.8, gain: 3 },    // +3 dB warmth
    { fc: 3000,  Q: 2,   gain: -4 },   // -4 dB de-harsh
    { fc: 12000, Q: 0.7, gain: 2, type: 'highshelf' }  // +2 dB air
  ]
})
```

**Parameter guidance**: Q=0.5-1 for broad shaping, Q=2-8 for surgical cuts, Q=10+ for notch-like precision. Gain in dB: keep boosts under +6, cuts can go deeper.

### Graphic EQ

10-band ISO octave EQ. Set gains in dB at standard center frequencies.

```js
let data = new Float64Array(buffer)

graphicEq(data, {
  fs: 44100,
  gains: {
    62.5: -2,   // cut mud
    250: 3,     // body
    1000: 0,    // flat
    4000: 2,    // presence
    8000: -1    // tame sibilance
  }
})
```

Bands with 0 dB gain are skipped (no processing cost). Internal Q is 1.4 (standard octave bandwidth).

### Crossover networks

Split a signal into frequency bands for multi-driver speakers.

**2-way crossover** at 2 kHz (woofer + tweeter):

```js
let lr = linkwitzRiley(4, 2000, 44100)

let low = Float64Array.from(data)
let high = Float64Array.from(data)
filter(low, { coefs: lr.low })
filter(high, { coefs: lr.high })
// low + high sums to flat (allpass)
```

**3-way crossover** (woofer + mid + tweeter):

```js
let bands = crossover([500, 4000], 4, 44100)

let woofer = Float64Array.from(data)
let mid = Float64Array.from(data)
let tweeter = Float64Array.from(data)
filter(woofer, { coefs: bands[0] })
filter(mid, { coefs: bands[1] })
filter(tweeter, { coefs: bands[2] })
```

LR-4 (order 4) is the standard for active crossovers. LR-2 has gentler slopes (-12 dB/oct) if drivers have wide overlap. LR-8 for very steep digital crossovers.

### Loudness metering (LUFS)

ITU-R BS.1770 integrated loudness. K-weighting models perceived loudness, then measure RMS over gated blocks.

```js
let fs = 48000
let sos = kWeighting(fs)

// K-weight the signal
let data = Float64Array.from(buffer)
filter(data, { coefs: sos })

// RMS over 400ms blocks (momentary loudness)
let blockSize = Math.round(0.4 * fs)
for (let i = 0; i + blockSize <= data.length; i += blockSize) {
  let block = data.subarray(i, i + blockSize)
  let sum = 0
  for (let j = 0; j < block.length; j++) sum += block[j] * block[j]
  let rms = sum / block.length
  let lufs = -0.691 + 10 * Math.log10(rms)
  // lufs is the momentary loudness of this block
}
```

For stereo: sum the mean-square of both K-weighted channels. For surround: apply channel weights (1.41 for Ls/Rs).

### De-essing

Reduce sibilance (2-8 kHz) by detecting it with an envelope follower and applying frequency-selective gain reduction.

```js
let fs = 44100
let data = new Float64Array(buffer)

// Sidechain: extract sibilance band energy
let sc = Float64Array.from(data)
let scParams = { coefs: biquad.bandpass(5500, 2, fs) }
filter(sc, scParams)
envelope(sc, { attack: 0.001, release: 0.02, fs })

// Apply gain reduction where sibilance is detected
let threshold = 0.1
for (let i = 0; i < data.length; i++) {
  if (sc[i] > threshold) {
    let reduction = threshold / sc[i]  // compress above threshold
    data[i] *= reduction
  }
}
```

Bandpass at 5-7 kHz catches most sibilance. Fast attack (1 ms) catches transients, moderate release (20 ms) avoids pumping.

### Rumble removal

Remove subsonic content (turntable rumble, handling noise, wind) with a highpass filter.

```js
let data = new Float64Array(buffer)

// Order 2: gentle, preserves bass feel
let sos = butterworth(2, 30, 44100, 'highpass')
filter(data, { coefs: sos })

// Order 4: steeper, for serious rumble problems
let sos4 = butterworth(4, 40, 44100, 'highpass')
filter(data, { coefs: sos4 })
```

20-30 Hz for gentle cleanup (most content above 40 Hz is unaffected). 40 Hz for aggressive rumble removal (some bass impact lost). Order 2 (-12 dB/oct) is usually enough; order 4 (-24 dB/oct) for severe cases.

### Hum removal

Remove mains hum (50 Hz in Europe/Asia, 60 Hz in Americas) and its harmonics.

```js
let fs = 44100

// 60 Hz hum + harmonics (120, 180, 240 Hz)
let notches = [60, 120, 180, 240].map(f => biquad.notch(f, 30, fs))

let data = new Float64Array(buffer)
for (let n of notches) {
  filter(data, { coefs: n })
}
```

Q=30 gives a narrow null (~2 Hz wide at -3 dB) — removes hum without affecting music. Lower Q (10-15) if hum frequency wobbles. For 50 Hz regions, use `[50, 100, 150, 200]`.

### Sample rate conversion

**Downsample** from 96 kHz to 48 kHz:

```js
let data96k = new Float64Array(buffer)  // 96 kHz signal
let data48k = decimate(data96k, 2, { fs: 96000 })
```

**Upsample** from 44.1 kHz to 88.2 kHz:

```js
let data44k = new Float64Array(buffer)
let data88k = interpolate(data44k, 2, { fs: 44100 })
```

`decimate` applies an anti-aliasing lowpass before downsampling. `interpolate` applies an anti-imaging lowpass after upsampling. Both use FIR filters internally for linear phase.

### Noise shaping for dithering

When quantizing to 16-bit, shape the quantization noise to be less audible (push it above 15 kHz where hearing is less sensitive).

```js
let data = new Float64Array(buffer)  // 24-bit float signal

noiseShaping(data, { bits: 16 })
```

First-order noise shaping (the default) pushes error energy toward high frequencies. The ear perceives this as ~3 dB less noise than flat dithering.

### Vinyl playback (RIAA)

Apply the RIAA de-emphasis curve to decode vinyl records. The recording curve boosts high frequencies; the playback curve cuts them back, reducing surface noise.

```js
let sos = riaa(44100)
let data = new Float64Array(buffer)
filter(data, { coefs: sos })
```

The RIAA curve has three time constants: bass boost below 50 Hz, treble cut above 2.1 kHz, with a shelf at 500 Hz. Normalized to 0 dB at 1 kHz.

---

## Music synthesis

### Subtractive synth filter

Classic analog synth approach: shape a harmonically rich source (sawtooth, square) with a resonant lowpass filter driven by an envelope.

```js
let fs = 44100
let data = new Float64Array(1024)  // sawtooth oscillator output

// Moog ladder: warm, -24 dB/oct, self-oscillates at resonance=1
let params = { fc: 800, resonance: 0.6, fs }
moogLadder(data, params)

// To animate the cutoff (envelope), update fc per block:
params.fc = 200 + 3000 * envelopeValue  // sweep 200-3200 Hz
moogLadder(nextBlock, params)
```

`resonance` 0 = no resonance, 0.5 = pronounced peak, 1.0 = self-oscillation (screaming). `moogLadder` is -24 dB/oct (4-pole). For gentler slopes, use `svf` (-12 dB/oct) or `korg35` (nonlinear -12 dB/oct).

### Resonant sweep

Automate filter cutoff for sweeps, wobbles, and filter modulation.

```js
let fs = 44100
let data = new Float64Array(1024)  // source signal
let params = { type: 'lowpass', Q: 5, fs }  // Q=5 for strong resonance

// Sweep from 200 Hz to 8000 Hz
for (let block = 0; block < numBlocks; block++) {
  let t = block / numBlocks
  params.fc = 200 * Math.pow(40, t)  // exponential sweep
  svf(audioBlock, params)
}
```

SVF recalculates coefficients when `fc` or `Q` changes. Exponential sweep sounds more natural than linear (matches pitch perception). Q=1-3 for gentle resonance, Q=5-20 for acid-style screams.

### Formant synthesis

Simulate vowel sounds using parallel resonator banks. Each vowel has characteristic formant frequencies (F1, F2, F3).

```js
let fs = 44100
let data = new Float64Array(1024)  // impulse train or noise source

// Vowel presets (formant frequencies and bandwidths in Hz)
let vowels = {
  a: [{ fc: 730,  bw: 90,  gain: 1 }, { fc: 1090, bw: 110, gain: 0.5 }, { fc: 2440, bw: 170, gain: 0.3 }],
  e: [{ fc: 530,  bw: 60,  gain: 1 }, { fc: 1840, bw: 120, gain: 0.5 }, { fc: 2480, bw: 150, gain: 0.3 }],
  i: [{ fc: 270,  bw: 50,  gain: 1 }, { fc: 2290, bw: 130, gain: 0.5 }, { fc: 3010, bw: 160, gain: 0.3 }],
  o: [{ fc: 570,  bw: 70,  gain: 1 }, { fc: 840,  bw: 80,  gain: 0.5 }, { fc: 2410, bw: 170, gain: 0.3 }],
  u: [{ fc: 300,  bw: 50,  gain: 1 }, { fc: 870,  bw: 90,  gain: 0.5 }, { fc: 2240, bw: 160, gain: 0.3 }],
}

formant(data, { formants: vowels.a, fs })
```

These are average male formant values (from Peterson & Barney 1952). For female voices, shift all frequencies up ~20%. Bandwidths control resonance sharpness: narrower = more tonal, wider = more breathy.

### Phaser effect

A phaser cascades several allpass filters whose center frequencies are modulated by an LFO, creating moving notches in the spectrum.

```js
let fs = 44100
let lfoRate = 0.5  // Hz

// 4-stage phaser (4 notches)
let stages = [
  { fc: 200, Q: 0.707, fs },
  { fc: 600, Q: 0.707, fs },
  { fc: 1200, Q: 0.707, fs },
  { fc: 3000, Q: 0.707, fs },
]

for (let block = 0; block < numBlocks; block++) {
  let t = block * blockSize / fs
  let lfo = Math.sin(2 * Math.PI * lfoRate * t)  // -1 to +1

  // Modulate center frequencies
  let depth = 0.5  // octaves of sweep
  let mod = Math.pow(2, lfo * depth)
  stages[0].fc = 200 * mod
  stages[1].fc = 600 * mod
  stages[2].fc = 1200 * mod
  stages[3].fc = 3000 * mod

  let wet = Float64Array.from(audioBlock)
  for (let s of stages) allpass.second(wet, s)

  // Mix dry + wet (notches appear at phase cancellation points)
  for (let i = 0; i < audioBlock.length; i++) {
    audioBlock[i] = 0.5 * audioBlock[i] + 0.5 * wet[i]
  }
}
```

More stages = more notches = thicker sound. 4 stages is classic, 6-12 for dense. LFO rate 0.1-2 Hz for slow sweeps, higher for vibrato-like effects.

### Karplus-Strong string

Physical model of a plucked string: a short burst of noise fed through a feedback comb filter with a lowpass in the loop.

```js
let fs = 44100
let freq = 440  // A4
let delay = Math.round(fs / freq)

// Excite with noise burst
let data = new Float64Array(fs)  // 1 second
for (let i = 0; i < delay; i++) data[i] = Math.random() * 2 - 1

// Feedback comb with one-pole damping in the loop
let combParams = { delay, gain: 0.996, type: 'feedback' }
let lpParams = { fc: 4000, fs }

comb(data, combParams)
onePole(data, lpParams)
```

`delay` sets the pitch (fs/freq samples). `gain` close to 1 = long sustain, lower = shorter. The one-pole filter simulates string damping (high frequencies decay faster). Lower `fc` = duller, nylon-like. Higher `fc` = brighter, steel-like.

### Envelope following

Track the amplitude contour of a signal for modulation, ducking, or dynamics.

```js
let data = new Float64Array(buffer)

envelope(data, { attack: 0.005, release: 0.05, fs: 44100 })
// data now contains the envelope (always positive)
```

Attack 1-10 ms for fast transient tracking (drums, percussive). Attack 10-50 ms for smoother tracking (vocals, pads). Release 30-100 ms for musical response. The envelope output can modulate any parameter: filter cutoff, gain, panning.

---

## Speech processing

### Pre-emphasis before analysis

Boost high frequencies before spectral analysis to compensate for the natural -6 dB/octave roll-off of speech. Standard preprocessing for LPC, MFCC, and formant estimation.

```js
let data = new Float64Array(speechFrame)

emphasis(data, { alpha: 0.97 })
```

`alpha=0.97` is the universal standard (6 dB boost per octave above ~700 Hz at 16 kHz sample rate). After analysis, undo with `deemphasis` at the same alpha.

### LPC analysis

Linear Predictive Coding: model the vocal tract as an all-pole filter. Compute autocorrelation, then solve with Levinson-Durbin.

```js
// Windowed speech frame (20-30ms, pre-emphasized)
let frame = new Float64Array(640)  // 40ms at 16kHz

// Autocorrelation
let order = 12  // 12-16 poles for narrowband speech
let R = new Float64Array(order + 1)
for (let k = 0; k <= order; k++) {
  for (let i = 0; i < frame.length - k; i++) {
    R[k] += frame[i] * frame[i + k]
  }
}

let { a, error, k: reflectionCoefs } = levinson(R, order)
// a = LPC coefficients (prediction filter)
// error = prediction residual power (excitation energy)
// k = reflection coefficients (for lattice structures, stability check)
```

Order 10-12 for 8 kHz narrowband, 16-20 for 16 kHz wideband. Each pole pair models one formant. Reflection coefficients `k` are bounded [-1, 1] when the filter is stable.

### Echo cancellation sketch

Cancel acoustic echo using NLMS adaptive filter. The reference signal (far-end) is filtered to match the echo path, then subtracted.

```js
let farEnd = new Float64Array(buffer)    // signal from remote speaker
let microphone = new Float64Array(buffer) // mic picks up echo + near-end

let params = {
  order: 512,  // echo tail length in samples (~12ms at 44.1kHz)
  mu: 0.5,     // step size (0.1-1.0, higher = faster convergence, less stable)
}

// NLMS subtracts the estimated echo from the microphone signal
let echoEstimate = nlms(farEnd, microphone, params)
// params.error contains the cleaned signal (microphone minus echo)
let cleaned = params.error
```

Filter order must cover the echo path length (room reflections). 256-2048 taps depending on room size. `mu=0.5` is a good starting point. Lower for stability in changing environments, higher for faster tracking. For production use, add double-talk detection and comfort noise.

---

## Communications

### Pulse shaping

Shape transmitted pulses to limit bandwidth without intersymbol interference (ISI).

**Raised cosine** (transmit filter):

```js
let h = raisedCosine(101, 0.35, 8)
// 101 taps, beta=0.35 roll-off, 8 samples/symbol
```

**Root raised cosine** (matched pair: TX and RX each apply sqrt):

```js
let htx = raisedCosine(101, 0.35, 8, { root: true })
let hrx = raisedCosine(101, 0.35, 8, { root: true })
// htx convolved with hrx = raised cosine (zero ISI)
```

`beta` controls bandwidth/ISI tradeoff: 0 = minimum bandwidth (sinc, long ringing), 0.35 = standard (good tradeoff), 1.0 = widest bandwidth (shortest impulse). `sps` (samples per symbol) is set by your system: 4-8 for most digital modulations.

### Matched filtering

Detect a known waveform in noise with maximum SNR. The matched filter is the time-reversed, conjugated template.

```js
// Known pulse/preamble shape
let template = new Float64Array([0, 0.3, 0.7, 1, 0.7, 0.3, 0])

let h = matchedFilter(template)

// Apply to received signal
let received = new Float64Array(buffer)
let corr = convolution(received, h)
// Peak in corr indicates where the template occurs
```

Output is the normalized cross-correlation. Peak value approaches 1.0 for a perfect match. Use a threshold (e.g., 0.7) to detect presence.

---

## Biomedical

### ECG filtering

Clean electrocardiogram signals: remove baseline wander (low-frequency drift), powerline interference, and high-frequency noise.

```js
let fs = 500  // typical ECG sample rate

// Bandpass 0.5-40 Hz (diagnostic bandwidth, AHA recommendation)
let hp = butterworth(2, 0.5, fs, 'highpass')  // remove baseline wander
let lp = butterworth(4, 40, fs, 'lowpass')    // remove EMG/noise

let data = new Float64Array(ecgBuffer)
filter(data, { coefs: hp })
filter(data, { coefs: lp })

// Notch at 50 Hz (Europe) to remove powerline
let notch50 = biquad.notch(50, 35, fs)
filter(data, { coefs: notch50 })
```

For offline analysis where waveform shape matters (QRS morphology), use `filtfilt` instead of `filter` to eliminate phase distortion:

```js
filtfilt(data, { coefs: hp })
filtfilt(data, { coefs: lp })
```

Butterworth is preferred for ECG because its flat passband does not distort the signal. Bessel is even better if preserving the exact QRS shape is critical (lowest overshoot).

### EEG band extraction

Extract standard EEG frequency bands for brain-computer interfaces, sleep staging, or neurofeedback.

```js
let fs = 256  // typical EEG sample rate

// Standard EEG bands (all bandpass)
let delta = butterworth(4, [0.5, 4], fs, 'bandpass')    // deep sleep
let theta = butterworth(4, [4, 8], fs, 'bandpass')      // drowsiness, meditation
let alpha = butterworth(4, [8, 13], fs, 'bandpass')     // relaxed, eyes closed
let beta  = butterworth(4, [13, 30], fs, 'bandpass')    // active thinking
let gamma = butterworth(4, [30, 100], fs, 'bandpass')   // cognitive processing

let data = new Float64Array(eegBuffer)

// Extract each band (copy first — filter is in-place)
let alphaSignal = Float64Array.from(data)
filter(alphaSignal, { coefs: alpha })

// Band power (useful metric)
let power = 0
for (let i = 0; i < alphaSignal.length; i++) power += alphaSignal[i] ** 2
power /= alphaSignal.length
```

Order 4 is standard for EEG. Higher orders risk ringing on transients. For real-time BCI, use `filter` (causal). For offline analysis, use `filtfilt` for zero-phase.

---

## Measurement

### A-weighted SPL

Measure sound pressure level with A-weighting, the standard perceptual loudness curve for environmental noise assessment (IEC 61672).

```js
let fs = 48000
let sos = aWeighting(fs)

let data = Float64Array.from(buffer)
filter(data, { coefs: sos })

// RMS → dB SPL (assuming calibrated microphone)
let sum = 0
for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
let rms = Math.sqrt(sum / data.length)
let dBA = 20 * Math.log10(rms / 20e-6)  // ref: 20 µPa
```

A-weighting attenuates low frequencies heavily (matches hearing at moderate levels). Use C-weighting (`cWeighting`) for peak measurement or when measuring low-frequency content.

### 1/3-octave analysis

Divide the spectrum into 1/3-octave bands for spectral analysis, room acoustics, or noise assessment (IEC 61260).

```js
let fs = 44100
let bands = octaveBank(3, fs)  // 1/3-octave
// bands = [{ fc: 31.5, coefs: {...} }, { fc: 40, coefs: {...} }, ...]

let data = new Float64Array(buffer)
let spectrum = bands.map(band => {
  let bandData = Float64Array.from(data)
  filter(bandData, { coefs: band.coefs })

  let power = 0
  for (let i = 0; i < bandData.length; i++) power += bandData[i] ** 2
  return { fc: band.fc, dB: 10 * Math.log10(power / bandData.length) }
})
```

First argument: 1 = full octave (10 bands), 3 = 1/3-octave (30 bands), 6 = 1/6-octave. Frequency range defaults to 31.25-16000 Hz; override with `{ fmin, fmax }`.

### THD measurement concept

Total Harmonic Distortion: measure how much harmonic content a system adds to a pure sine wave.

```js
let fs = 48000
let f0 = 1000  // test tone frequency

// Capture system output (driven by 1 kHz sine)
let data = new Float64Array(outputBuffer)

// Remove DC
dcBlocker(data, { R: 0.999 })

// Measure fundamental power
let fundBP = biquad.bandpass(f0, 20, fs)
let fundamental = Float64Array.from(data)
filter(fundamental, { coefs: fundBP })
let pFund = rms(fundamental) ** 2

// Measure each harmonic
let pHarm = 0
for (let h = 2; h <= 5; h++) {
  let hBP = biquad.bandpass(f0 * h, 20, fs)
  let harm = Float64Array.from(data)
  filter(harm, { coefs: hBP })
  pHarm += rms(harm) ** 2
}

let thd = Math.sqrt(pHarm / pFund) * 100  // percent

function rms(arr) {
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i]
  return Math.sqrt(s / arr.length)
}
```

Use a high Q (20+) for the bandpass filters to isolate each harmonic precisely. Measure 5-10 harmonics for a complete picture. THD < 0.1% is typical for good audio equipment; THD < 0.01% for high-end.
