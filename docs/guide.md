# Guide

Learn digital filters, pick the right one, apply it. One document, three parts.

All code examples assume:

```js
import {
  biquad, filter, freqz, mag2db, filtfilt,
  butterworth, chebyshev, chebyshev2, elliptic, bessel, legendre,
  linkwitzRiley, crossover,
  graphicEq, parametricEq,
  kWeighting, aWeighting, riaa,
  svf, moogLadder, diodeLadder, korg35, formant,
  allpass, comb, onePole, envelope, dcBlocker,
  emphasis, deemphasis, levinson,
  nlms, lms, rls,
  firwin, firwin2, firls, remez, kaiserord, hilbert, minimumPhase,
  raisedCosine, matchedFilter, convolution,
  decimate, interpolate, oversample, noiseShaping,
  octaveBank, gammatone, savitzkyGolay, median,
  oneEuro, dynamicSmoothing, isStable, groupDelay
} from 'digital-filter'
```

---

# Part 1: Understanding Filters

## What is a filter?

A filter takes samples in and produces samples out. The simplest useful filter — averaging the last 3 samples:

```js
output[i] = (input[i] + input[i-1] + input[i-2]) / 3
```

This smooths the signal: fast changes get reduced, slow trends survive. That is a **lowpass filter** — it passes low frequencies and reduces high ones.

Every filter has a dual nature: it does something in *time* (averaging, delaying, accumulating) that corresponds to something in *frequency* (passing, cutting, boosting).

## Frequency domain

Sound is a mix of frequencies. A lowpass filter at 1000 Hz:
- Below 1000 Hz — passes through unchanged
- Above 1000 Hz — attenuated
- The boundary — gradual transition

The **magnitude response** plots "how much of each frequency gets through" (dB) vs frequency (Hz). This is the single most important visualization for any filter.

### dB scale

Decibels are a logarithmic scale for ratios. Conversion: `dB = 20 * log10(ratio)`.

| dB | Ratio | Meaning |
|---|---|---|
| 0 dB | 1.0 | Unchanged |
| -3 dB | 0.71 | Half power (the standard "cutoff" point) |
| -6 dB | 0.50 | Half amplitude |
| -20 dB | 0.10 | 10% amplitude |
| -40 dB | 0.01 | 1% amplitude |
| -60 dB | 0.001 | Effectively silent |
| +6 dB | 2.0 | Double amplitude |
| +20 dB | 10.0 | 10x amplitude |

### Passband, stopband, transition band

```
     0 dB ─────────┐
                   │ ← transition band
   -40 dB          └──────────────
     passband          stopband
```

- **Passband**: frequencies that pass through (near 0 dB)
- **Stopband**: frequencies that are rejected (far below 0 dB)
- **Transition band**: the slope between them (narrower = sharper cutoff)

The **-3 dB point** (half power) is the conventional cutoff frequency (fc).

## Phase

Magnitude tells you *how much* of each frequency passes. Phase tells you *when* it arrives.

A filter delays different frequencies by different amounts. If all frequencies are delayed equally, the waveform shape is preserved — **linear phase**. If not, the waveform gets distorted — **nonlinear phase**.

**Group delay** measures how many samples each frequency is delayed. Constant group delay = linear phase.

When it matters:
- **Audio crossovers**: nonlinear phase makes drivers sum incorrectly
- **Biomedical**: phase distortion changes measured waveform shapes (ECG, EEG)
- **Communications**: phase distortion causes intersymbol interference
- **EQ**: usually inaudible — nonlinear phase is fine

FIR filters can have perfect linear phase (symmetric coefficients). IIR filters cannot.

## IIR vs FIR

### IIR (Infinite Impulse Response)

Uses feedback — output depends on previous *outputs* as well as inputs.

```
y[n] = b0·x[n] + b1·x[n-1] + b2·x[n-2] - a1·y[n-1] - a2·y[n-2]
```

