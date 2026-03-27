# Smoothing and Denoising

Real signals are noisy. Sensor jitter, quantization steps, electromagnetic interference, user input tremor – every measurement carries unwanted variation on top of the true signal. Smoothing filters separate signal from noise, trading time resolution for amplitude certainty.

The spectrum of smoothers runs from trivially simple (moving average) to self-adapting (one-euro). The right choice depends on three questions: what kind of noise, how much latency is tolerable, and whether sharp features must survive.

## Groups

### Linear: one-pole, moving-average, leaky-integrator

These treat every sample equally within their window or memory. Output is a weighted linear combination of inputs. Simple, predictable, analyzable in the frequency domain. They blur edges and peaks indiscriminately.

### Nonlinear: median

Replaces each sample with the rank-order median of its neighborhood. Immune to outliers – a single spike has zero effect if it is outnumbered. Preserves step edges that linear filters smear. Not expressible as a convolution.

### Polynomial: savitzky-golay, gaussian-iir

Fit a local model (polynomial or Gaussian kernel) to the data, preserving shape features that simple averages destroy. Savitzky-Golay preserves peaks and inflection points. Gaussian IIR achieves arbitrarily wide smoothing in O(N) via recursive approximation.

### Adaptive: one-euro, dynamic-smoothing

The cutoff frequency changes per sample based on signal behavior. Slow-moving signals get heavy smoothing; fast transients pass through with minimal lag. No single fixed parameter can achieve this tradeoff – adaptivity is the only way.

## Modules

### one-pole.js

Exponential moving average (EMA). The simplest recursive smoother: one multiply, one add, one sample of state.

$$y[n] = (1 - a) \cdot x[n] + a \cdot y[n-1]$$

The coefficient $a$ controls memory. Closer to 1 = smoother, more lag. Can be set directly or derived from a cutoff frequency:

$$a = e^{-2\pi f_c / f_s}$$

```js
import onePole from 'digital-filter/smooth/one-pole.js'

let params = { fc: 100, fs: 44100 }
onePole(data, params)           // in-place
// or: params = { a: 0.99 }    // direct coefficient
```

**API**: `onePole(data, { a?, fc?, fs?, y1? })` &rarr; `data` (in-place)
- `a` – feedback coefficient (0-1). If omitted, computed from `fc`/`fs`.
- `fc` – cutoff frequency in Hz
- `fs` – sample rate (default 44100)
- `y1` – initial state (persists between calls)

**Use when**: you need the simplest possible smoother with minimal latency. Control signals, envelope followers, DC estimation.

**Avoid when**: you need edge preservation or zero-phase response.

---

### moving-average.js

Boxcar average of the last N samples. FIR, linear phase, zero overshoot. The output is exactly the arithmetic mean of the window.

$$y[n] = \frac{1}{N} \sum_{k=0}^{N-1} x[n-k]$$

The frequency response is a sinc function – nulls at multiples of $f_s / N$. This makes it excellent for removing periodic interference when the period is known.

```js
import movingAverage from 'digital-filter/smooth/moving-average.js'

let params = { memory: 16 }
movingAverage(data, params)     // in-place, 16-sample window
movingAverage(data2, params)    // stateful: continues from previous call
```

**API**: `movingAverage(data, { memory?, ptr? })` &rarr; `data` (in-place)
- `memory` – window size (default 8). Can be a number or pre-allocated array.
- `ptr` – internal pointer (auto-managed, persists between calls)

**Use when**: you want no overshoot, exact linear phase, or need to null a known periodic frequency.

**Avoid when**: you need sharp frequency cutoff (the sinc rolloff is slow) or must preserve peaks.

---

### leaky-integrator.js

Exponential decay smoother with explicit leak parameter $\lambda$. Algebraically identical to one-pole with $a = \lambda$, but parameterized for accumulation/decay semantics.

$$y[n] = \lambda \cdot y[n-1] + (1 - \lambda) \cdot x[n]$$

```js
import leaky from 'digital-filter/smooth/leaky-integrator.js'

leaky(data, { lambda: 0.95 })   // in-place
```

**API**: `leaky(data, { lambda?, y? })` &rarr; `data` (in-place)
- `lambda` – retention factor 0-1 (default 0.95). Higher = smoother.
- `y` – initial state (persists between calls)

**Use when**: you think in terms of "how fast does the accumulator decay" rather than "what is the cutoff frequency." Common in reinforcement learning, statistics, level metering.

**Avoid when**: you need frequency-domain control – use one-pole with `fc` instead.

---

### median.js

Replaces each sample with the median of a centered window. Nonlinear: a single outlier cannot shift the output as long as more than half the window is clean.

```js
import median from 'digital-filter/smooth/median.js'

median(data, { size: 5 })       // in-place, 5-sample window
```

**API**: `median(data, { size? })` &rarr; `data` (in-place)
- `size` – window size, should be odd (default 5)

Edges are clamped (boundary samples are replicated).

**Use when**: the noise is impulsive – clicks, dropouts, salt-and-pepper spikes. The median removes them completely while preserving step edges.

**Avoid when**: the noise is Gaussian (median is less efficient than linear filters for Gaussian noise) or you need a frequency-domain description.

---

### savitzky-golay.js

Fits a polynomial of degree $p$ to a sliding window of $m$ samples via least squares, then evaluates it at the center. Equivalent to convolution with precomputed coefficients derived from $(J^T J)^{-1} J^T$.

Can also compute smoothed derivatives (1st, 2nd, ...) by evaluating the derivative of the fitted polynomial.

```js
import savitzkyGolay from 'digital-filter/smooth/savitzky-golay.js'

savitzkyGolay(data, { windowSize: 7, degree: 3 })              // smooth
savitzkyGolay(data, { windowSize: 7, degree: 3, derivative: 1 }) // 1st derivative
```

