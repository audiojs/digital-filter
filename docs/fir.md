# FIR Filters

Finite Impulse Response filters: the mathematically transparent workhorses of precision signal processing. Their output depends only on input samples — no feedback, no recursion, no stability concerns. Every FIR filter is a weighted sum (convolution) of the last N input samples. The weights *are* the impulse response.

![FIR Design Methods Compared](plots/fir-comparison.svg)

## How FIR filters work

Every FIR filter computes:

```
y[n] = h[0]·x[n] + h[1]·x[n-1] + h[2]·x[n-2] + ... + h[N-1]·x[n-N+1]
```

where `h` is the coefficient array (the impulse response) and `N` is the filter length (number of taps). This is direct convolution — the same operation as polynomial multiplication, correlation, and moving averages.

**Linear phase.** If the coefficients are symmetric (`h[k] = h[N-1-k]`), the filter has exactly linear phase — every frequency component is delayed by the same amount. No waveform distortion, no group delay variation. This is the killer feature of FIR filters and the reason they dominate offline processing, measurement, and applications where phase matters.

**Design methods.** Unlike IIR filters (which start from an analog prototype), FIR filters are designed directly in the digital domain. The question is always the same: given a desired frequency response, find the best set of N coefficients. The four design methods in this library represent four different definitions of "best":

| Method | Optimality criterion | Transition band | Stopband |
|---|---|---|---|
| `firwin` | Windowed ideal response | Wide | Depends on window |
| `firls` | Minimizes total squared error | Medium | Tapers smoothly |
| `remez` | Minimizes maximum error (equiripple) | Narrowest | Uniform ripple |
| `firwin2` | Frequency sampling with window | Wide | Depends on window |

**Cost.** FIR filters require N multiply-adds per sample. A 101-tap FIR lowpass costs 101 operations per sample. An equivalent 4th-order Butterworth IIR costs 20 operations (5 per biquad section × 4 sections). The FIR is 5× more expensive — but it has linear phase, guaranteed stability, and no numerical precision issues.

```js
import { firwin, convolution } from 'digital-filter'

let h = firwin(101, 1000, 44100)           // design: 101-tap lowpass at 1kHz
let filtered = convolution(signal, h)       // apply via convolution
```

For block-based FIR processing, use `convolution()`. For IIR-style streaming with SOS coefficients, use `filter()`. FIR coefficients can also be used directly with any convolution engine (Web Audio `ConvolverNode`, FFT-based overlap-add, etc.).

---

## Choosing a FIR design method

Start here. Answer these questions in order:

1. **Do you have a simple lowpass/highpass/bandpass/bandstop?** Use **firwin**. It is the fastest to set up, has only two parameters (length and cutoff), and the window method is well-understood.

2. **Do you need the sharpest possible transition for a given length?** Use **remez**. The Parks-McClellan algorithm produces the optimal equiripple filter — no other FIR of the same length has a narrower transition band for the same stopband attenuation.

3. **Do you need a smooth approximation to an arbitrary shape, minimizing overall error?** Use **firls**. It minimizes total squared error, which means the fit is best *on average* — no single frequency has the worst-case error, but the maximum error at any point is larger than remez.

4. **Do you need an arbitrary frequency response (not just pass/stop bands)?** Use **firwin2**. It accepts any set of frequency/gain pairs and interpolates between them.

5. **Do you need the filter length automatically?** Use **kaiserord** to compute the required number of taps and Kaiser beta from your specifications, then pass the result to `firwin`.

**Rule of thumb:** `firwin` for 80% of tasks. `remez` when transition width matters. `firls` when you care about average error. `firwin2` for exotic shapes.

---

## FIR vs IIR comparison

| | FIR | IIR |
|---|---|---|
| **Phase** | Linear (symmetric coefficients) | Nonlinear (always) |
| **Stability** | Always stable (no feedback) | Can be unstable if poles exit unit circle |
| **Latency** | (N-1)/2 samples (half the filter length) | Low (a few samples for order 4) |
| **Computation** | N multiplies per sample (expensive for sharp filters) | 5 multiplies per biquad section (cheap) |
| **Sharp cutoff** | Requires hundreds of taps | Order 4–8 is sufficient |
| **Numerical precision** | No issues (no feedback accumulation) | Requires SOS cascade for high orders |
| **Arbitrary response** | Easy (firwin2, remez) | Hard (yulewalk, but imprecise) |
| **Real-time parameter changes** | Requires crossfading coefficients | SVF handles smoothly |
| **Offline zero-phase** | Symmetric convolution (trivial) | `filtfilt` (forward + reverse IIR) |

**Use FIR when:** Phase linearity is required. Arbitrary frequency shapes are needed. Offline processing where latency does not matter. Guaranteed stability is essential. Coefficient precision matters (measurement, scientific).

**Use IIR when:** Low latency is critical. Computation budget is tight. Sharp cutoffs with minimal taps. Real-time parameter modulation. Classic filter shapes (Butterworth, Chebyshev) are acceptable.

---

## firwin — Window Method

### What it is

The simplest and most intuitive FIR design method. Start with the ideal (infinitely long) impulse response for the desired frequency shape, truncate it to N samples, and multiply by a window function to control the sidelobes. The window determines the tradeoff between transition width and stopband attenuation — a Hamming window gives -53 dB stopband; a Kaiser window lets you dial in any attenuation you want.

### When to use it

The default choice for standard lowpass/highpass/bandpass/bandstop filters. Quick prototyping. When you know the cutoff frequency and want a filter in one line. When the transition width is not critical (a few percent of the sample rate is acceptable).

### When NOT to use it

When you need the narrowest possible transition band for a given filter length (use `remez`). When you need an arbitrary frequency response shape (use `firwin2`). When you need optimal least-squares fit across the band (use `firls`).

### Origin

The window method is the oldest FIR design technique, dating to the 1940s–50s. The connection between windowing and spectral leakage was formalized by Blackman and Tukey (1958). Kaiser's window (1974) made the method practical by providing a single parameter that trades transition width for stopband depth.

