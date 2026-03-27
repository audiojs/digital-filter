# digital-filter [![npm](https://img.shields.io/npm/v/digital-filter.svg)](https://npmjs.org/package/digital-filter) [![test](https://github.com/audiojs/digital-filter/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/digital-filter/actions/workflows/test.yml) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Digital filter design and processing.

```js
import { butterworth, filter, freqz, mag2db } from 'digital-filter'

let sos = butterworth(4, 1000, 44100)       // design
filter(data, { coefs: sos })                 // apply
let dB = mag2db(freqz(sos, 512, 44100).magnitude)  // analyze
```

## Modules

### [`core/`](core/) — Processing, analysis, conversion

- `filter` — SOS cascade processor (DF2T)
- `filtfilt` — Zero-phase forward-backward filtering
- `convolution` — Direct convolution with impulse response
- `freqz` / `mag2db` — Frequency response
- `groupDelay` / `phaseDelay` — Delay analysis
- `impulseResponse` / `stepResponse` — Time-domain analysis
- `isStable` / `isMinPhase` / `isFir` / `isLinPhase` — Filter properties
- `sos2zpk` / `sos2tf` / `tf2zpk` / `zpk2sos` — Format conversion
- `transform` — Analog prototype → digital SOS
- `window` — 34 window functions

### [`iir/`](iir/) — IIR filter design

- `biquad` — 9 second-order types (RBJ Cookbook)
- `svf` — State variable filter, safe for real-time modulation (Simper 2011)
- `butterworth` — Maximally flat magnitude, no ripple (Butterworth 1930)
- `chebyshev` — Equiripple passband, steeper cutoff
- `chebyshev2` — Flat passband, equiripple stopband
- `elliptic` — Sharpest transition for given order, ripple in both bands (Cauer 1958)
- `bessel` — Maximally flat group delay, preserves waveform (Thomson 1949)
- `legendre` — Steepest monotonic (ripple-free) rolloff (Papoulis 1958)
- `iirdesign` — Auto-selects optimal family + order from specs
- `linkwitzRiley` — Crossover: LP+HP sum to unity (Linkwitz 1976)

### [`fir/`](fir/) — FIR filter design

- `firwin` — Windowed sinc LP/HP/BP/BS
- `firwin2` — Arbitrary magnitude response
- `firls` — Least-squares optimal
- `remez` — Equiripple optimal (Parks-McClellan 1972)
- `kaiserord` — Estimate filter length from specs
- `hilbert` — 90-degree phase shift
- `minimumPhase` — Linear-phase → minimum-phase
- `differentiator` — FIR derivative
- `integrator` — Newton-Cotes quadrature
- `raisedCosine` — ISI-free pulse shaping
- `gaussianFir` — GMSK/Bluetooth pulse shaping
- `matchedFilter` — Maximum SNR detection
- `yulewalk` — IIR from arbitrary magnitude
- `lattice` — Lattice/ladder structure
- `warpedFir` — Frequency-warped FIR

### [`smooth/`](smooth/) — Smoothing and denoising

- `onePole` — One-pole lowpass (EMA)
- `movingAverage` — Boxcar average
- `leakyIntegrator` — Exponential decay
- `median` — Nonlinear, removes impulses, preserves edges
- `savitzkyGolay` — Polynomial fit, preserves peaks
- `gaussianIir` — Recursive Gaussian, O(1) any sigma
- `oneEuro` — Adaptive: smooth at rest, fast when moving (Casiez 2012)
- `dynamicSmoothing` — Self-adjusting SVF cutoff

### [`adaptive/`](adaptive/) — Adaptive filters

- `lms` — Least Mean Squares, O(N)/sample
- `nlms` — Normalized LMS, self-normalizing — the practical default
- `rls` — Recursive Least Squares, O(N^2), fastest convergence
- `levinson` — Levinson-Durbin, for LPC and speech coding

### [`multirate/`](multirate/) — Sample rate conversion

- `decimate` — Anti-alias + downsample
- `interpolate` — Upsample + anti-image
- `halfBand` — Half-band FIR for efficient 2x
- `cic` — Cascaded integrator-comb, multiplier-free
- `polyphase` — Decompose FIR into polyphase components
- `farrow` — Lagrange fractional delay
- `thiran` — Allpass fractional delay
- `oversample` — Multi-stage oversampling

### [`weighting/`](weighting/) — Acoustic measurement

- `aWeighting` — IEC 61672, human loudness ~40 phon
- `cWeighting` — IEC 61672, nearly flat, peak SPL
- `kWeighting` — ITU-R BS.1770, LUFS loudness metering (Spotify, YouTube, broadcast)
- `itu468` — ITU-R BS.468, broadcast equipment noise
- `riaa` — IEC 98, vinyl playback equalization

### [`analog/`](analog/) — Virtual analog

- `moogLadder` — 4-pole -24dB/oct, warm and singing (Moog 1966)
- `diodeLadder` — TB-303 diode ladder, squelchy acid bass
- `korg35` — MS-20 2-pole, aggressive resonance

