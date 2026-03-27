# DSP engine

Every filter in this package – IIR, FIR, adaptive, analog – ultimately runs through these modules: design coefficients, apply them to samples, analyze the result.

## SOS format

All IIR filters are stored as **second-order sections** (SOS) – a cascade of biquad stages, each described by five coefficients:

```
{ b0, b1, b2, a1, a2 }
```

This represents the transfer function of one section:

$$H(z) = \frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{1 + a_1 z^{-1} + a_2 z^{-2}}$$

A complete filter is an array of these objects. The cascade product gives the overall transfer function.

Why not a single high-order polynomial? Because floating-point arithmetic makes high-order polynomials numerically unstable. Second-order sections keep each stage's coefficients small and well-conditioned. A 10th-order Butterworth as one polynomial will ring or blow up; as five biquads it is rock-solid.

## Modules

### filter.js

SOS cascade processor using **Direct Form II Transposed**. Filters in-place for zero allocation.

```js
import filter from 'digital-filter/core/filter.js'

filter(data, { coefs: sos })
// data is modified in-place, same reference returned

// Stateful (streaming): pass state between calls
let params = { coefs: sos }
filter(chunk1, params)  // params.state created automatically
filter(chunk2, params)  // continues from previous state
```

**API**: `filter(data, { coefs, state? })` &rarr; `data`
- `data` – `Float64Array | Float32Array | Array<number>`, modified in-place
- `coefs` – single SOS object or array of SOS objects
- `state` – optional `Array<[number, number]>`, auto-created if omitted, persists between calls

---

### filtfilt.js

Zero-phase forward-backward filtering. Eliminates phase distortion by running the filter forward, then backward with fresh state. Doubles the effective order (magnitude response is squared).

```js
import filtfilt from 'digital-filter/core/filtfilt.js'

filtfilt(data, { coefs: sos })
```

**API**: `filtfilt(data, { coefs })` &rarr; `data` (in-place)

Use for offline processing where phase matters (waveform shape preservation). Not suitable for real-time / streaming.

---

### convolution.js

Direct FIR convolution, $O(N \cdot M)$. Output length is `signal.length + ir.length - 1`.

```js
import convolution from 'digital-filter/core/convolution.js'

let out = convolution(signal, impulseResponse)
// out is Float64Array of length N + M - 1
```

**API**: `convolution(signal, ir)` &rarr; `Float64Array`

---

### freqz.js

Frequency response of SOS filter sections. Also exports `mag2db` for decibel conversion.

```js
import freqz, { mag2db } from 'digital-filter/core/freqz.js'

let { frequencies, magnitude, phase } = freqz(sos, 512, 44100)
let dB = mag2db(magnitude)
```

**API**:
- `freqz(coefs, n?, fs?)` &rarr; `{ frequencies, magnitude, phase }` (all `Float64Array`)
  - `n` – number of frequency points (default 512)
  - `fs` – sample rate in Hz (default 44100)
- `mag2db(mag)` &rarr; `number | Float64Array` – $20 \log_{10}(\text{mag})$

---

### analysis.js

Time-domain and structural analysis of SOS filters.

```js
import {
  groupDelay, phaseDelay,
  impulseResponse, stepResponse,
  isStable, isMinPhase, isFir, isLinPhase
} from 'digital-filter/core/analysis.js'
```

**Delay analysis**:
- `groupDelay(coefs, n?, fs?)` &rarr; `{ frequencies, delay }` – $\tau_g(\omega) = -d\varphi/d\omega$
- `phaseDelay(coefs, n?, fs?)` &rarr; `{ frequencies, delay }` – $\tau_p(\omega) = -\varphi(\omega)/\omega$ (in samples)

**Time-domain response**:
- `impulseResponse(coefs, N?)` &rarr; `Float64Array` – response to $\delta[n]$, default 256 samples
- `stepResponse(coefs, N?)` &rarr; `Float64Array` – response to $u[n]$, default 256 samples

**Filter properties**:
- `isStable(sos)` &rarr; `boolean` – all poles inside unit circle
- `isMinPhase(sos)` &rarr; `boolean` – all zeros inside or on unit circle
- `isFir(sos)` &rarr; `boolean` – all `a1 === 0 && a2 === 0`
- `isLinPhase(h)` &rarr; `boolean` – FIR coefficients are symmetric or antisymmetric

---

### convert.js