### How it works

The ideal lowpass impulse response is the sinc function: `h_ideal[n] = sin(ωc·n) / (π·n)`, centered at n=0. This has infinite length and perfect brick-wall cutoff. Truncating it to N samples creates Gibbs phenomenon — 9% overshoot and slow-decaying sidelobes.

The window function suppresses these sidelobes. Each window offers a different tradeoff:
- Wider main lobe → wider transition band
- Lower sidelobes → deeper stopband attenuation

The windowed response is `h[n] = h_ideal[n] × w[n]`, then normalized for unity gain at DC (lowpass) or Nyquist (highpass).

### Key characteristics

- **Phase**: Exactly linear (symmetric coefficients).
- **Transition width**: Determined by window type and filter length. Roughly `4/N × fs` for Hamming, `8/N × fs` for Blackman.
- **Stopband attenuation**: Fixed by window choice. Hamming: -53 dB. Blackman: -74 dB. Kaiser: adjustable.
- **Passband ripple**: Very small. Hamming: 0.019 dB. Blackman: 0.0017 dB.
- **Computational cost**: N multiplies per sample.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `numtaps` | number | — | odd, ≥ 3 | Filter length (more taps = sharper transition) |
| `cutoff` | number or [number, number] | — | 0 < f < fs/2 | Cutoff frequency in Hz. Array for bandpass/bandstop. |
| `fs` | number | 44100 | > 0 | Sample rate in Hz |
| `opts.type` | string | `'lowpass'` | `'lowpass'`, `'highpass'`, `'bandpass'`, `'bandstop'` | Filter response type |
| `opts.window` | string or Float64Array | `'hamming'` | Any window name or custom array | Window function |

### Example

```js
import { firwin, convolution } from 'digital-filter'

// 101-tap lowpass at 4kHz, Hamming window (default)
let lp = firwin(101, 4000, 44100)
let out = convolution(signal, lp)

// 201-tap highpass at 500Hz, Kaiser window
import { kaiser } from 'digital-filter/window'
let hp = firwin(201, 500, 44100, { type: 'highpass', window: kaiser(201, 5.0) })

// 151-tap bandpass 300–3400Hz
let bp = firwin(151, [300, 3400], 44100, { type: 'bandpass' })
```

### Comparison

vs **remez**: Remez produces a sharper transition for the same number of taps (equiripple is optimal). The window method is simpler, faster to compute, and produces smoother stopband attenuation (monotonically decreasing sidelobes with most windows, vs uniform ripple with remez).

vs **firls**: firls minimizes total squared error — the average fit is better, but the peak error can be worse. firwin is simpler when standard shapes suffice.

vs **IIR (butterworth)**: A 101-tap firwin lowpass at 1 kHz has ~400 Hz transition width with -53 dB stopband (Hamming). A 4th-order Butterworth has a comparable transition but costs 20 operations per sample instead of 101. The FIR wins on phase linearity; the IIR wins on computation.

### References

- F.J. Harris, "On the Use of Windows for Harmonic Analysis with the Discrete Fourier Transform," *Proc. IEEE*, vol. 66, no. 1, pp. 51–83, 1978.
- J.F. Kaiser, "Nonrecursive Digital Filter Design Using the I₀-sinh Window Function," *Proc. IEEE Int. Symp. Circuits Syst.*, 1974.
- A.V. Oppenheim & R.W. Schafer, *Discrete-Time Signal Processing*, 3rd ed., Pearson, 2010, ch. 7.

---

## firls — Least-Squares Optimal

### What it is

Designs a linear-phase FIR filter that minimizes the total squared error between the actual and desired frequency response. The "desired" response is specified as a piecewise-linear function: you give frequency/gain pairs at band edges, and firls linearly interpolates between them. The result minimizes the integral of `|H(ω) - D(ω)|²` weighted across all specified bands.

### When to use it

When you want the best average fit to a desired response. Audio equalization curves where the ear averages errors (a large error at one frequency is worse than small errors everywhere). Approximating smooth target curves. When the maximum error at any single frequency matters less than the overall accuracy.

### When NOT to use it

When peak error matters — use `remez` (its equiripple design guarantees the smallest maximum error). When you have a simple lowpass/highpass and just want a quick result — use `firwin`. When the desired response has discontinuities and you want controlled transition behavior — use `remez`.

### Origin

The least-squares FIR design was formalized by Ivan Selesnick and C. Sidney Burrus in the 1990s, building on earlier work by Parks and Burrus (1987). The method solves a linear system `Q·a = d` where Q is a Gram matrix of cosine integrals and d is the cross-correlation with the desired response.

### How it works

The filter is expressed as a cosine series: `H(ω) = a[0] + 2·Σ a[k]·cos(kω)`. The problem reduces to minimizing:

```
∫ W(ω) · |Σ a[k]·cos(kω) - D(ω)|² dω
```

over all specified bands. Taking the derivative with respect to each `a[k]` and setting to zero gives a linear system. The matrix `Q` has entries that are integrals of `cos(iω)·cos(jω)` — computable in closed form. The vector `d` has entries that are integrals of `D(ω)·cos(kω)` — also closed form for piecewise-linear D(ω).

The system is solved via Gaussian elimination with partial pivoting. The result is the globally optimal least-squares solution — there is no iteration, no convergence issues.

### Key characteristics

- **Phase**: Exactly linear (symmetric coefficients).
- **Error distribution**: Concentrates at band edges and transition bands. Tapers smoothly in the stopband — sidelobes decrease away from the transition.
- **Transition width**: Wider than remez for the same number of taps (the least-squares criterion spreads error rather than equalizing it).
- **Passband/stopband**: Smooth, no ripple in the classical sense, but the error is not uniform.
- **Arbitrary shapes**: Supports piecewise-linear desired responses via the `bands`/`desired` interface.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `numtaps` | number | — | odd, ≥ 3 | Filter length |
| `bands` | Array | — | [0–1], pairs | Band edge frequencies as fractions of Nyquist. Must be in pairs: `[f1_start, f1_end, f2_start, f2_end, ...]` |
| `desired` | Array | — | ≥ 0 | Desired gain at each band edge (piecewise linear between pairs) |
| `weight` | Array | all 1s | > 0 per band | Weight per band. Higher weight = tighter fit in that band. |

