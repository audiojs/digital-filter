# multirate/ -- Multirate Signal Processing

Not every part of a system needs to run at the same sample rate. A 192 kHz recording needs 44.1 kHz for playback. A control loop runs at 1 kHz but the sensor samples at 48 kHz. Nonlinear processing (distortion, waveshaping) needs higher rates to avoid aliasing, then returns to the original rate. Multirate processing changes sample rates efficiently.

The two fundamental operations:

- **Decimation** (downsample): reduce sample rate by factor $M$. Must lowpass filter first to prevent aliasing -- frequencies above the new Nyquist fold back in.
- **Interpolation** (upsample): increase sample rate by factor $L$. Insert $L-1$ zeros between samples, then lowpass filter to remove spectral images.

The order matters: filter *before* downsampling, filter *after* upsampling. Reversing either creates artifacts that cannot be undone.

## Modules

### decimate.js

Anti-alias lowpass filter followed by downsampling by factor $M$. The lowpass cutoff is set to 90% of the new Nyquist frequency $f_s / (2M)$ to prevent aliasing with margin.

```js
import decimate from 'digital-filter/multirate/decimate.js'

let out = decimate(data, 4)                         // 44100 → 11025 Hz
let out2 = decimate(data, 4, { numtaps: 127 })      // longer filter, sharper cutoff
```

**API**: `decimate(data, factor, opts?)` &rarr; `Float64Array` (new buffer, length = `ceil(N / factor)`)
- `data` -- input signal (`Float64Array`)
- `factor` -- decimation factor $M$
- `opts.numtaps` -- FIR filter length (default `30 * factor + 1`)
- `opts.fs` -- input sample rate (default 44100)

Uses `firwin` internally for the anti-aliasing filter.

**Use when**: you need to reduce sample rate for storage, transmission, or to lower processing cost downstream.

---

### interpolate.js

Upsample by factor $L$ then anti-image lowpass filter. Zero-stuffing creates $L-1$ spectral images; the lowpass removes them. Output is scaled by $L$ to maintain signal energy.

```js
import interpolate from 'digital-filter/multirate/interpolate.js'

let out = interpolate(data, 4)   // 11025 → 44100 Hz
```

**API**: `interpolate(data, factor, opts?)` &rarr; `Float64Array` (new buffer, length = `N * factor`)
- `data` -- input signal
- `factor` -- interpolation factor $L$
- `opts.numtaps` -- FIR filter length (default `30 * factor + 1`)
- `opts.fs` -- original sample rate (default 44100)

**Use when**: you need to increase sample rate for DAC output, format conversion, or before processing that requires higher rates.

---

### half-band.js

Generates half-band FIR filter coefficients. A half-band filter has its cutoff at exactly $f_s/4$ and has the property that nearly half its coefficients are zero (every other coefficient except the center tap). This means a 31-tap half-band filter requires only ~16 multiplies instead of 31.

Half-band filters are the building block for efficient 2x decimation/interpolation cascades. To decimate by 8, cascade three half-band stages rather than one steep filter.

```js
import halfBand from 'digital-filter/multirate/half-band.js'

let h = halfBand(31)   // Float64Array, 31 taps
// h[center] = 0.5, every other even-indexed coeff = 0
```

**API**: `halfBand(numtaps?)` &rarr; `Float64Array`
- `numtaps` -- filter length, should be of the form $4k+3$ (default 31)

The center tap is forced to 0.5. Even-indexed coefficients (except center) are forced to 0. These structural constraints are what make half-band filters efficient.

**Use when**: building multi-stage 2x decimation/interpolation chains. Three half-band stages for 8x is typically cheaper than a single filter for 8x.

---

### cic.js

Cascaded Integrator-Comb filter. Performs decimation using only additions and subtractions -- no multiplications. The transfer function of an $N$-stage CIC with decimation ratio $R$:

$$H(z) = \left(\frac{1 - z^{-R}}{1 - z^{-1}}\right)^N$$

The integrator stages run at the input rate (accumulate), the comb stages run at the output rate (difference). Output is normalized by $R^N$.

```js
import cic from 'digital-filter/multirate/cic.js'

let out = cic(data, 16, 3)   // decimate by 16, 3 stages
```

**API**: `cic(data, R, N?)` &rarr; `Float64Array` (new buffer, length = `floor(data.length / R)`)
- `data` -- input signal
- `R` -- decimation ratio
- `N` -- number of CIC stages (default 3). More stages = steeper rolloff but more passband droop.

**Use when**: high decimation ratios (8x, 16x, 64x) where multiplier cost matters. Common first stage in SDR (software-defined radio) receivers, sigma-delta ADC decimation chains.

**Avoid when**: you need flat passband -- CIC has significant droop ($\text{sinc}^N$ shape). Follow with a short compensating FIR if flatness matters.

---

### polyphase.js

Decomposes an FIR filter $h$ of length $L$ into $M$ polyphase sub-filters, each of length $\lceil L/M \rceil$. The $m$-th phase contains every $M$-th coefficient starting at index $m$:

$$E_m[k] = h[m + kM], \quad m = 0, \ldots, M-1$$

This is the foundation of efficient multirate filtering. By the Noble identities, filtering then downsampling by $M$ is equivalent to downsampling first, then filtering each phase separately -- reducing computation by factor $M$.