Efficient (5-20 multiplies for a sharp lowpass), low latency, matches analog filter behavior. Cannot achieve linear phase. Can be unstable if coefficients are wrong.

**Use when**: real-time audio, control systems, any application where latency matters.

### FIR (Finite Impulse Response)

No feedback — output depends only on current and past *inputs*.

```
y[n] = h[0]·x[n] + h[1]·x[n-1] + ... + h[N-1]·x[n-N+1]
```

Always stable, can have perfect linear phase. Needs many taps for sharp cutoff (100-1000+), higher latency (delay = N/2 samples for linear phase).

**Use when**: offline processing, linear phase required, adaptive filtering, pulse shaping.

| Property | IIR | FIR |
|---|---|---|
| Efficiency | 5-20 multiplies for sharp LP | 100-1000+ multiplies |
| Phase | Nonlinear (always) | Linear (with symmetric coefficients) |
| Stability | Can be unstable | Always stable |
| Latency | Low (few samples) | High (N/2 samples) |
| Adaptive | Hard to adapt | Easy (LMS, NLMS) |

## Biquads and SOS

The **second-order section (SOS)** or **biquad** is a filter with 5 coefficients:

```
H(z) = (b0 + b1·z⁻¹ + b2·z⁻²) / (1 + a1·z⁻¹ + a2·z⁻²)
```

Every IIR filter is built from cascaded biquads. A 4th-order Butterworth is two biquads in series. An 8th-order elliptic is four biquads.

Why not higher-order direct form? A 10th-order filter implemented directly requires ~15 digits of coefficient precision — impossible with float64. The same filter as 5 cascaded biquads works perfectly. This library returns SOS arrays by default. See [reference](reference.md) for details.

## Bilinear transform

Classic filter families (Butterworth, Chebyshev, Bessel, Elliptic) were designed for analog circuits. The **bilinear transform** maps them to digital:

```
s = (2/T) · (z-1)/(z+1)
```

It maps the entire analog frequency axis to [0, Nyquist], with frequency warping corrected at the cutoff by prewarping. All IIR design functions in this library prewarp automatically — the cutoff you specify is the cutoff you get.

## Stability

An IIR filter is stable if all **poles** are inside the unit circle in the z-plane. The `isStable(sos)` function checks this.

Instability happens when:
- Coefficient quantization pushes a pole outside the unit circle (more common with direct form — another reason to use SOS)
- Filter parameters are changed carelessly (e.g., Q approaching 0)
- Feedback gain exceeds the stability limit

FIR filters are always stable — they have no feedback.

## Sampling theorem

A digital system at sample rate `fs` can represent frequencies up to `fs/2` (the **Nyquist frequency**). Frequencies above Nyquist fold back ("alias") into the representable range, creating false signals.

This is why anti-aliasing filters are applied before downsampling, and anti-imaging filters after upsampling. The `decimate`, `interpolate`, and `oversample` modules handle this automatically.

---

# Part 2: Choosing the Right Filter

## "I want to..." lookup