### Example

```js
import { firls, convolution } from 'digital-filter'

// 51-tap lowpass: passband 0–0.3, stopband 0.4–1.0 (fractions of Nyquist)
let h = firls(51, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
let out = convolution(signal, h)

// Weight the stopband 10× more than passband
let strict = firls(51, [0, 0.3, 0.4, 1], [1, 1, 0, 0], [1, 10])

// Sloped passband (e.g., pre-emphasis)
let slope = firls(101, [0, 0.5, 0.6, 1], [0.5, 1.0, 0, 0])
```

### Comparison

vs **remez**: Remez minimizes the *peak* error (Chebyshev/minimax criterion). firls minimizes the *total* error (L² norm). For the same filter length, remez has a narrower transition band but uniform ripple; firls has a wider transition but smoother stopband. If you care about worst-case rejection at any single frequency, use remez. If you care about average performance, use firls.

vs **firwin**: firwin is a special case — the window method cannot optimize for arbitrary band specifications or weights. firls is more flexible and produces better results for non-standard shapes.

### References

- I. Selesnick & C.S. Burrus, "Exchange Algorithms for the Design of Linear Phase FIR Filters and Differentiators Having Flat Monotonic Passbands and Equiripple Stopbands," *IEEE Trans. CAS-II*, vol. 43, no. 9, 1996.
- T.W. Parks & C.S. Burrus, *Digital Filter Design*, Wiley, 1987.
- SciPy documentation, `scipy.signal.firls`.

---

## remez — Parks-McClellan Equiripple

### What it is

The gold standard of FIR filter design. The Parks-McClellan algorithm (based on the Remez exchange) designs the optimal equiripple filter: for a given filter length, band edges, and weights, it produces the filter with the smallest possible maximum error. The error oscillates at equal amplitude across each band (equiripple) — this is the Chebyshev criterion, and it is provably optimal. No other linear-phase FIR filter of the same length can achieve a smaller peak error.

### When to use it

When transition width is critical. Anti-aliasing filters where every Hz of transition band costs signal bandwidth. Channel selection filters in communications. Any application where you need the absolute sharpest cutoff for a given number of taps. The remez design is the FIR analog of the elliptic filter — it is optimal under the minimax criterion.

### When NOT to use it

When the sidelobes need to decrease away from the transition (use `firwin` with a good window — remez sidelobes are uniform). When you need the filter quickly and performance is not critical (remez is iterative and can be slow for very long filters). When the desired response is smooth and average error matters more than peak error (use `firls`).

### Origin

The algorithm was developed by James McClellan, Thomas Parks, and Lawrence Rabiner in 1973, adapting the Remez exchange algorithm (Evgeny Remez, 1934) for digital filter design. Their paper "A Computer Program for Designing Optimum FIR Linear Phase Digital Filters" is one of the most cited in DSP history.

### How it works

The Remez exchange is an iterative algorithm:

1. **Initialize** a set of extremal frequencies (where the error is expected to peak).
2. **Interpolate** the optimal response through these frequencies using barycentric Lagrange interpolation.
3. **Evaluate** the error across the entire frequency grid.
4. **Exchange** the extremal set — replace the current extremals with the frequencies where the actual error peaks.
5. **Repeat** until the extremal set stabilizes (the error is equiripple).

Convergence is guaranteed by the Chebyshev alternation theorem: the optimal minimax polynomial must have at least L+2 alternating extrema (where L is the number of cosine coefficients). The algorithm typically converges in 3–15 iterations.

### Key characteristics

- **Phase**: Exactly linear (symmetric coefficients).
- **Error distribution**: Equiripple — the error oscillates between +δ and -δ at equal amplitude across each band. This is the minimax-optimal distribution.
- **Transition width**: The narrowest possible for the given filter length and specifications. This is the defining advantage.
- **Passband ripple**: Uniform. For a 101-tap lowpass at 0.3 Nyquist with 10× stopband weight, the passband ripple is ~0.03 dB.
- **Stopband attenuation**: Uniform. The sidelobes do not decay — they oscillate at the same level across the entire stopband.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `numtaps` | number | — | odd, ≥ 3 | Filter length |
| `bands` | Array | — | [0–1], pairs | Band edge frequencies as fractions of Nyquist |
| `desired` | Array | — | ≥ 0 | Desired gain at each band edge |
| `weight` | Array | all 1s | > 0 per band | Relative importance of each band |
| `maxiter` | number | 40 | > 0 | Maximum Remez iterations |

### Example

```js
import { remez, convolution } from 'digital-filter'

// 51-tap equiripple lowpass: pass 0–0.3, stop 0.4–1.0
let h = remez(51, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
let out = convolution(signal, h)

// Weight stopband 10× (0.1 dB passband ripple, -40 dB stopband)
let strict = remez(51, [0, 0.3, 0.4, 1], [1, 1, 0, 0], [1, 10])

// Bandpass 0.2–0.4 Nyquist
let bp = remez(101, [0, 0.15, 0.2, 0.4, 0.45, 1], [0, 0, 1, 1, 0, 0])
```

### Comparison

vs **firwin**: firwin is simpler and faster, but the transition band is wider. A 51-tap remez lowpass at 0.3 Nyquist with 0.1 transition width achieves -40 dB stopband; a 51-tap firwin with Hamming window needs ~0.15 transition width for the same stopband depth.

vs **firls**: firls has lower total squared error but higher peak error. Remez has higher total error but the lowest peak error. If you need guaranteed worst-case rejection (e.g., -60 dB at every frequency in the stopband), remez is correct.