```js
import polyphase from 'digital-filter/multirate/polyphase.js'

let phases = polyphase(h, 4)   // Array of 4 Float64Arrays
```

**API**: `polyphase(h, M)` &rarr; `Array<Float64Array>`
- `h` -- FIR coefficients (`Float64Array`)
- `M` -- number of phases (= decimation/interpolation factor)

**Use when**: implementing efficient decimation or interpolation. Instead of filtering at the high rate and throwing away $M-1$ out of every $M$ outputs, compute only the outputs you keep.

---

### farrow.js

Fractional delay filter using Lagrange polynomial interpolation. The delay can be any real number -- not limited to integer samples. Computes the interpolated value by evaluating the Lagrange basis polynomials at the fractional offset.

For a delay of $D = D_{\text{int}} + \mu$ where $\mu \in [0, 1)$:

$$y[n] = \sum_{k=0}^{P} x[n - D_{\text{int}} - k + \lfloor P/2 \rfloor] \cdot \prod_{\substack{j=0 \\ j \neq k}}^{P} \frac{\mu - j + \lfloor P/2 \rfloor}{k - j}$$

```js
import farrow from 'digital-filter/multirate/farrow.js'

farrow(data, { delay: 3.7, order: 3 })   // in-place, 3.7-sample delay
```

**API**: `farrow(data, { delay?, order? })` &rarr; `data` (in-place)
- `delay` -- fractional delay in samples (default 0)
- `order` -- polynomial interpolation order (default 3). Higher = more accurate but wider kernel.

**Use when**: the delay changes per sample (pitch shifting, resampling with arbitrary ratio, time-varying delay lines). The Farrow structure allows changing $\mu$ without recomputing coefficients.

**Avoid when**: you need flat group delay across all frequencies -- polynomial interpolation has frequency-dependent error. Use Thiran for maximally flat delay.

---

### thiran.js

Thiran allpass fractional delay filter. Produces an IIR allpass filter with maximally flat group delay at DC. Unity magnitude at all frequencies -- only the phase is affected.

The coefficients are computed from the closed-form Thiran formula:

$$a_k = (-1)^k \binom{N}{k} \prod_{n=0}^{N} \frac{D - N + n}{D - N + k + n}$$

The numerator is the reverse of the denominator (allpass property): $b[k] = a[N-k]$.

```js
import thiran from 'digital-filter/multirate/thiran.js'

let { b, a } = thiran(3.7)        // delay = 3.7 samples, order auto = 4
let { b, a } = thiran(3.7, 3)     // force order 3
```

**API**: `thiran(delay, order?)` &rarr; `{ b: Float64Array, a: Float64Array }`
- `delay` -- fractional delay in samples
- `order` -- filter order (default `ceil(delay)`)

Returns allpass transfer function coefficients. Apply with a standard IIR filter.

**Use when**: you need constant delay across all frequencies and unity magnitude (no amplitude distortion). Delay lines in physical modeling synthesis, fractional-delay interpolation in audio effects.

**Avoid when**: the delay is less than $N - 0.5$ samples (Thiran becomes poorly conditioned for delays much smaller than the order).

---

### oversample.js

Upsample by an integer factor with anti-image filtering. Designed for oversampling before nonlinear processing (distortion, waveshaping, saturation) where aliased harmonics would fold back into the audible band.

```js
import oversample from 'digital-filter/multirate/oversample.js'

let up = oversample(data, 4)                      // 4x oversampling
let up2 = oversample(data, 4, { numtaps: 127 })   // sharper anti-image filter
```

**API**: `oversample(data, factor, opts?)` &rarr; `Float64Array` (new buffer, length = `N * factor`)
- `data` -- input signal
- `factor` -- oversampling factor (2, 4, 8, ...)
- `opts.numtaps` -- FIR filter length (default 63)

Uses Kaiser-windowed FIR with cutoff at $1/(2 \cdot \text{factor})$ of the new Nyquist.

**Use when**: applying nonlinear functions (tanh, clipping, waveshaping) that generate harmonics beyond Nyquist. Oversample, process, then decimate back.

## Concepts

### Noble identities

The key insight enabling efficient multirate processing. For a filter $H(z)$:

- **Decimation**: $H(z)$ followed by $\downarrow M$ = $\downarrow M$ followed by polyphase components of $H(z)$
- **Interpolation**: $\uparrow L$ followed by $H(z)$ = polyphase components of $H(z)$ followed by $\uparrow L$

This means the filter can operate at the *lower* rate, saving a factor of $M$ (or $L$) in computation.

### Polyphase decomposition

Any FIR filter $H(z)$ can be written as:

$$H(z) = \sum_{m=0}^{M-1} z^{-m} E_m(z^M)$$

Each $E_m$ operates on the decimated signal. For decimation, only one phase produces the output at each time step. For interpolation, each phase fills one of the $L$ output positions.

### Farrow vs Thiran

Both implement fractional delay. The tradeoff:

| | Farrow | Thiran |
|---|---|---|
| **Type** | FIR (polynomial) | IIR (allpass) |
| **Magnitude** | Not exactly flat | Exactly flat (unity) |
| **Group delay** | Approximate | Maximally flat at DC |
| **Variable delay** | Change $\mu$ per sample, no recomputation | Must recompute coefficients |
| **Cost** | $O(P)$ per sample | $O(N)$ per sample + state |
| **Best for** | Time-varying delays, resampling | Fixed fractional delays, physical models |