| I want to... | Use | Notes |
|---|---|---|
| **Frequency selection** | | |
| Remove frequencies above a cutoff | `butterworth(N, fc, fs)` | Default choice, flat passband |
| Remove frequencies below a cutoff | `butterworth(N, fc, fs, 'highpass')` | |
| Keep only a frequency range | `butterworth(N, [lo, hi], fs, 'bandpass')` | |
| Remove a frequency range | `butterworth(N, [lo, hi], fs, 'bandstop')` | |
| Remove one exact frequency | `biquad.notch(fc, Q, fs)` | Q=30 for narrow null |
| Boost/cut a frequency band | `biquad.peaking(fc, Q, fs, dB)` | Parametric EQ bell |
| Boost/cut below a frequency | `biquad.lowshelf(fc, Q, fs, dB)` | Shelf EQ |
| Boost/cut above a frequency | `biquad.highshelf(fc, Q, fs, dB)` | Shelf EQ |
| Split signal into 2 bands | `linkwitzRiley(4, fc, fs)` | LP+HP sum to flat |
| Split signal into N bands | `crossover([f1, f2, ...], 4, fs)` | N-way Linkwitz-Riley |
| **Sharp cutoff** | | |
| Sharpest possible, ripple OK both bands | `elliptic(N, fc, fs, rp, rs)` | Minimum order for specs |
| Sharp cutoff, passband ripple OK | `chebyshev(N, fc, fs, ripple)` | Steeper than Butterworth |
| Sharp cutoff, passband must be flat | `chebyshev2(N, fc, fs, attenuation)` | Equiripple stopband |
| Sharp cutoff, no ripple anywhere | `legendre(N, fc, fs)` | Between Butter & Cheby |
| Auto-select best family + order | `iirdesign(fpass, fstop, rp, rs, fs)` | |
| **Waveform preservation** | | |
| Filter without ringing/overshoot | `bessel(N, fc, fs)` | Maximally flat group delay |
| Filter without any phase distortion | `filtfilt(data, {coefs})` | Zero-phase, offline only |
| **Audio** | | |
| Multi-band parametric EQ | `parametricEq(data, {bands, fs})` | N bands with shelf options |
| 10-band graphic EQ | `graphicEq(data, {gains, fs})` | ISO octave centers |
| Measure loudness (LUFS) | `kWeighting(fs)` + `filter` + RMS | ITU-R BS.1770 |
| Measure sound level (dBA) | `aWeighting(fs)` + `filter` + RMS | IEC 61672 |
| Vinyl playback | `riaa(fs)` + `filter` | RIAA de-emphasis |
| **Synthesis** | | |
| Classic analog synth lowpass | `moogLadder(data, {fc, resonance, fs})` | -24 dB/oct, saturating |
| Versatile synth filter | `svf(data, {type, fc, Q, fs})` | 6 outputs, stable |
| Diode ladder (303-style) | `diodeLadder(data, {fc, resonance, fs})` | Gritty character |
| Korg MS-20 filter | `korg35(data, {fc, resonance, fs})` | Nonlinear 2-pole |
| Vowel/formant synthesis | `formant(data, {formants, fs})` | Parallel resonators |
| **Smoothing** | | |
| Smooth a control signal | `onePole(data, {fc, fs})` | Simplest, no overshoot |
| Smooth preserving edges | `savitzkyGolay(data, {window, order})` | Polynomial fit |
| Adaptive smooth (low jitter + latency) | `oneEuro(data, params)` | |
| Self-adjusting cutoff | `dynamicSmoothing(data, params)` | Cutoff follows signal |
| Remove impulse noise (clicks) | `median(data, {size})` | Nonlinear |
| Remove DC offset | `dcBlocker(data, {R})` | R=0.995 default |
| **Adaptive** | | |
| Cancel echo / noise | `nlms(input, desired, params)` | Normalized LMS |
| System identification | `lms(input, desired, params)` | Simpler, cheaper |
| Fastest convergence | `rls(input, desired, params)` | O(N^2) but fast |
| LPC / Toeplitz solver | `levinson(R, order)` | From autocorrelation |
| **FIR design** | | |
| Quick FIR filter | `firwin(N, fc, fs, {type})` | Window method |
| FIR with arbitrary shape | `firwin2(N, freqs, gains)` | Frequency sampling |
| Optimal smooth FIR | `firls(N, bands, desired)` | Least-squares |
| Optimal sharp FIR | `remez(N, bands, desired)` | Parks-McClellan |
| Estimate FIR order needed | `kaiserord(deltaF, attenuation)` | Returns numtaps + beta |
| 90-degree phase shift | `hilbert(N)` | FIR Hilbert transformer |
| Convert to minimum phase | `minimumPhase(h)` | Cepstral method |
| **Communications** | | |
| Pulse shaping (TX) | `raisedCosine(N, beta, sps)` | ISI-free at symbol centers |
| Root raised cosine (TX+RX pair) | `raisedCosine(N, beta, sps, {root:true})` | Matched pair |
| Detect known waveform | `matchedFilter(template)` | Maximum SNR |
| **Multirate** | | |
| Downsample | `decimate(data, factor)` | Anti-alias included |
| Upsample | `interpolate(data, factor)` | Anti-image included |
| Oversample for nonlinear processing | `oversample(data, params)` | Multi-stage |
| **Analysis** | | |
| Frequency response plot data | `freqz(sos, N, fs)` | Magnitude + phase |
| Group delay | `groupDelay(sos, N, fs)` | Samples per frequency |
| Stability check | `isStable(sos)` | Poles inside unit circle? |
| 1/3-octave spectrum | `octaveBank(3, fs)` | IEC 61260 bands |