vs **IIR (elliptic)**: An elliptic IIR achieves comparable selectivity with far fewer coefficients, but has nonlinear phase. Remez is the FIR answer to "how sharp can I get with linear phase?"

### References

- J.H. McClellan, T.W. Parks, & L.R. Rabiner, "A Computer Program for Designing Optimum FIR Linear Phase Digital Filters," *IEEE Trans. Audio Electroacoust.*, AU-21, pp. 506–526, 1973.
- E.Y. Remez, "Sur la détermination des polynômes d'approximation de degré donnée," *Comm. Soc. Math. Kharkov*, vol. 10, 1934.
- T.W. Parks & J.H. McClellan, "Chebyshev Approximation for Nonrecursive Digital Filters with Linear Phase," *IEEE Trans. Circuit Theory*, CT-19, pp. 189–194, 1972.

---

## firwin2 — Arbitrary Frequency Response

### What it is

Designs a linear-phase FIR filter with an arbitrary magnitude response specified as frequency/gain pairs. You draw the desired curve by providing a set of (frequency, gain) breakpoints, and firwin2 interpolates between them, applies an inverse DFT to get the impulse response, and windows the result. This is the frequency-sampling method — the FIR equivalent of "draw the EQ curve you want."

### When to use it

When the desired response cannot be described as simple pass/stop bands. Custom equalization curves. Matching a measured frequency response. Arbitrary magnitude shaping (e.g., pink noise weighting, hearing aid compensation, room correction). Any shape that is easier to specify as a list of (frequency, gain) points than as band edges.

### When NOT to use it

When you have a standard lowpass/highpass/bandpass/bandstop — use `firwin` (simpler) or `remez` (sharper). When you need the tightest possible fit — the frequency sampling method is not optimal in any formal sense; use `remez` with a multiband specification for critical applications.

### Origin

The frequency sampling method was developed in the 1970s alongside the FFT revolution. It appears in Rabiner and Gold, *Theory and Application of Digital Signal Processing* (1975), as a direct application of the DFT/IDFT pair to filter design.

### How it works

1. Specify the desired magnitude as a set of (frequency, gain) breakpoints. Frequencies are normalized to [0, 1] where 1 = Nyquist.
2. Interpolate these breakpoints onto a dense frequency grid (default 1024 points).
3. Create a conjugate-symmetric spectrum (so the impulse response is real).
4. Inverse DFT to time domain.
5. Circular-shift to center the response, truncate to the desired length.
6. Apply a window function to control sidelobes.

The accuracy depends on the FFT size (the `nfft` parameter). For filters with sharp transitions, increase `nfft` above the default 1024.

### Key characteristics

- **Phase**: Exactly linear (after windowing and centering).
- **Frequency resolution**: Limited by `nfft`. Sharp transitions may be smoothed.
- **Stopband**: Determined by the window function, same as `firwin`.
- **Flexibility**: Any piecewise-linear magnitude response.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `numtaps` | number | — | odd, ≥ 3 | Filter length |
| `freq` | Array | — | [0, ..., 1] | Normalized frequency breakpoints. Must start at 0 and end at 1. |
| `gain` | Array | — | ≥ 0 | Desired gain at each frequency point |
| `opts.window` | string | `'hamming'` | Any window name | Window function |
| `opts.nfft` | number | 1024 | ≥ numtaps | FFT size for interpolation |

### Example

```js
import { firwin2, convolution } from 'digital-filter'

// Custom bandpass: ramp up from 0.1 to 0.2, flat 0.2–0.4, ramp down to 0.5
let h = firwin2(201, [0, 0.1, 0.2, 0.4, 0.5, 1], [0, 0, 1, 1, 0, 0])
let out = convolution(signal, h)

// Pink noise filter: -3 dB/octave slope
let pink = firwin2(101, [0, 0.01, 0.1, 0.5, 1], [1, 1, 0.316, 0.141, 0.1])
```

### Comparison

vs **firwin**: firwin is limited to standard shapes (lowpass, highpass, bandpass, bandstop). firwin2 accepts any piecewise-linear shape.

vs **remez**: remez is optimal for the minimax criterion and supports arbitrary multiband specifications. firwin2 is simpler to use (just draw the curve) but not optimal in any formal sense. For critical applications where the fit must be as tight as possible, express the spec as remez bands.

vs **firls**: firls supports piecewise-linear desired responses too, with optimal least-squares fit. firls is mathematically superior for smooth targets. firwin2 is more intuitive (specify frequency/gain directly rather than band edges with interpolated gains).

### References

- L.R. Rabiner & B. Gold, *Theory and Application of Digital Signal Processing*, Prentice-Hall, 1975.
- SciPy documentation, `scipy.signal.firwin2`.

---

## hilbert — 90° Phase Shift

### What it is

An FIR approximation to the Hilbert transform — a filter that shifts every frequency component by exactly 90° while preserving the magnitude. The ideal Hilbert transformer has impulse response `h[n] = 2/(πn)` for odd n and 0 for even n. It is the key building block for analytic signal generation, single-sideband modulation, and envelope detection.

### When to use it

Computing the analytic signal `x_a[n] = x[n] + j·H{x[n]}` for envelope extraction or instantaneous frequency estimation. Single-sideband (SSB) modulation in communications. Phase-shifting networks for quadrature processing. Audio effects that require a 90° phase relationship (e.g., dome tweeters, stereo widening via mid-side with phase offset).

### When NOT to use it

When you only need the envelope — a simpler approach is `envelope()` (rectify + lowpass). When latency is critical — the FIR Hilbert transformer introduces (N-1)/2 samples of delay. When you need a wideband phase shift extending to DC — the Hilbert transform cannot operate at DC or Nyquist (it is zero at both).

### Origin

David Hilbert formalized the transform in the early 20th century. The FIR approximation via windowed truncation became standard practice with the advent of digital signal processing in the 1960s–70s.

### How it works

