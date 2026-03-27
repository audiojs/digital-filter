# digital-filter [![npm](https://img.shields.io/npm/v/digital-filter.svg)](https://npmjs.org/package/digital-filter) [![test](https://github.com/scijs/digital-filter/actions/workflows/test.yml/badge.svg)](https://github.com/scijs/digital-filter/actions/workflows/test.yml) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Digital filter design and processing.
From biquad to Butterworth to adaptive, with the depth of scipy.signal and the simplicity of a single import.

> 82 modules · 164 tests · 1 dependency ([window-function](https://github.com/scijs/window-function)) · pure ESM · **[API Reference](reference.md)**

```js
import { butterworth, filter, freqz, mag2db } from 'digital-filter'

let sos = butterworth(4, 1000, 44100)       // design
filter(data, { coefs: sos })                 // apply
let dB = mag2db(freqz(sos, 512, 44100).magnitude)  // analyze
```

## Understanding filters

A filter takes samples in and produces samples out. The simplest useful filter — averaging the last 3 samples:

```js
output[i] = (input[i] + input[i-1] + input[i-2]) / 3
```

This smooths the signal: fast changes get reduced, slow trends survive. That is a **lowpass filter** — it passes low frequencies and reduces high ones.

Every filter has a dual nature: it does something in *time* (averaging, delaying, accumulating) that corresponds to something in *frequency* (passing, cutting, boosting).

**Magnitude response** plots "how much of each frequency gets through" (dB) vs frequency (Hz). This is the single most important visualization for any filter.

| dB | Ratio | Meaning |
|---|---|---|
| 0 dB | 1.0 | Unchanged |
| -3 dB | 0.71 | Half power (the standard "cutoff" point) |
| -6 dB | 0.50 | Half amplitude |
| -20 dB | 0.10 | 10% amplitude |
| -60 dB | 0.001 | Effectively silent |

**Phase** tells you *when* each frequency arrives. If all frequencies are delayed equally, the waveform shape is preserved — **linear phase**. If not, the waveform distorts. **Group delay** measures this: constant group delay = linear phase. FIR filters can have perfect linear phase. IIR cannot.

### IIR vs FIR

**IIR** (infinite impulse response) uses feedback — output depends on previous *outputs*. Efficient (5-20 multiplies for a sharp lowpass), low latency. Cannot achieve linear phase. Can be unstable.

**FIR** (finite impulse response) — no feedback. Always stable, can have perfect linear phase. Needs many taps for sharp cutoff (100-1000+), higher latency.

| | IIR | FIR |
|---|---|---|
| Efficiency | 5-20 multiplies | 100-1000+ |
| Phase | Nonlinear | Linear (symmetric) |
| Stability | Can be unstable | Always stable |
| Latency | Low | High (N/2 samples) |

**Use IIR** for real-time audio, control systems, anything latency-sensitive. **Use FIR** for offline processing, linear phase, adaptive filtering.

### Biquads and SOS

The **biquad** is a filter with 5 coefficients: `H(z) = (b0 + b1·z⁻¹ + b2·z⁻²) / (1 + a1·z⁻¹ + a2·z⁻²)`. Every IIR filter is built from cascaded biquads (**second-order sections**, SOS). A 4th-order Butterworth = two biquads in series. Why not higher-order direct form? A 10th-order filter needs ~15 digits of precision — impossible with float64. Cascaded biquads work perfectly.

## Which filter?

| I want to... | Use | Notes |
|---|---|---|
| **Frequency selection** | | |
| Remove frequencies above/below a cutoff | `butterworth(N, fc, fs)` | Default, flat passband |
| Sharpest possible, ripple OK both bands | `elliptic(N, fc, fs, rp, rs)` | Minimum order for specs |
| Sharp cutoff, passband ripple OK | `chebyshev(N, fc, fs, ripple)` | Steeper than Butterworth |
| Sharp cutoff, no ripple anywhere | `legendre(N, fc, fs)` | Between Butter & Cheby |
| Auto-select best family + order | `iirdesign(fpass, fstop, rp, rs, fs)` | |
| Remove one exact frequency (hum) | `biquad.notch(fc, Q, fs)` | Q=30 for narrow null |
| Boost/cut a frequency band | `biquad.peaking(fc, Q, fs, dB)` | Parametric EQ bell |
| Split signal into bands | `linkwitzRiley(4, fc, fs)` | LP+HP sum to flat |
| **Waveform preservation** | | |
| Filter without ringing/overshoot | `bessel(N, fc, fs)` | Maximally flat group delay |
| Filter without any phase distortion | `filtfilt(data, {coefs})` | Zero-phase, offline only |
| **Audio** | | |
| Multi-band parametric EQ | `parametricEq(data, {bands, fs})` | N bands with shelf options |
| Measure loudness (LUFS) | `kWeighting(fs)` + `filter` + RMS | ITU-R BS.1770 |
| Measure sound level (dBA) | `aWeighting(fs)` + `filter` + RMS | IEC 61672 |
| **Synthesis** | | |
| Classic analog synth lowpass | `moogLadder(data, {fc, resonance, fs})` | -24 dB/oct, saturating |
| Versatile synth filter | `svf(data, {type, fc, Q, fs})` | 6 outputs, stable modulation |
| Vowel/formant synthesis | `formant(data, {formants, fs})` | Parallel resonators |
| **Smoothing** | | |
| Smooth a control signal | `onePole(data, {fc, fs})` | Simplest, no overshoot |
| Smooth preserving edges | `savitzkyGolay(data, {window, degree})` | Polynomial fit |
| Adaptive smooth (low jitter + latency) | `oneEuro(data, params)` | Casiez 2012 |
| Remove impulse noise (clicks) | `median(data, {size})` | Nonlinear |
| Remove DC offset | `dcBlocker(data, {R})` | R=0.995 default |
| **Adaptive** | | |
| Cancel echo / noise | `nlms(input, desired, params)` | Normalized LMS |
| Fastest convergence | `rls(input, desired, params)` | O(N^2) but fast |
| LPC / Toeplitz solver | `levinson(R, order)` | From autocorrelation |
| **FIR design** | | |
| Quick FIR filter | `firwin(N, fc, fs, {type})` | Window method |
| Optimal sharp FIR | `remez(N, bands, desired)` | Parks-McClellan |
| Arbitrary shape FIR | `firwin2(N, freqs, gains)` | Frequency sampling |
| Estimate FIR order needed | `kaiserord(deltaF, attenuation)` | Returns numtaps + beta |
| **Multirate** | | |
| Downsample | `decimate(data, factor)` | Anti-alias included |
| Upsample | `interpolate(data, factor)` | Anti-image included |
| Oversample for nonlinear processing | `oversample(data, factor)` | Multi-stage |

### IIR family decision tree

```
Need linear phase?
├─ Yes → FIR or filtfilt (offline zero-phase)
└─ No
   Must waveform shape be preserved?
   ├─ Yes → bessel
   └─ No
      Passband ripple acceptable?
      ├─ Yes
      │  ├─ Stopband ripple also OK? → elliptic (sharpest)
      │  └─ Stopband must be monotonic → chebyshev
      └─ No (passband must be flat)
         ├─ Stopband ripple OK? → chebyshev2
         └─ No ripple anywhere?
            ├─ Steepest monotonic? → legendre
            └─ Safe default → butterworth
```

### Common mistakes

- **Using FIR when IIR is fine.** 4th-order Butterworth: 10 multiplies. Equivalent FIR: 100+. If you don't need linear phase, use IIR.
- **Butterworth order 20 when elliptic order 4 suffices.** Use `iirdesign` to find minimum order.
- **Using filtfilt in real-time.** It needs the entire signal (backward pass). For real-time: accept IIR phase or add FIR latency.
- **Ignoring group delay in crossovers.** Independent Butterworth LP+HP don't sum flat. Use `linkwitzRiley`.
- **Q too high on a biquad.** Q=0.707 is Butterworth (default). Q > 10 creates a tall resonance peak. For EQ: Q=0.5-8.
- **Filtering same data twice.** `filter()` modifies in-place. Copy first: `let copy = Float64Array.from(data)`.
- **Not resetting state.** Filter state persists in params. For a new signal, create new params or `delete params.state`.

## Recipes

### Parametric EQ

```js
parametricEq(data, { fs: 44100, bands: [
  { fc: 200, Q: 0.8, gain: 3 },               // +3 dB warmth
  { fc: 3000, Q: 2, gain: -4 },               // -4 dB de-harsh
  { fc: 12000, Q: 0.7, gain: 2, type: 'highshelf' }  // +2 dB air
]})
```

### Loudness metering (LUFS)

```js
let sos = kWeighting(48000)
filter(data, { coefs: sos })
let sum = 0
for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
let lufs = -0.691 + 10 * Math.log10(sum / data.length)
```

### Hum removal

```js
let notches = [60, 120, 180].map(f => biquad.notch(f, 30, 44100))
for (let n of notches) filter(data, { coefs: n })
```

### Subtractive synth

```js
let params = { fc: 800, resonance: 0.6, fs: 44100 }
moogLadder(sawtoothData, params)
params.fc = 200 + 3000 * envelopeValue  // animate cutoff
moogLadder(nextBlock, params)
```

### Echo cancellation

```js
let output = nlms(farEnd, microphone, { order: 512, mu: 0.5 })
let cleaned = params.error
```

### ECG filtering

```js
let fs = 500
filter(data, { coefs: butterworth(2, 0.5, fs, 'highpass') })  // baseline wander
filter(data, { coefs: butterworth(4, 40, fs) })                 // noise
filter(data, { coefs: biquad.notch(50, 35, fs) })               // powerline
```

### Karplus-Strong string

```js
let delay = Math.round(44100 / 440)
let data = new Float64Array(44100)
for (let i = 0; i < delay; i++) data[i] = Math.random() * 2 - 1
comb(data, { delay, gain: 0.996, type: 'feedback' })
onePole(data, { fc: 4000, fs: 44100 })
```

## Modules

### [`core/`](core/) — The engine

Process, analyze, and convert filters. Everything else builds on these.

- `filter` — SOS cascade processor (Direct Form II Transposed)
- `filtfilt` — Zero-phase forward-backward filtering
- `convolution` — Direct convolution with impulse response
- `freqz` / `mag2db` — Frequency response (magnitude + phase)
- `groupDelay` / `phaseDelay` — Delay analysis
- `impulseResponse` / `stepResponse` — Time-domain analysis
- `isStable` / `isMinPhase` / `isFir` / `isLinPhase` — Filter properties
- `sos2zpk` / `sos2tf` / `tf2zpk` / `zpk2sos` — Format conversion
- `transform` — Analog prototype → digital SOS (bilinear transform)
- `window` — 34 window functions (re-export from [window-function](https://github.com/scijs/window-function))

### [`iir/`](iir/) — IIR filter design

Infinite impulse response filters from analog prototypes. Return SOS coefficient arrays.

![IIR Comparison](plots/iir-comparison.svg)

- `biquad` — 9 second-order types: LP, HP, BP, notch, allpass, peaking, shelves (RBJ Cookbook)
- `svf` — Trapezoidal state variable filter — safe for real-time modulation (Simper 2011)
- `butterworth` — Maximally flat magnitude, no ripple (1930)
- `chebyshev` — Equiripple passband, steeper cutoff
- `chebyshev2` — Flat passband, equiripple stopband
- `elliptic` — Sharpest transition for given order — ripple in both bands (Cauer 1958)
- `bessel` — Maximally flat group delay — preserves waveform shape (Thomson 1949)
- `legendre` — Steepest monotonic (ripple-free) rolloff (Papoulis 1958)
- `iirdesign` — Auto-selects optimal family + order from specs
- `linkwitzRiley` — Crossover: LP+HP sum to unity (Linkwitz 1976)

### [`fir/`](fir/) — FIR filter design

Finite impulse response filters. Always stable, linear phase by default. Return Float64Array coefficients.

- `firwin` — LP/HP/BP/BS via windowed sinc
- `firwin2` — Arbitrary magnitude response (frequency sampling)
- `firls` — Minimize total squared error (least-squares)
- `remez` — Minimize peak error, equiripple (Parks-McClellan 1972)
- `kaiserord` — Estimate filter length from specs
- `hilbert` — 90-degree phase shift FIR (analytic signal)
- `minimumPhase` — Convert linear-phase to minimum-phase (cepstral)
- `differentiator` — FIR derivative (windowed)
- `integrator` — Newton-Cotes quadrature coefficients
- `raisedCosine` — Nyquist ISI-free pulse shaping
- `gaussianFir` — GMSK/Bluetooth pulse shaping
- `matchedFilter` — Maximum SNR detection (correlator)
- `yulewalk` — IIR from arbitrary magnitude (Yule-Walker)
- `lattice` — Lattice/ladder structure (reflection coefficients)
- `warpedFir` — Frequency-warped FIR (perceptual resolution)

### [`smooth/`](smooth/) — Smoothing and denoising

From simple averages to adaptive smoothers. Choose by noise model, latency, and edge preservation.

- `onePole` — One-pole lowpass (EMA), simplest IIR smoother
- `movingAverage` — Boxcar average of last N samples, linear phase
- `leakyIntegrator` — Exponential decay ($\lambda$-controlled)
- `median` — Nonlinear, removes impulses, preserves edges
- `savitzkyGolay` — Polynomial fit to sliding window, preserves peaks
- `gaussianIir` — Recursive Gaussian, O(1) regardless of sigma
- `oneEuro` — Adaptive cutoff: smooth at rest, fast when moving (Casiez 2012)
- `dynamicSmoothing` — Self-adjusting SVF cutoff

### [`adaptive/`](adaptive/) — Adaptive filters

Filters that learn from data. Weights adjust in real time to minimize error.

- `lms` — Least Mean Squares, O(N)/sample, simplest
- `nlms` — Normalized LMS, O(N)/sample, self-normalizing — the practical default
- `rls` — Recursive Least Squares, O(N^2)/sample, fastest convergence
- `levinson` — Levinson-Durbin recursion, O(N^2)/block, for LPC and speech coding

### [`multirate/`](multirate/) — Sample rate conversion

Change sample rates, fractional delays, efficient polyphase structures.

- `decimate` — Anti-alias + downsample by factor M
- `interpolate` — Upsample + anti-image by factor L
- `halfBand` — Half-band FIR for efficient 2x
- `cic` — Cascaded integrator-comb, multiplier-free
- `polyphase` — Decompose FIR into M polyphase components
- `farrow` — Lagrange fractional delay (variable per sample)
- `thiran` — Allpass fractional delay (maximally flat group delay)
- `oversample` — Multi-stage oversampling with anti-alias

### [`weighting/`](weighting/) — Acoustic measurement

Perceptual frequency weighting curves from international standards. Return SOS arrays.

- `aWeighting` — IEC 61672, human loudness perception at ~40 phon
- `cWeighting` — IEC 61672, nearly flat, peak SPL measurement
- `kWeighting` — ITU-R BS.1770, LUFS loudness metering (Spotify, YouTube, broadcast)
- `itu468` — ITU-R BS.468, broadcast equipment noise, peaked at 6.3 kHz
- `riaa` — IEC 98, vinyl playback equalization

### [`analog/`](analog/) — Virtual analog

Nonlinear models of classic synthesizer filters. ZDF topology with tanh saturation.

- `moogLadder` — 4-pole -24dB/oct with resonance. Warm, fat, singing (Moog 1966)
- `diodeLadder` — TB-303 diode ladder. Squelchy acid bass
- `korg35` — MS-20 2-pole with nonlinear feedback. Aggressive resonance

### [`auditory/`](auditory/) — Hearing and cochlear models

Perceptual filter banks that model human hearing.

- `gammatone` — Cochlear filter, ERB bandwidth (Glasberg & Moore 1990)
- `octaveBank` — IEC 61260 fractional-octave filter bank
- `erbBank` — ERB-spaced center frequencies and bandwidths
- `barkBank` — Bark critical band filters (Zwicker 1980)

### [`eq/`](eq/) — Equalization and composites

Multi-band audio processing chains built from biquad cascades.

- `graphicEq` — 10-band ISO octave graphic EQ
- `parametricEq` — N-band parametric EQ with peaking + shelves
- `crossover` — N-way Linkwitz-Riley crossover network
- `crossfeed` — Headphone spatialization (L↔R lowpass mix)
- `formant` — Parallel resonator bank (vowel synthesis)
- `vocoder` — Channel vocoder (spectral envelope transfer)

### [`misc/`](misc/) — Building blocks

Single-purpose processors. Grab one when you need it.

- `dcBlocker` — Remove DC offset: $H(z) = (1 - z^{-1})/(1 - Rz^{-1})$
- `comb` — Feedforward/feedback comb (flanging, reverb, Karplus-Strong)
- `allpass` — Phase shift at unity magnitude (phaser, dispersive delay)
- `emphasis` / `deemphasis` — Pre/de-emphasis for speech, FM broadcast
- `resonator` — Constant-peak-gain resonator (modal/formant synthesis)
- `envelope` — Attack/release envelope follower (compressor sidechain)
- `slewLimiter` — Rate-of-change limiter (portamento, click prevention)
- `noiseShaping` — Quantization error shaping for dithering
- `pinkNoise` — 1/f spectral slope filter (Paul Kellet method)
- `spectralTilt` — Arbitrary dB/octave slope via shelving cascade
- `variableBandwidth` — Biquad with auto-recomputing coefficients

<p align=center><a href="./LICENSE">MIT</a> • <a href="https://github.com/krishnized/license/">ॐ</a></p>