For detailed parameters and behavior, see the [reference](reference.md).

## IIR family decision tree

```
Need linear phase?
├─ Yes → Use FIR (below) or filtfilt for offline zero-phase
└─ No
   │
   Must waveform shape be preserved (no ringing)?
   ├─ Yes → bessel
   └─ No
      │
      Passband ripple acceptable?
      ├─ Yes
      │  ├─ Stopband ripple also OK? → elliptic (sharpest, minimum order)
      │  └─ Stopband must be monotonic → chebyshev
      └─ No (passband must be flat)
         ├─ Stopband ripple OK? → chebyshev2
         └─ No ripple anywhere?
            ├─ Need steepest monotonic? → legendre
            └─ Safe default → butterworth
```

**Order selection**: Start with 4. Not steep enough — try 6 or 8. Latency/ringing problems — go lower. For specific attenuation specs, use `iirdesign` to compute minimum order automatically. Bandpass/bandstop doubles the effective order.

## FIR method selector

```
"Just need a decent lowpass/highpass/bandpass"
→ firwin (window method). Fast, reliable, good for most tasks.

"Exact passband/stopband specs, minimum taps"
→ remez (Parks-McClellan). Optimal for sharp transitions, equiripple error.

"Smooth approximation with minimal ringing"
→ firls (least-squares). Smoother than remez, better for audio.

"Arbitrary magnitude shape"
→ firwin2 (frequency sampling). Specify gain at arbitrary frequency points.

"Don't know how many taps I need"
→ kaiserord first → then firwin with the result.
```

| Method | Optimality | Best for | Weakness |
|---|---|---|---|
| `firwin` | Good enough | Quick prototyping, general use | Not optimal for tight specs |
| `firls` | Least-squares | Smooth specs, audio, interpolation | Wider transition than remez |
| `remez` | Minimax | Sharp transitions, tight specs | Convergence issues at high order |
| `firwin2` | Frequency sampling | Arbitrary shapes, EQ curves | Not optimal in any formal sense |

## Common mistakes

**Using FIR when IIR is fine.** A 4th-order Butterworth lowpass: 10 multiplies/sample. Equivalent FIR: 100+. If you do not need linear phase, use IIR.

**Butterworth order 20 when elliptic order 4 suffices.** Elliptic order 4 can match Butterworth order 12 in transition width. Use `iirdesign` to find minimum order.

**Forgetting SOS cascade.** Never implement a high-order IIR as one big polynomial. Coefficients lose precision above order ~6. This library returns SOS by default — do not convert to `tf` form.

**Using filtfilt in real-time.** `filtfilt` needs the entire signal upfront (backward pass). For real-time: accept IIR phase distortion or add FIR latency.

**Ignoring group delay in crossovers.** Independent Butterworth LP+HP do not sum flat. Use `linkwitzRiley` / `crossover` — designed so LP+HP sum to allpass.

**Q too high on a biquad.** Q=0.707 is Butterworth (default). Q > 10 creates a tall resonance peak that clips. For EQ: Q=0.5-8. Higher only for notch filters.

**Filtering same data twice.** `filter()` modifies data in-place. For multiple filters on the same input, copy first:

```js
let low = Float64Array.from(data)
let high = Float64Array.from(data)
filter(low, { coefs: lowCoefs })
filter(high, { coefs: highCoefs })
```