The ideal Hilbert transform has transfer function `H(ω) = -j·sign(ω)` — it multiplies positive frequencies by -j (90° lag) and negative frequencies by +j (90° lead). The impulse response is `h[n] = 2/(πn)` for odd n, 0 for even n — an antisymmetric type III FIR. This is truncated to N samples and windowed (default: Hamming) to control the Gibbs ripple.

The output is purely imaginary in the analytic signal sense. To form the analytic signal, delay the original by (N-1)/2 samples and use it as the real part, with the Hilbert-filtered signal as the imaginary part.

### Key characteristics

- **Phase shift**: 90° across the passband (roughly 0.05–0.95 × Nyquist for practical filter lengths).
- **Magnitude**: Unity (within the passband).
- **At DC and Nyquist**: Gain is zero. The Hilbert transform is undefined at these points.
- **Antisymmetric**: Odd-symmetric coefficients (type III or type IV FIR).
- **Latency**: (N-1)/2 samples.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `N` | number | — | odd, ≥ 3 | Filter length. Longer = better low-frequency accuracy. |
| `opts.window` | Float64Array or function | Hamming | — | Window function applied to ideal response |

### Example

```js
import { hilbert, convolution } from 'digital-filter'

// 65-tap Hilbert transformer
let h = hilbert(65)

// Compute analytic signal envelope
let imag = convolution(signal, h)
let delay = (65 - 1) / 2
let envelope = new Float64Array(signal.length)
for (let i = delay; i < signal.length; i++) {
  let re = signal[i - delay], im = imag[i]
  envelope[i] = Math.sqrt(re * re + im * im)
}
```

### Comparison

vs **FFT-based Hilbert**: The FFT method (zero negative frequencies, IFFT) is exact for a given block but requires block processing. The FIR method is causal and streamable.

vs **Allpass phase shifter**: An IIR allpass network can approximate 90° over a limited band with much less latency, but the phase accuracy is not as uniform.

### References

- S.L. Hahn, *Hilbert Transforms in Signal Processing*, Artech House, 1996.
- A.V. Oppenheim & R.W. Schafer, *Discrete-Time Signal Processing*, 3rd ed., Pearson, 2010, sec. 12.3.

---

## differentiator — FIR Derivative

### What it is

An FIR filter that approximates the ideal differentiator — a system whose frequency response is `H(ω) = jω`. Convolution with this filter computes the discrete derivative of the input signal. The ideal impulse response is `h[n] = (-1)^n / n` for n ≠ 0, which is antisymmetric (type III FIR). It is windowed and optionally scaled by the sample rate to give the derivative in physical units.

### When to use it

Estimating the rate of change of a signal: velocity from position, acceleration from velocity. Edge detection in 1D signals. Computing the derivative of a smooth signal with better noise immunity than a simple first difference `y[n] = x[n] - x[n-1]` (the FIR differentiator averages over more samples, suppressing high-frequency noise).

### When NOT to use it

When you need the derivative at DC (the differentiator has zero gain at DC — by definition). When the signal is noisy and you need smoothing + differentiation simultaneously — use `savitzkyGolay` with `derivative: 1`, which fits a polynomial and differentiates it analytically. When latency matters and a simple first difference suffices.

### Origin

FIR differentiator design follows directly from the theory of type III linear-phase FIR filters. The antisymmetric constraint forces zeros at DC and Nyquist, matching the ideal differentiator's behavior. Practical design is covered by Rabiner and Schafer (1978).

### How it works

The ideal differentiator has impulse response `h[n] = cos(πn)/n = (-1)^n/n` for n ≠ 0, and h[0] = 0. This is the inverse Fourier transform of `jω`. Truncation to N taps and windowing (default: Hamming) produces a practical filter. If `opts.fs` is provided, coefficients are multiplied by `fs` so the output is in units per second.

### Key characteristics

- **Frequency response**: Approximately linear from 0 to ~0.8 × Nyquist (gain proportional to frequency).
- **At DC**: Zero gain (derivative of a constant is zero).
- **At Nyquist**: Zero gain (type III FIR has a zero at Nyquist).
- **Phase**: 90° lead (the derivative introduces a quarter-cycle advance).
- **Noise amplification**: The differentiator amplifies high-frequency noise. Use a longer filter (more averaging) or combine with lowpass filtering.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `N` | number | — | odd, ≥ 3 | Filter length. Longer = more accurate at low frequencies, more noise suppression. |
| `opts.window` | string | `'hamming'` | Any window name | Window function |
| `opts.fs` | number | — | > 0 | If provided, scales coefficients by sample rate for physical units |

### Example

```js
import { differentiator, convolution } from 'digital-filter'

// 31-tap differentiator, scaled to samples/second
let h = differentiator(31, { fs: 44100 })
let derivative = convolution(signal, h)

// Unscaled (output in samples, not seconds)
let h2 = differentiator(31)
```

### Comparison

vs **First difference** `y[n] = x[n] - x[n-1]`: The first difference is a 2-tap differentiator with terrible frequency response (gain rolls off above 0.5 × Nyquist). The FIR differentiator is accurate up to ~0.8 × Nyquist for N ≥ 15.

vs **Savitzky-Golay derivative**: SG fits a polynomial locally and differentiates analytically. It inherently smooths (lowpass + differentiate in one step). Use SG when the signal is noisy and you want smoothing bundled in; use the FIR differentiator when you want a clean derivative without implicit smoothing.

### References

- L.R. Rabiner & R.W. Schafer, *Digital Processing of Speech Signals*, Prentice-Hall, 1978.
- B. Kumar & S.C. Dutta Roy, "Design of Efficient FIR Digital Differentiators and Hilbert Transformers," *IEE Proc.*, vol. 136, pt. G, 1989.

---

## raisedCosine — Pulse Shaping

### What it is