**API**: `savitzkyGolay(data, { windowSize?, degree?, derivative? })` &rarr; `data` (in-place)
- `windowSize` – number of points, must be odd (default 5)
- `degree` – polynomial degree (default 2). Must be < windowSize.
- `derivative` – derivative order (default 0 = smoothing)

Coefficients are computed once and cached in `params._coefs`.

**Use when**: you need to smooth while preserving peak heights, positions, and widths. Spectroscopy, chromatography, any measurement where peak shape matters.

**Avoid when**: the signal has sharp discontinuities (polynomial fit will ring at edges) or you need real-time streaming with minimal latency.

---

### gaussian-iir.js

Approximates Gaussian smoothing using a 3rd-order recursive filter (Young-van Vliet). Forward-backward passes give zero-phase response. Cost is O(N) regardless of sigma – a sigma=100 Gaussian kernel would need 601+ taps as FIR, but this uses 6 multiplies per sample always.

$$\text{Forward: } y[n] = B \cdot x[n] + \frac{b_1 y[n\!-\!1] + b_2 y[n\!-\!2] + b_3 y[n\!-\!3]}{b_0}$$

Backward pass applies the same recurrence in reverse for zero-phase.

```js
import gaussianIir from 'digital-filter/smooth/gaussian-iir.js'

gaussianIir(data, { sigma: 10 })    // in-place, sigma in samples
```

**API**: `gaussianIir(data, { sigma? })` &rarr; `data` (in-place)
- `sigma` – standard deviation in samples (default 5)

**Use when**: you need wide, isotropic smoothing at constant cost. Image processing (per-scanline), scale-space construction, large-kernel denoising.

**Avoid when**: you need real-time streaming (forward-backward requires the full block) or edge preservation.

---

### one-euro.js

Adaptive lowpass that adjusts cutoff based on signal speed. When the signal is slow-moving, cutoff drops for maximum smoothing. When the signal changes fast, cutoff rises to track without lag.

$$f_c[n] = f_{c,\min} + \beta \cdot |\dot{x}[n]|$$

The derivative $\dot{x}$ is itself lowpass-filtered at a fixed cutoff `dCutoff`. The smoothing factor for each stage is:

$$\alpha = \frac{1}{1 + \frac{1}{2\pi f_c T_s}}$$

Reference: Casiez, Roussel, Vogel, "1 Euro Filter", CHI 2012.

```js
import oneEuro from 'digital-filter/smooth/one-euro.js'

let params = { minCutoff: 1, beta: 0.007, fs: 60 }
oneEuro(data, params)           // in-place
oneEuro(data2, params)          // stateful
```

**API**: `oneEuro(data, { minCutoff?, beta?, dCutoff?, fs?, x?, dx? })` &rarr; `data` (in-place)
- `minCutoff` – minimum cutoff Hz when signal is still (default 1)
- `beta` – speed coefficient, higher = more responsive to movement (default 0.007)
- `dCutoff` – cutoff for derivative estimation (default 1)
- `fs` – sample rate (default 60, typical for UI; set higher for audio)
- `x`, `dx` – internal state (persists between calls)

**Use when**: sensor data, mouse/touch input, VR tracking, any signal where jitter at rest and lag during motion are both unacceptable.

**Avoid when**: the signal has no concept of "speed" (e.g., frequency-domain data) or you need a well-defined frequency response.

---

### dynamic-smoothing.js

Self-adjusting state variable filter (SVF) whose cutoff rises with signal speed, based on Andrew Simper's approach. Uses a 2nd-order SVF topology for cleaner rolloff than one-euro's single pole.

$$f_c[n] = f_{c,\min} + (f_{c,\max} - f_{c,\min}) \cdot \min(\text{speed} \cdot \text{sensitivity},\; 1)$$

The SVF is computed with trapezoidal integration for stability at all cutoff frequencies.

```js
import dynamicSmoothing from 'digital-filter/smooth/dynamic-smoothing.js'

let params = { minFc: 1, maxFc: 5000, sensitivity: 1, fs: 44100 }
dynamicSmoothing(data, params)
```

**API**: `dynamicSmoothing(data, { minFc?, maxFc?, sensitivity?, fs? })` &rarr; `data` (in-place)
- `minFc` – cutoff when signal is still (default 1 Hz)
- `maxFc` – cutoff when signal is changing fast (default 5000 Hz)
- `sensitivity` – speed-to-cutoff scaling (default 1)
- `fs` – sample rate (default 44100)

Internal SVF state (`_s1`, `_s2`, `_prev`) persists between calls.

**Use when**: audio-rate parameter smoothing, automating filter cutoffs, any audio control signal that must be both smooth and responsive.

**Avoid when**: you need a fixed, predictable frequency response.

## Decision guide

| Noise type | Latency need | Edge preservation | Recommended filter |
|---|---|---|---|
| Gaussian, mild | Minimal | Not needed | `onePole` or `leakyIntegrator` |
| Gaussian, heavy | Block OK | Not needed | `gaussianIir` |
| Periodic interference | Minimal | Not needed | `movingAverage` (set N to period) |
| Impulsive (clicks, spikes) | Block OK | Critical | `median` |
| Gaussian, shape matters | Block OK | Peaks preserved | `savitzkyGolay` |
| Jitter at rest + fast motion | Minimal | Automatic | `oneEuro` |
| Audio control signals | Sample-by-sample | Automatic | `dynamicSmoothing` |

**Rule of thumb**: start with `onePole`. If you need edge preservation, try `median`. If you need peak preservation, try `savitzkyGolay`. If you need adaptive behavior, use `oneEuro` (low-rate) or `dynamicSmoothing` (audio-rate).