**Not resetting state between unrelated signals.** Filter state persists in the params object. For a new signal, create a new params object or `delete params.state`.

---

# Part 3: Recipes by Domain

## Audio

### Parametric EQ

```js
let data = new Float64Array(buffer), fs = 44100

parametricEq(data, {
  fs,
  bands: [
    { fc: 200,   Q: 0.8, gain: 3 },                          // +3 dB warmth
    { fc: 3000,  Q: 2,   gain: -4 },                         // -4 dB de-harsh
    { fc: 12000, Q: 0.7, gain: 2, type: 'highshelf' }        // +2 dB air
  ]
})
```

Q=0.5-1 for broad shaping, Q=2-8 for surgical cuts. Keep boosts under +6 dB. See [reference](reference.md) for biquad types.

### Graphic EQ

```js
graphicEq(data, {
  fs: 44100,
  gains: { 62.5: -2, 250: 3, 1000: 0, 4000: 2, 8000: -1 }
})
```

Bands at 0 dB are skipped (no processing cost). Internal Q is 1.4 (standard octave bandwidth).

### Crossover (2-way and 3-way)

```js
// 2-way at 2 kHz
let lr = linkwitzRiley(4, 2000, 44100)
let low = Float64Array.from(data), high = Float64Array.from(data)
filter(low, { coefs: lr.low })
filter(high, { coefs: lr.high })
// low + high sums to flat (allpass)

// 3-way
let bands = crossover([500, 4000], 4, 44100)
let woofer = Float64Array.from(data)
let mid    = Float64Array.from(data)
let tweeter = Float64Array.from(data)
filter(woofer,  { coefs: bands[0] })
filter(mid,     { coefs: bands[1] })
filter(tweeter, { coefs: bands[2] })
```

LR-4 is the standard for active crossovers. LR-2 for gentle slopes, LR-8 for very steep digital crossovers.

### Loudness metering (LUFS)

```js
let fs = 48000
let sos = kWeighting(fs)
let data = Float64Array.from(buffer)
filter(data, { coefs: sos })

// RMS over 400ms blocks (momentary loudness)
let blockSize = Math.round(0.4 * fs)
for (let i = 0; i + blockSize <= data.length; i += blockSize) {
  let block = data.subarray(i, i + blockSize)
  let sum = 0
  for (let j = 0; j < block.length; j++) sum += block[j] * block[j]
  let lufs = -0.691 + 10 * Math.log10(sum / block.length)
}
```

For stereo: sum mean-square of both K-weighted channels. See [reference](reference.md).

### Hum removal

```js
// 60 Hz hum + harmonics
let notches = [60, 120, 180, 240].map(f => biquad.notch(f, 30, 44100))
for (let n of notches) filter(data, { coefs: n })
```

Q=30 gives a ~2 Hz wide null — removes hum without affecting music. For 50 Hz regions: `[50, 100, 150, 200]`.

### Rumble removal

```js
// Order 2: gentle, preserves bass feel
filter(data, { coefs: butterworth(2, 30, 44100, 'highpass') })
```

20-30 Hz for gentle cleanup. 40 Hz for aggressive rumble removal. Order 2 is usually enough; order 4 for severe cases.

### Sample rate conversion

```js
let data48k = decimate(data96k, 2, { fs: 96000 })    // 96k → 48k
let data88k = interpolate(data44k, 2, { fs: 44100 })  // 44.1k → 88.2k
```

Anti-aliasing (decimate) and anti-imaging (interpolate) filters are applied automatically.

## Synthesis

### Subtractive synth

```js
let fs = 44100
let data = new Float64Array(1024)  // sawtooth oscillator output

let params = { fc: 800, resonance: 0.6, fs }
moogLadder(data, params)

// Animate cutoff with envelope:
params.fc = 200 + 3000 * envelopeValue  // sweep 200-3200 Hz
moogLadder(nextBlock, params)
```