The raised cosine (RC) and root-raised cosine (RRC) filters are pulse-shaping filters used in digital communications. They eliminate inter-symbol interference (ISI) at the sampling instants while confining the signal bandwidth. The raised cosine satisfies the Nyquist ISI criterion: it is zero at every integer multiple of the symbol period except the center. The root-raised cosine is designed so that two cascaded RRC filters (one at transmitter, one at receiver) produce a raised cosine — this splits the ISI-free filtering between both ends.

### When to use it

Digital communications: shaping transmitted pulses so they do not interfere with adjacent symbols. QAM, PSK, OFDM, and virtually every modern digital modulation scheme uses RRC at both transmitter and receiver. Software-defined radio (SDR). Baseband signal processing.

### When NOT to use it

Audio filtering (the raised cosine is designed for symbol-rate processing, not frequency-selective filtering). General-purpose lowpass/highpass/bandpass (use `firwin` or `remez`).

### Origin

The Nyquist ISI criterion was established by Harry Nyquist in 1928. The raised cosine pulse shape, which satisfies this criterion with a tunable excess bandwidth, became standard in telecommunications by the 1960s.

### How it works

The raised cosine pulse is defined by two parameters:

- **β (roll-off factor)**: 0 to 1. At β=0, the pulse is a sinc function (minimum bandwidth, maximum ISI sensitivity). At β=1, the pulse has twice the minimum bandwidth but the smoothest time-domain decay (most ISI tolerance). Common values: 0.25–0.5.
- **sps (samples per symbol)**: How many samples represent one symbol period. Common values: 4, 8, 16.

The impulse response of the raised cosine is:

```
h(t) = sinc(t/T) · cos(πβt/T) / (1 - (2βt/T)²)
```

where T is the symbol period. The root-raised cosine (`opts.root = true`) has a frequency response that is the square root of the raised cosine — its convolution with itself yields the full raised cosine.

Energy normalization is applied so the filter has unit energy regardless of length and parameters.

### Key characteristics

- **ISI-free**: The raised cosine is zero at all integer symbol times except t=0.
- **Bandwidth**: Minimum bandwidth = 1/(2T) Hz. Actual bandwidth = (1+β)/(2T) Hz.
- **Roll-off β=0**: Maximum spectral efficiency, slowest time-domain decay, most sensitive to timing errors.
- **Roll-off β=1**: Double the bandwidth, fastest decay, most robust to timing.
- **Root variant**: RRC at TX + RRC at RX = RC end-to-end. The RRC itself does *not* satisfy the Nyquist criterion — only the cascade does.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `N` | number | — | odd, ≥ 3 | Filter length |
| `beta` | number | 0.35 | 0–1 | Roll-off factor. 0 = sinc, 1 = widest. |
| `sps` | number | 4 | ≥ 2 | Samples per symbol |
| `opts.root` | boolean | false | — | If true, design root-raised cosine instead of raised cosine |

### Example

```js
import { raisedCosine, convolution } from 'digital-filter'

// Root-raised cosine: 65 taps, β=0.35, 4 samples/symbol
let rrc = raisedCosine(65, 0.35, 4, { root: true })

// Apply at transmitter
let shaped = convolution(symbols, rrc)

// Apply at receiver (matched filter = same RRC)
let received = convolution(channelOutput, rrc)
```

### Comparison

vs **Gaussian pulse**: Gaussian pulses (GSM, Bluetooth) have no ISI-free property but produce a more compact spectrum. Use Gaussian when spectral compactness matters more than ISI freedom.

vs **Sinc pulse**: The sinc (β=0 raised cosine) has minimum bandwidth but infinite-duration sidelobes that decay as 1/t. Any raised cosine with β>0 trades bandwidth for faster decay.

### References

- H. Nyquist, "Certain Topics in Telegraph Transmission Theory," *Trans. AIEE*, vol. 47, pp. 617–644, 1928.
- J.G. Proakis & M. Salehi, *Digital Communications*, 5th ed., McGraw-Hill, 2008, ch. 9.

---

## savitzkyGolay — Polynomial Smoothing

### What it is

A Savitzky-Golay filter fits a polynomial of degree p to a sliding window of m samples, then evaluates the polynomial at the center point. This is equivalent to convolving with a set of fixed FIR coefficients — but unlike a simple moving average (polynomial degree 0), it preserves the shape of peaks, edges, and higher-order features. It can also compute derivatives by evaluating the polynomial's derivative instead of its value.

### When to use it

Smoothing spectroscopic data, chromatography peaks, sensor data — anywhere you need to reduce noise while preserving peak heights and widths. Computing smooth derivatives of noisy data (set `derivative: 1` for first derivative, `2` for second). The SG filter is the standard in analytical chemistry and instrumentation.

### When NOT to use it

When you need frequency-selective filtering (the SG filter has a poorly controlled frequency response — it is designed in the time domain, not the frequency domain). When the data has sharp discontinuities (the polynomial fit will overshoot). When you need a causal (online) filter — the SG filter is centered and non-causal.

### Origin

Abraham Savitzky and Marcel Golay, "Smoothing and Differentiation of Data by Simplified Least Squares Procedures," *Analytical Chemistry*, vol. 36, no. 8, pp. 1627–1639, 1964. One of the most cited papers in analytical chemistry.

### How it works

For a window of m points centered at x[i], fit the polynomial `p(x) = a₀ + a₁x + a₂x² + ... + aₚxᵖ` by least squares. The smoothed value is `a₀` (the constant term). The first derivative is `a₁`. The second derivative is `2·a₂`.

The coefficients that extract `aₖ` from the windowed data are fixed for a given window size and polynomial degree — they are computed once via `(JᵀJ)⁻¹Jᵀ` where J is the Vandermonde matrix. After that, the filter is a standard FIR convolution.

**Key insight:** The Savitzky-Golay filter preserves moments of the signal up to degree p. A degree-2 SG filter preserves the area, centroid, and width of a peak. A moving average (degree 0) only preserves area.

### Key characteristics

