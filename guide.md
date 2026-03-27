# Guide

Learn digital filters, pick the right one, apply it.

```js
import { butterworth, filter, freqz, mag2db } from 'digital-filter'
```

For audio-specific filters (EQ, weighting, synth, measurement), see [audio-filter](https://github.com/audiojs/audio-filter).

---

## Part 1 – Understanding filters

### What is a filter?

A filter takes samples in and produces samples out. The simplest useful filter – averaging the last 3 samples:

```js
output[i] = (input[i] + input[i-1] + input[i-2]) / 3
```

This smooths the signal: fast changes get reduced, slow trends survive. That is a **lowpass filter** – it passes low frequencies and reduces high ones.

Every filter has a dual nature: it does something in *time* (averaging, delaying, accumulating) that corresponds to something in *frequency* (passing, cutting, boosting).

### Frequency domain

Sound is a mix of frequencies. A lowpass filter at 1000 Hz:
- Below 1000 Hz – passes through unchanged
- Above 1000 Hz – attenuated
- The boundary – gradual transition

The **magnitude response** plots "how much of each frequency gets through" (dB) vs frequency (Hz). This is the single most important visualization for any filter.

**dB scale** – decibels are logarithmic ratios. $\text{dB} = 20 \log_{10}(\text{ratio})$.

| dB | Ratio | Meaning |
|---|---|---|
| 0 dB | 1.0 | Unchanged |
| –3 dB | 0.71 | Half power (the standard "cutoff" point) |
| –6 dB | 0.50 | Half amplitude |
| –20 dB | 0.10 | 10% amplitude |
| –60 dB | 0.001 | Effectively silent |

**Passband** – frequencies that pass through (near 0 dB). **Stopband** – frequencies rejected (far below 0 dB). **Transition band** – the slope between them. The **–3 dB point** is the conventional cutoff frequency ($f_c$).

### Phase and group delay

Magnitude tells you *how much* of each frequency passes. Phase tells you *when* it arrives.

A filter delays different frequencies by different amounts. If all frequencies are delayed equally, the waveform shape is preserved – **linear phase**. If not, the waveform distorts.

**Group delay** measures how many samples each frequency is delayed. Constant group delay = linear phase.

When it matters:
- **Audio crossovers** – nonlinear phase makes drivers sum incorrectly
- **Biomedical** – phase distortion changes ECG/EEG waveform shapes
- **Communications** – intersymbol interference
- **EQ** – usually inaudible, nonlinear phase is fine

FIR filters can have perfect linear phase (symmetric coefficients). IIR filters cannot.

### IIR vs FIR

**IIR** (infinite impulse response) – uses feedback. Output depends on previous *outputs* as well as inputs.

```
y[n] = b0·x[n] + b1·x[n-1] + b2·x[n-2] – a1·y[n-1] – a2·y[n-2]
```

Efficient (5–20 multiplies for a sharp lowpass), low latency, matches analog filter behavior. Cannot achieve linear phase. Can be unstable.

**FIR** (finite impulse response) – no feedback. Output depends only on current and past *inputs*.

```
y[n] = h[0]·x[n] + h[1]·x[n-1] + … + h[N-1]·x[n-N+1]
```

Always stable, can have perfect linear phase. Needs many taps for sharp cutoff (100–1000+), higher latency.

| | IIR | FIR |
|---|---|---|
| Efficiency | 5–20 multiplies | 100–1000+ |
| Phase | Nonlinear | Linear (symmetric) |
| Stability | Can be unstable | Always stable |
| Latency | Low | High (N/2 samples) |
| Adaptive | Hard | Easy (LMS, NLMS) |

**Use IIR** for real-time audio, control systems, anything latency-sensitive.
**Use FIR** for offline processing, linear phase, adaptive filtering, pulse shaping.

### Biquads and SOS

The **biquad** is a filter with 5 coefficients:

$$H(z) = \frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{1 + a_1 z^{-1} + a_2 z^{-2}}$$

Every IIR filter is built from cascaded biquads – **second-order sections** (SOS). A 4th-order Butterworth is two biquads in series. An 8th-order elliptic is four.

Why not higher-order direct form? A 10th-order filter requires ~15 digits of coefficient precision – impossible with float64. The same filter as 5 cascaded biquads works perfectly. This library returns SOS arrays by default.

### Bilinear transform

Classic filter families (Butterworth, Chebyshev, Bessel, Elliptic) were designed for analog circuits. The **bilinear transform** maps them to digital:

$$s = \frac{2}{T} \cdot \frac{z-1}{z+1}$$

It maps the entire analog frequency axis to $[0, f_s/2]$, with frequency warping corrected at the cutoff by prewarping. All IIR design functions in this library prewarp automatically – the cutoff you specify is the cutoff you get.

### Stability

An IIR filter is stable if all **poles** are inside the unit circle in the z-plane. `isStable(sos)` checks this.

Instability happens when:
- Coefficient quantization pushes a pole outside the unit circle (more common with direct form – another reason to use SOS)
- Filter parameters are changed carelessly (e.g., Q approaching 0)
- Feedback gain exceeds the stability limit

FIR filters are always stable – they have no feedback.

### Sampling theorem

A digital system at sample rate $f_s$ can represent frequencies up to $f_s/2$ (the **Nyquist frequency**). Frequencies above Nyquist fold back ("alias") into the representable range, creating false signals.

This is why anti-aliasing filters are applied before downsampling, and anti-imaging filters after upsampling. `decimate` and `interpolate` handle this automatically.

---

## Part 2 – Choosing the right filter

### "I want to…" lookup

| I want to… | Use | Notes |
|---|---|---|
| **Frequency selection** | | |
| Remove frequencies above a cutoff | `butterworth(N, fc, fs)` | Default, flat passband |
| Remove frequencies below a cutoff | `butterworth(N, fc, fs, 'highpass')` | |
| Keep only a frequency range | `butterworth(N, [lo, hi], fs, 'bandpass')` | |
| Remove a frequency range | `butterworth(N, [lo, hi], fs, 'bandstop')` | |
| Remove one exact frequency | `biquad.notch(fc, Q, fs)` | Q=30 for narrow null |
| Boost/cut a frequency band | `biquad.peaking(fc, Q, fs, dB)` | Parametric EQ bell |
| Split signal into bands | `linkwitzRiley(4, fc, fs)` | LP+HP sum to flat |
| **Sharp cutoff** | | |
| Sharpest possible, ripple OK | `elliptic(N, fc, fs, rp, rs)` | Minimum order |
| Sharp, passband ripple OK | `chebyshev(N, fc, fs, ripple)` | Steeper than Butterworth |
| Sharp, passband must be flat | `chebyshev2(N, fc, fs, attenuation)` | Equiripple stopband |
| Sharp, no ripple anywhere | `legendre(N, fc, fs)` | Between Butter & Cheby |
| Auto-select best family + order | `iirdesign(fpass, fstop, rp, rs, fs)` | |
| **Waveform preservation** | | |
| No ringing/overshoot | `bessel(N, fc, fs)` | Maximally flat group delay |
| No phase distortion | `filtfilt(data, {coefs})` | Zero-phase, offline only |
| **Smoothing** | | |
| Smooth a control signal | `onePole(data, {fc, fs})` | Simplest, no overshoot |
| Smooth preserving peaks | `savitzkyGolay(data, {windowSize, degree})` | Polynomial fit |
| Adaptive (low jitter + latency) | `oneEuro(data, params)` | Casiez 2012 |
| Remove impulse noise | `median(data, {size})` | Nonlinear |
| Remove DC offset | `dcBlocker(data, {R})`[^af] | R=0.995 default |
| **Adaptive** | | |
| Cancel echo / noise | `nlms(input, desired, params)` | Normalized LMS |
| Fastest convergence | `rls(input, desired, params)` | O(N²) but fast |
| LPC / Toeplitz solver | `levinson(R, order)` | From autocorrelation |
| **FIR design** | | |
| Quick FIR filter | `firwin(N, fc, fs, {type})` | Window method |
| Optimal sharp FIR | `remez(N, bands, desired)` | Parks-McClellan |
| Arbitrary shape FIR | `firwin2(N, freqs, gains)` | Frequency sampling |
| Estimate FIR order needed | `kaiserord(deltaF, attenuation)` | Returns numtaps + beta |
| **Multirate** | | |
| Downsample | `decimate(data, factor)` | Anti-alias included |
| Upsample | `interpolate(data, factor)` | Anti-image included |
| Oversample for nonlinear | `oversample(data, factor)` | Multi-stage |

[^af]: `dcBlocker` and other audio-specific filters are in [audio-filter](https://github.com/audiojs/audio-filter).

### IIR family decision tree

```
Need linear phase?
├── Yes → FIR or filtfilt (offline)
└── No
    Waveform shape must be preserved?
    ├── Yes → bessel
    └── No
        Passband ripple acceptable?
        ├── Yes
        │   ├── Stopband ripple also OK? → elliptic (sharpest)
        │   └── Stopband must be monotonic → chebyshev
        └── No (passband must be flat)
            ├── Stopband ripple OK? → chebyshev2
            └── No ripple anywhere?
                ├── Steepest monotonic? → legendre
                └── Safe default → butterworth
```

**Order selection**: start with 4. Not steep enough – try 6 or 8. Ringing problems – go lower. For exact specs, use `iirdesign`.

### FIR method selector

| Method | Optimality | Best for | Weakness |
|---|---|---|---|
| `firwin` | Good enough | Quick prototyping, 80% of tasks | Not optimal for tight specs |
| `firls` | Least-squares | Smooth specs, audio | Wider transition than remez |
| `remez` | Minimax | Sharpest transitions | Convergence issues at high order |
| `firwin2` | Frequency sampling | Arbitrary shapes | Not formally optimal |

### Common mistakes

- **FIR when IIR suffices** – 4th-order Butterworth: 10 multiplies. Equivalent FIR: 100+.
- **Butterworth order 20 when elliptic 4 suffices** – use `iirdesign` to find minimum order.
- **Forgetting SOS** – never implement high-order IIR as one polynomial. This library returns SOS by default.
- **filtfilt in real-time** – needs the entire signal for backward pass.
- **Independent LP+HP for crossover** – doesn't sum flat. Use `linkwitzRiley`.
- **Q too high** – Q=0.707 is Butterworth default. Q > 10 creates tall resonance. For EQ: 0.5–8.
- **Filtering same data twice** – `filter()` is in-place. Copy first: `Float64Array.from(data)`.
- **Stale state** – filter state persists in params. Create new params for new signal.

---

## Part 3 – Recipes

### Subtractive synth[^af2]

[^af2]: Recipes marked with ★ use [audio-filter](https://github.com/audiojs/audio-filter). All others use digital-filter only.

```js
import { moogLadder } from 'audio-filter' // ★

let params = { fc: 800, resonance: 0.6, fs: 44100 }
moogLadder(sawtoothData, params)
params.fc = 200 + 3000 * envelopeValue  // animate cutoff
moogLadder(nextBlock, params)
```

Resonance: 0 = none, 0.5 = pronounced, 1.0 = self-oscillation. Moog is –24 dB/oct. For –12 dB/oct use `svf`, for nonlinear –12 dB/oct use `korg35`.

### Loudness metering (LUFS) ★

```js
import { kWeighting } from 'audio-filter'
import { filter } from 'digital-filter'

let data = Float64Array.from(buffer)
filter(data, { coefs: kWeighting(48000) })

let sum = 0
for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
let lufs = -0.691 + 10 * Math.log10(sum / data.length)
```

### Hum removal ★

```js
import { biquad, filter } from 'digital-filter'

for (let f of [60, 120, 180]) filter(data, { coefs: biquad.notch(f, 30, 44100) })
```

Q=30 gives a ~2 Hz wide null. For 50 Hz regions: `[50, 100, 150, 200]`.

### Echo cancellation

```js
import { nlms } from 'digital-filter'

let params = { order: 512, mu: 0.5 }
nlms(farEnd, microphone, params)
// params.error = cleaned signal
```

Order must cover the echo path: 256–2048 taps. Lower `mu` for stability, higher for faster tracking.

### ECG filtering

```js
import { butterworth, biquad, filter } from 'digital-filter'

let fs = 500
filter(data, { coefs: butterworth(2, 0.5, fs, 'highpass') })  // baseline wander
filter(data, { coefs: butterworth(4, 40, fs) })                 // EMG/noise
filter(data, { coefs: biquad.notch(50, 35, fs) })               // powerline
```

For offline (preserving QRS shape), use `filtfilt` instead. `bessel` preserves waveform better than Butterworth.

### EEG band extraction

```js
import { butterworth, filter } from 'digital-filter'

let fs = 256
let alpha = butterworth(4, [8, 13], fs, 'bandpass')
let signal = Float64Array.from(data)
filter(signal, { coefs: alpha })
```

Delta (0.5–4 Hz), theta (4–8), alpha (8–13), beta (13–30), gamma (30–100).

### Karplus-Strong string ★

```js
import { comb, onePole } from 'audio-filter'

let delay = Math.round(44100 / 440)
let data = new Float64Array(44100)
for (let i = 0; i < delay; i++) data[i] = Math.random() * 2 - 1
comb(data, { delay, gain: 0.996, type: 'feedback' })
onePole(data, { fc: 4000, fs: 44100 })
```

Delay sets pitch. Gain near 1 = long sustain. Lower `fc` = duller, higher = brighter.

### Pulse shaping

```js
import { raisedCosine, convolution } from 'digital-filter'

let htx = raisedCosine(101, 0.35, 8, { root: true })
let shaped = convolution(symbols, htx)
```

Beta: 0 = minimum bandwidth, 0.35 = standard, 1.0 = widest.

### Real-time block processing

All stateful filters maintain state between calls:

```js
let params = { coefs: butterworth(4, 1000, 44100) }

filter(block1, params)  // state persists
filter(block2, params)  // seamless
filter(block3, params)
```

Same pattern works for `svf`, `onePole`, `nlms`, and all other stateful filters.