Resonance: 0 = none, 0.5 = pronounced, 1.0 = self-oscillation. Moog is -24 dB/oct. For -12 dB/oct use `svf`, for nonlinear -12 dB/oct use `korg35`. See [reference](reference.md).

### Resonant sweep

```js
let params = { type: 'lowpass', Q: 5, fs: 44100 }

for (let block = 0; block < numBlocks; block++) {
  let t = block / numBlocks
  params.fc = 200 * Math.pow(40, t)  // exponential 200→8000 Hz
  svf(audioBlock, params)
}
```

SVF recalculates coefficients when fc/Q changes. Exponential sweep matches pitch perception. Q=1-3 for gentle resonance, Q=5-20 for acid-style.

### Formant synthesis

```js
let vowelA = [
  { fc: 730,  bw: 90,  gain: 1 },
  { fc: 1090, bw: 110, gain: 0.5 },
  { fc: 2440, bw: 170, gain: 0.3 }
]

let data = new Float64Array(1024)  // impulse train or noise
formant(data, { formants: vowelA, fs: 44100 })
```

Average male formant values. For female voices, shift frequencies up ~20%.

### Karplus-Strong string

```js
let fs = 44100, freq = 440
let delay = Math.round(fs / freq)

let data = new Float64Array(fs)
for (let i = 0; i < delay; i++) data[i] = Math.random() * 2 - 1

comb(data, { delay, gain: 0.996, type: 'feedback' })
onePole(data, { fc: 4000, fs })
```

Delay sets pitch. Gain near 1 = long sustain. Lower `fc` = duller (nylon), higher = brighter (steel).

### Envelope following

```js
envelope(data, { attack: 0.005, release: 0.05, fs: 44100 })
// data now contains the amplitude envelope (always positive)
```

Attack 1-10 ms for transients (drums). Attack 10-50 ms for smooth tracking (vocals). Output can modulate filter cutoff, gain, panning.

## Speech

### Pre-emphasis

```js
emphasis(data, { alpha: 0.97 })
```

Standard preprocessing for LPC, MFCC, formant estimation. Compensates -6 dB/oct roll-off of speech. Undo with `deemphasis(data, { alpha: 0.97 })`.

### LPC analysis

```js
let frame = new Float64Array(640)  // 40ms at 16kHz, pre-emphasized
let order = 12  // 12-16 poles for narrowband speech

// Autocorrelation
let R = new Float64Array(order + 1)
for (let k = 0; k <= order; k++)
  for (let i = 0; i < frame.length - k; i++)
    R[k] += frame[i] * frame[i + k]

let { a, error, k: reflectionCoefs } = levinson(R, order)
```

Order 10-12 for 8 kHz narrowband, 16-20 for 16 kHz wideband. Each pole pair models one formant. See [reference](reference.md).

### Echo cancellation

```js
let echoEstimate = nlms(farEnd, microphone, {
  order: 512,  // echo tail length (~12ms at 44.1kHz)
  mu: 0.5      // step size (0.1-1.0)
})
let cleaned = params.error
```

Order must cover the echo path (room reflections): 256-2048 taps. Lower `mu` for stability, higher for faster tracking.

## Communications

### Pulse shaping

```js
// Raised cosine (transmit)
let h = raisedCosine(101, 0.35, 8)  // 101 taps, beta=0.35, 8 samples/symbol

// Root raised cosine (matched pair: TX + RX)
let htx = raisedCosine(101, 0.35, 8, { root: true })
let hrx = raisedCosine(101, 0.35, 8, { root: true })
// htx * hrx = raised cosine (zero ISI)
```

Beta: 0 = minimum bandwidth (long ringing), 0.35 = standard, 1.0 = widest (shortest impulse). See [reference](reference.md).

### Matched filtering

```js
let template = new Float64Array([0, 0.3, 0.7, 1, 0.7, 0.3, 0])
let h = matchedFilter(template)
let corr = convolution(received, h)
// Peak in corr indicates where template occurs
```

Peak approaches 1.0 for perfect match. Use threshold (e.g., 0.7) to detect presence.