- **Smoothing**: Reduces noise while preserving peak shape (for appropriate window/degree).
- **Derivatives**: Computes smooth kth derivative by extracting the kth polynomial coefficient.
- **Frequency response**: Lowpass-like but with irregular sidelobes. Not optimized in the frequency domain.
- **Edge handling**: Clamped (edge samples are repeated). This introduces some distortion at the boundaries.
- **In-place**: Operates on the input array directly.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `data` | Float64Array | — | — | Input signal (modified in-place) |
| `params.windowSize` | number | 5 | odd, ≥ 3 | Sliding window width. Larger = more smoothing. |
| `params.degree` | number | 2 | 0–windowSize-1 | Polynomial degree. Higher = preserves more shape. |
| `params.derivative` | number | 0 | 0, 1, 2, ... | Which derivative to compute. 0 = smoothing. |

### Example

```js
import { savitzkyGolay } from 'digital-filter'

// Smooth noisy data: window=11, quadratic polynomial
let params = { windowSize: 11, degree: 2 }
savitzkyGolay(data, params)

// Compute smooth first derivative
let deriv = { windowSize: 11, degree: 3, derivative: 1 }
savitzkyGolay(data, deriv)

// Heavy smoothing: wide window, low degree
let heavy = { windowSize: 25, degree: 2 }
savitzkyGolay(data, heavy)
```

### Comparison

vs **Moving average**: The moving average is a degree-0 SG filter. It smooths aggressively but flattens peaks and broadens edges. SG with degree ≥ 2 preserves peak height and width while still reducing noise.

vs **FIR lowpass (firwin)**: The FIR lowpass is designed in the frequency domain and has a well-controlled frequency response. The SG filter is designed in the time domain and preserves polynomial features. Use FIR lowpass for frequency separation; use SG for peak-preserving smoothing.

vs **Gaussian smoothing**: Gaussian smoothing (convolution with a Gaussian kernel) is similar in character to degree-0 SG but with a smoother impulse response. SG with degree ≥ 2 is superior for preserving peak shapes.

### References

- A. Savitzky & M.J.E. Golay, "Smoothing and Differentiation of Data by Simplified Least Squares Procedures," *Anal. Chem.*, vol. 36, no. 8, pp. 1627–1639, 1964.
- R.W. Schafer, "What Is a Savitzky-Golay Filter?", *IEEE Signal Processing Magazine*, vol. 28, no. 4, pp. 111–117, 2011.

---

## minimumPhase — Linear to Minimum-Phase Conversion

### What it is

Converts a linear-phase FIR filter to a minimum-phase FIR filter with the same magnitude response. The minimum-phase version concentrates all its energy at the beginning of the impulse response, reducing the effective latency from (N-1)/2 samples to near zero. The magnitude spectrum is preserved exactly; the phase is changed to the minimum possible for that magnitude.

### When to use it

When you have a linear-phase FIR design (from `firwin`, `remez`, etc.) but cannot tolerate the (N-1)/2 sample latency. Real-time audio effects where the filter must respond immediately. Minimum-phase systems are causal and have the shortest possible group delay for a given magnitude response.

### When NOT to use it

When linear phase is required (minimum phase is nonlinear by definition). When the exact phase response matters (minimum phase is uniquely determined by the magnitude — you cannot choose it independently). When the original filter has very sharp nulls in its magnitude response (the cepstral method takes the log, so deep nulls cause numerical issues).

### Origin

The minimum-phase property was characterized by Bode in the 1940s for control theory. The cepstral method for computing minimum-phase signals was developed by Oppenheim and Schafer in the 1960s–70s, using the "complex cepstrum" — a concept closely related to the Hilbert transform applied to the log-magnitude spectrum.

### How it works

The algorithm uses the cepstral method:

1. Compute the magnitude spectrum `|H(ω)|` of the input FIR via DFT.
2. Take the log: `log|H(ω)|` — this is the log-magnitude spectrum.
3. Inverse DFT to get the real cepstrum.
4. Fold the cepstrum: keep n=0 unchanged, double n=1..N/2-1, zero n=N/2+1..N-1. This is equivalent to keeping only the causal part — the same operation as the Hilbert transform on the log-magnitude, which recovers the minimum-phase component.
5. DFT the folded cepstrum, exponentiate to get the minimum-phase spectrum.
6. Inverse DFT to get the minimum-phase impulse response.

The magnitude is preserved because `exp(log|H|) = |H|`. The phase is the minimum-phase corresponding to that magnitude — it is the unique causal, stable phase that a system with that magnitude response can have.

### Key characteristics

- **Magnitude**: Identical to the input FIR.
- **Phase**: Minimum-phase (nonlinear). Group delay is concentrated at low frequencies.
- **Latency**: Near zero (energy concentrated at the start of the impulse response).
- **Causality**: The output is causal — no pre-ringing.
- **Length**: Same as the input FIR.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `h` | Float64Array | — | — | Input linear-phase FIR coefficients |

Returns a Float64Array of the same length — the minimum-phase version.

### Example

```js
import { firwin, minimumPhase, convolution } from 'digital-filter'

// Design a linear-phase lowpass
let linear = firwin(101, 4000, 44100)

// Convert to minimum phase — same magnitude, ~zero latency
let minph = minimumPhase(linear)

let out = convolution(signal, minph)
```

### Comparison

vs **Linear-phase original**: Same magnitude. Linear phase has (N-1)/2 = 50 samples latency but zero phase distortion. Minimum phase has ~0 latency but nonlinear phase (frequency-dependent group delay).

vs **IIR filter**: An IIR filter is inherently minimum-phase (for all-pole designs). The minimumPhase conversion gives you the FIR equivalent — same fast response, but with the benefits of FIR (no feedback, no stability issues, exact magnitude control).

### References

- A.V. Oppenheim & R.W. Schafer, *Discrete-Time Signal Processing*, 3rd ed., Pearson, 2010, sec. 5.7 (Minimum-Phase Systems and the Complex Cepstrum).
- J.O. Smith III, *Introduction to Digital Filters*, W3K Publishing, 2007, sec. 8.7.