### [`auditory/`](auditory/) — Hearing models

- `gammatone` — Cochlear filter, ERB bandwidth (Glasberg & Moore 1990)
- `octaveBank` — IEC 61260 fractional-octave bank
- `erbBank` — ERB-spaced frequencies and bandwidths
- `barkBank` — Bark critical band filters (Zwicker 1980)

### [`eq/`](eq/) — Equalization and composites

- `graphicEq` — 10-band ISO octave graphic EQ
- `parametricEq` — N-band parametric EQ
- `crossover` — N-way Linkwitz-Riley crossover
- `crossfeed` — Headphone spatialization
- `formant` — Parallel resonator bank (vowel synthesis)
- `vocoder` — Channel vocoder

### [`misc/`](misc/) — Building blocks

- `dcBlocker` — Remove DC offset
- `comb` — Feedforward/feedback comb
- `allpass` — Phase shift at unity magnitude
- `emphasis` / `deemphasis` — Pre/de-emphasis
- `resonator` — Constant-peak-gain resonator
- `envelope` — Attack/release follower
- `slewLimiter` — Rate-of-change limiter
- `noiseShaping` — Quantization error shaping
- `pinkNoise` — 1/f spectral slope
- `spectralTilt` — Arbitrary dB/octave slope
- `variableBandwidth` — Auto-recomputing biquad

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
| Reduce jitter in sensor/UI data | `oneEuro(data, params)` | Adaptive (Casiez 2012) |
| Remove impulse noise (clicks) | `median(data, {size})` | Nonlinear |
| Remove DC offset | `dcBlocker(data, {R})` | R=0.995 default |
| **Adaptive** | | |
| Cancel echo / noise | `nlms(input, desired, params)` | Normalized LMS |
| Fastest convergence | `rls(input, desired, params)` | O(N^2) but fast |
| LPC / Toeplitz solver | `levinson(R, order)` | From autocorrelation |
| **FIR** | | |
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

## Recipes

### Parametric EQ
```js
parametricEq(data, { fs: 44100, bands: [
  { fc: 200, Q: 0.8, gain: 3 },
  { fc: 3000, Q: 2, gain: -4 },
  { fc: 12000, Q: 0.7, gain: 2, type: 'highshelf' }
]})
```

### Loudness metering (LUFS)
```js
filter(data, { coefs: kWeighting(48000) })
let sum = 0
for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
let lufs = -0.691 + 10 * Math.log10(sum / data.length)
```

### Hum removal
```js
for (let f of [60, 120, 180]) filter(data, { coefs: biquad.notch(f, 30, 44100) })
```

### Subtractive synth
```js
let params = { fc: 800, resonance: 0.6, fs: 44100 }
moogLadder(sawtoothData, params)
params.fc = 200 + 3000 * envelopeValue
moogLadder(nextBlock, params)
```

### Echo cancellation
```js
nlms(farEnd, microphone, { order: 512, mu: 0.5 })
// params.error = cleaned signal
```

### ECG filtering
```js
filter(data, { coefs: butterworth(2, 0.5, 500, 'highpass') })
filter(data, { coefs: butterworth(4, 40, 500) })
filter(data, { coefs: biquad.notch(50, 35, 500) })
```

### Karplus-Strong string
```js
let delay = Math.round(44100 / 440), data = new Float64Array(44100)
for (let i = 0; i < delay; i++) data[i] = Math.random() * 2 - 1
comb(data, { delay, gain: 0.996, type: 'feedback' })
onePole(data, { fc: 4000, fs: 44100 })
```

## Concepts

A filter does something in *time* (averaging, delaying) that corresponds to something in *frequency* (passing, cutting, boosting). **Magnitude response** — how much of each frequency passes. The -3 dB point is the conventional cutoff.

**IIR** — uses feedback, efficient (5-20 multiplies), low latency, nonlinear phase. **FIR** — no feedback, always stable, linear phase, needs 100-1000+ taps. Use IIR for real-time, FIR for offline/linear phase.

The **biquad** ($H(z) = (b_0 + b_1 z^{-1} + b_2 z^{-2}) / (1 + a_1 z^{-1} + a_2 z^{-2})$) is the atomic unit. Every IIR filter is cascaded biquads (**SOS**). Direct form above order ~6 loses precision; SOS doesn't.

### Pitfalls

- **FIR when IIR suffices** — 4th-order Butterworth: 10 multiplies vs FIR: 100+
- **High order when elliptic works** — elliptic 4 matches Butterworth 12
- **filtfilt in real-time** — needs entire signal for backward pass
- **LP+HP for crossover** — doesn't sum flat, use `linkwitzRiley`
- **Q too high** — Q > 10 creates tall resonance, keep 0.5-8 for EQ
- **Filtering same data twice** — `filter()` is in-place, copy first
- **Stale state** — filter state persists in params, create new for new signal

<p align=center><a href="./LICENSE">MIT</a> • <a href="https://github.com/krishnized/license/">ॐ</a></p>