## Biomedical

### ECG filtering

```js
let fs = 500  // typical ECG sample rate

let hp = butterworth(2, 0.5, fs, 'highpass')  // remove baseline wander
let lp = butterworth(4, 40, fs, 'lowpass')    // remove EMG/noise
let notch50 = biquad.notch(50, 35, fs)        // powerline (Europe)

let data = new Float64Array(ecgBuffer)
filter(data, { coefs: hp })
filter(data, { coefs: lp })
filter(data, { coefs: notch50 })
```

For offline analysis where waveform shape matters (QRS morphology), use `filtfilt` instead of `filter`. Butterworth is preferred for ECG — flat passband does not distort the signal. `bessel` is even better when preserving exact QRS shape.

### EEG band extraction

```js
let fs = 256

let delta = butterworth(4, [0.5, 4],   fs, 'bandpass')  // deep sleep
let theta = butterworth(4, [4, 8],     fs, 'bandpass')   // drowsiness
let alpha = butterworth(4, [8, 13],    fs, 'bandpass')   // relaxed, eyes closed
let beta  = butterworth(4, [13, 30],   fs, 'bandpass')   // active thinking
let gamma = butterworth(4, [30, 100],  fs, 'bandpass')   // cognitive processing

let alphaSignal = Float64Array.from(data)
filter(alphaSignal, { coefs: alpha })

// Band power
let power = 0
for (let i = 0; i < alphaSignal.length; i++) power += alphaSignal[i] ** 2
power /= alphaSignal.length
```

Order 4 is standard. Higher risks ringing on transients. For real-time BCI use `filter`, for offline use `filtfilt`.

## Measurement

### A-weighted SPL

```js
let fs = 48000
let sos = aWeighting(fs)
let data = Float64Array.from(buffer)
filter(data, { coefs: sos })

let sum = 0
for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
let rms = Math.sqrt(sum / data.length)
let dBA = 20 * Math.log10(rms / 20e-6)  // ref: 20 uPa
```

A-weighting attenuates low frequencies (matches hearing at moderate levels). Use C-weighting for peak measurement. See [reference](reference.md).

### 1/3-octave analysis

```js
let bands = octaveBank(3, 44100)  // 1/3-octave, IEC 61260

let spectrum = bands.map(band => {
  let bandData = Float64Array.from(data)
  filter(bandData, { coefs: band.coefs })
  let power = 0
  for (let i = 0; i < bandData.length; i++) power += bandData[i] ** 2
  return { fc: band.fc, dB: 10 * Math.log10(power / bandData.length) }
})
```

First argument: 1 = full octave, 3 = 1/3-octave (30 bands), 6 = 1/6-octave.

### THD measurement

```js
let fs = 48000, f0 = 1000
let data = new Float64Array(outputBuffer)
dcBlocker(data, { R: 0.999 })

// Fundamental power
let fund = Float64Array.from(data)
filter(fund, { coefs: biquad.bandpass(f0, 20, fs) })
let pFund = rms(fund) ** 2

// Harmonic power
let pHarm = 0
for (let h = 2; h <= 5; h++) {
  let harm = Float64Array.from(data)
  filter(harm, { coefs: biquad.bandpass(f0 * h, 20, fs) })
  pHarm += rms(harm) ** 2
}

let thd = Math.sqrt(pHarm / pFund) * 100  // percent

function rms(arr) {
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i]
  return Math.sqrt(s / arr.length)
}
```

High Q (20+) isolates each harmonic precisely. THD < 0.1% is good audio equipment; < 0.01% is high-end.

### Real-time block processing

All stateful filters maintain state between calls. Process consecutive blocks by reusing the same params object:

```js
let params = { coefs: butterworth(4, 1000, 44100) }

filter(block1, params)  // state persists
filter(block2, params)  // seamless continuation
filter(block3, params)
```

Same pattern works for `svf`, `moogLadder`, `onePole`, `envelope`, and all other stateful filters.