---

## matchedFilter — Maximum SNR Detection

### What it is

A matched filter is the time-reversed, energy-normalized version of a known signal template. Convolving the received signal with the matched filter maximizes the signal-to-noise ratio (SNR) at the output — this is the optimal detector for a known signal in white Gaussian noise. The output peaks exactly when the template aligns with the signal.

### When to use it

Radar pulse detection (the classic application). Sonar ping detection. Template matching in communications (correlating with known preambles or synchronization sequences). Detecting a known waveform buried in noise. Trigger detection in measurement systems.

### When NOT to use it

When the noise is not white (colored noise requires a pre-whitening step before matched filtering). When the template is not known precisely (use adaptive filters instead). When you want frequency-selective filtering rather than template matching (use `firwin`, `remez`, etc.).

### Origin

The matched filter was derived independently by D.O. North (1943, classified until 1963) and by Turin (1960) from the Schwarz inequality. It is the foundation of radar signal processing and detection theory.

### How it works

Given a template signal `s[n]` of length N, the matched filter is:

```
h[n] = s[N - 1 - n] / E
```

where `E = Σ s[n]²` is the template energy. The time reversal makes convolution equivalent to cross-correlation. The energy normalization ensures the peak output equals 1 when the input matches the template perfectly.

The output SNR at the peak is `2E/N₀` where N₀ is the noise spectral density — this is the maximum achievable SNR for any linear filter, by the Schwarz inequality.

### Key characteristics

- **Optimal**: Maximizes output SNR for known signal in white Gaussian noise.
- **Peak location**: Output peaks at the time when the template aligns with the signal, with a delay of N-1 samples.
- **Peak value**: Normalized to 1.0 for a perfect match (input = template).
- **Computational cost**: N multiplies per sample (same as any FIR of length N).

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `template` | Float64Array or Array | — | — | Known signal to detect |

Returns a Float64Array — the matched filter coefficients (time-reversed, energy-normalized template).

### Example

```js
import { matchedFilter, convolution } from 'digital-filter'

// Known chirp pulse (e.g., radar)
let chirp = new Float64Array(64)
for (let i = 0; i < 64; i++) chirp[i] = Math.sin(2 * Math.PI * (100 + 50 * i / 64) * i / 44100)

// Create matched filter
let mf = matchedFilter(chirp)

// Apply to received signal — peak indicates detection
let correlation = convolution(received, mf)
let peakIdx = correlation.indexOf(Math.max(...correlation))
```

### Comparison

vs **Cross-correlation**: The matched filter *is* normalized cross-correlation implemented as convolution. Using `convolution(signal, matchedFilter(template))` is equivalent to computing the normalized cross-correlation.

vs **Energy detector**: An energy detector (square + integrate) detects *any* signal above a threshold. A matched filter detects only the specific template, rejecting everything else. The matched filter has ~5 dB better sensitivity for known signals.

### References

- D.O. North, "An Analysis of the Factors which Determine Signal/Noise Discrimination in Pulsed Carrier Systems," *Proc. IEEE*, vol. 51, no. 7, pp. 1016–1027, 1963 (original 1943 classified report).
- G.L. Turin, "An Introduction to Matched Filters," *IRE Trans. Inform. Theory*, vol. IT-6, pp. 311–329, 1960.
- H.L. Van Trees, *Detection, Estimation, and Modulation Theory*, Part I, Wiley, 1968.

---

## Window function selection guide

FIR filters designed with `firwin` and `firwin2` depend critically on the window function. The window controls the tradeoff between transition width and stopband depth. This library uses the [`window-function`](https://github.com/nicholasjpaterno/window-function) package, which provides 30+ windows.

### Quick selection

| Window | Sidelobe level | Main lobe width | Best for |
|---|---|---|---|
| **Rectangular** | -13 dB | Narrowest | Analysis only (never for filter design) |
| **Hamming** | -43 dB | 8π/N | Default choice. Good general-purpose tradeoff. |
| **Hann** | -32 dB | 8π/N | Spectral analysis. Slightly wider lobes than Hamming but lower sidelobes far from main lobe. |
| **Blackman** | -58 dB | 12π/N | When you need deeper stopband without Kaiser tuning. |
| **Kaiser (β=5)** | -37 dB | Adjustable | The adjustable window. β controls the sidelobe/width tradeoff. |
| **Kaiser (β=8)** | -65 dB | Adjustable | Deep stopband with Kaiser. |
| **Kaiser (β=11)** | -90 dB | Adjustable | Very deep stopband. |
| **Dolph-Chebyshev** | Equiripple | Adjustable | When you want uniform sidelobes (the window analog of remez). |
| **Flat-top** | -93 dB | 22π/N | Amplitude-accurate spectral analysis. Too wide for filter design. |

### Kaiser: the universal window

For most FIR design tasks, the Kaiser window with `kaiserord` is the practical choice. Given your desired transition width and stopband attenuation, `kaiserord` computes the required filter length N and Kaiser β:

```js
import { kaiserord, firwin } from 'digital-filter'
import { kaiser } from 'digital-filter/window'

// "I need 60 dB stopband with a 0.1-Nyquist transition band"
let { numtaps, beta } = kaiserord(0.1, 60)  // → numtaps=73, beta=5.65
let h = firwin(numtaps, 2000, 44100, { window: kaiser(numtaps, beta) })
```

### When the window matters

- **Hamming** is the default because it is a good general tradeoff and avoids the -13 dB sidelobes of rectangular truncation without excessive main lobe widening.
- **Kaiser** when you need a specific stopband depth. Use `kaiserord` to compute parameters automatically.
- **Dolph-Chebyshev** when you want the narrowest main lobe for a given sidelobe level (it is the optimal window in the Chebyshev sense).
- **Blackman** when you want deeper sidelobes than Hamming without tuning Kaiser parameters.

For the full list of available windows and their mathematical definitions, see the [window-function](https://github.com/nicholasjpaterno/window-function) package documentation.