Convert between SOS, transfer function polynomials $(b, a)$, and zeros/poles/gain.

```js
import { sos2zpk, sos2tf, tf2zpk, zpk2sos } from 'digital-filter/core/convert.js'

let { zeros, poles, gain } = sos2zpk(sos)
let { b, a } = sos2tf(sos)
let zpk = tf2zpk(b, a)
let roundTripped = zpk2sos(zpk)
```

**API**:
- `sos2zpk(sos)` &rarr; `{ zeros, poles, gain }` – zeros/poles as `{ re, im }` objects
- `sos2tf(sos)` &rarr; `{ b, a }` – numerator/denominator `Float64Array` polynomials
- `tf2zpk(b, a)` &rarr; `{ zeros, poles, gain }` – uses Durand-Kerner root finding
- `zpk2sos(zpk)` &rarr; `SOS[]` – pairs poles with nearest zeros for numerical stability

---

### transform.js

Analog prototype to digital SOS via the bilinear transform. This is the internal engine used by IIR design functions (Butterworth, Chebyshev, etc.).

Pipeline: **analog prototype poles** &rarr; **frequency transform** (LP/HP/BP/BS) &rarr; **bilinear transform** &rarr; **digital SOS**

```js
import { polesSos, poleZerosSos, prewarp } from 'digital-filter/core/transform.js'

// Butterworth 2nd-order LP prototype poles → digital SOS
let sos = polesSos([[-0.7071, 0.7071]], 1000, 44100, 'lowpass')

// For filters with finite zeros (elliptic, chebyshev2)
let sos2 = poleZerosSos(poles, zeros, 1000, 44100, 'lowpass')
```

**API**:
- `polesSos(poles, fc, fs, type)` &rarr; `SOS[]`
  - `poles` – `[[sigma, omega], ...]`, normalized prototype at 1 rad/s. `omega > 0` = conjugate pair, `omega === 0` = real pole
  - `fc` – cutoff Hz, or `[fLow, fHigh]` for bandpass/bandstop
  - `fs` – sample rate
  - `type` – `'lowpass' | 'highpass' | 'bandpass' | 'bandstop'`
- `poleZerosSos(poles, zeros, fc, fs, type)` &rarr; `SOS[]` – same, with finite zeros
- `prewarp(f, fs)` &rarr; `number` – frequency prewarping: $\omega_a = 2 f_s \tan(\pi f / f_s)$

---

### window.js

Re-exports 34 window functions from [window-function](https://github.com/scijs/window-function), adapted to a batch API.

```js
import { hann, kaiser, blackmanHarris } from 'digital-filter/core/window.js'

let w = hann(256)          // Float64Array of 256 samples
let w2 = kaiser(512, 8.6)  // Kaiser with beta=8.6
```

All functions have the signature `fn(N, ...params)` &rarr; `Float64Array`.

Available: `rectangular`, `triangular`, `bartlett`, `welch`, `connes`, `hann`, `hamming`, `cosine`, `blackman`, `exactBlackman`, `nuttall`, `blackmanNuttall`, `blackmanHarris`, `flatTop`, `bartlettHann`, `lanczos`, `parzen`, `bohman`, `powerOfSine`, `kaiser`, `gaussian`, `generalizedNormal`, `tukey`, `planckTaper`, `exponential`, `hannPoisson`, `cauchy`, `rifeVincent`, `confinedGaussian`, `kaiserBesselDerived`, `dolphChebyshev`, `taylor`, `dpss`, `ultraspherical`.

## Pipeline

The typical workflow:

```
Design                  Apply                   Analyze
───────────────────     ──────────────          ────────────────────
butterworth(4, 1k) ──→  filter(data, {coefs}) ──→  freqz(sos) → mag2db
chebyshev(6, 2k)   ──→  filtfilt(data, {coefs})    groupDelay(sos)
polesSos(proto)    ──→  convolution(data, ir)       impulseResponse(sos)
                                                    sos2zpk(sos) → poles
```

1. **Design** produces SOS arrays (via `transform.js` internally, or direct from `biquad`/`svf`).
2. **Apply** runs the SOS cascade on sample data (`filter.js` for real-time, `filtfilt.js` for offline).
3. **Analyze** inspects the result: frequency response, delay characteristics, stability, pole-zero locations.

The SOS format is the common currency – design functions produce it, processing functions consume it, analysis functions inspect it.
