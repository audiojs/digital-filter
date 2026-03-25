# digital-filter — complete DSP filter collection

> API: `fn(data, params)` — in-place, returns data. Coefficients: `fn(fc, Q, fs)` → `{b0,b1,b2,a1,a2}` or SOS[].
> CommonJS, `'use strict'`, pure functions, plain args, no classes. Zero dependencies.

## Done (22 modules, 116 tests)

- [x] `biquad.js` — 9 RBJ Cookbook types (LP/HP/BP/BP2/notch/AP/peaking/lowshelf/highshelf)
- [x] `filter.js` — SOS cascade processor, Direct Form II Transposed
- [x] `freqz.js` — frequency response analysis + mag2db
- [x] `transform.js` — analog→digital pipeline (prototype → analog transform → bilinear → SOS)
- [x] `butterworth.js` — Nth-order, LP/HP/BP/BS via transform
- [x] `chebyshev.js` — Type I, LP/HP/BP/BS via transform
- [x] `bessel.js` — orders 1-10, LP/HP/BP/BS via transform
- [x] `svf.js` — Cytomic trapezoidal, 6 output types
- [x] `linkwitz-riley.js` — LR2/LR4/LR8 crossover → {low, high}
- [x] `savitzky-golay.js` — polynomial smoothing/differentiation FIR
- [x] `dc-blocker.js`, `one-pole.js`, `leaky-integrator.js`, `moving-average.js`
- [x] `comb.js` — feedforward + feedback
- [x] `allpass.js` — 1st + 2nd order
- [x] `a-weighting.js`, `c-weighting.js`, `k-weighting.js`, `itu468.js`, `riaa.js`

---

## IIR Filter Design

### Classic prototypes (via transform pipeline)
- [ ] `elliptic.js` — Cauer, sharpest transition. Jacobi elliptic functions.
- [ ] `chebyshev2.js` — Type II / inverse Chebyshev. Flat passband, stopband ripple. Finite zeros.
- [ ] `legendre.js` — Papoulis. Optimal monotonic (steepest without ripple). Custom polynomials.
- [ ] `gaussian.js` — Self-similar under Fourier. Deriche/Young-van Vliet IIR approximation.

### Specialized IIR
- [ ] `resonator.js` — Constant-peak-gain resonator. Modal/formant synthesis (distinct from peaking EQ).
- [ ] `pre-emphasis.js` — `H(z) = 1 - αz^-1`. Speech/audio canonical. De-emphasis inverse.
- [ ] `iir-comb.js` — IIR notch/peak comb via `iirnotch`/`iirpeak` (scipy-style convenience).

### Virtual analog / synthesis
- [ ] `moog-ladder.js` — 4-pole transistor ladder with resonance. Zavalishin ZDF approach.
- [ ] `diode-ladder.js` — TB-303 style. Less bass loss, brighter character.
- [ ] `korg35.js` — MS-20 style. Nonlinear feedback.

### IIR utilities
- [ ] `yulewalk.js` — IIR design from arbitrary frequency response (Yule-Walker method).
- [ ] `iirdesign.js` — Auto-order IIR from passband/stopband specs (picks best type+order).

---

## FIR Filter Design (biggest gap)

### Core design methods
- [ ] `firwin.js` — Window-method FIR (LP/HP/BP/BS from cutoffs + window). The `fir1` equivalent.
- [ ] `firwin2.js` — Arbitrary frequency-response FIR via frequency sampling. The `fir2` equivalent.
- [ ] `firls.js` — Least-squares optimal linear-phase FIR.
- [ ] `remez.js` — Parks-McClellan equiripple FIR (minimax optimal). Gold standard.

### FIR utilities
- [ ] `minimum-phase.js` — Convert linear-phase FIR to minimum-phase (halves group delay).
- [ ] `kaiserord.js` — Estimate FIR order + Kaiser β from specs (helper for firwin).

### Specialized FIR
- [ ] `hilbert.js` — 90° phase shift. Analytic signal, envelope detection, SSB.
- [ ] `differentiator.js` — FIR derivative approximation. Edge detection, velocity.
- [ ] `integrator.js` — FIR cumulative sum (trapezoidal, Simpson variants).
- [ ] `raised-cosine.js` — Pulse shaping for communications (RC + root-RC). Roll-off parameter α.
- [ ] `gaussian-fir.js` — Gaussian pulse shaping FIR (GMSK, smoothing).
- [ ] `matched-filter.js` — Time-reversed conjugate template. Maximizes output SNR.
- [ ] `median.js` — Nonlinear median filter. Impulse noise removal, edge preservation.

### Window functions
- [ ] `window.js` — re-export/extend from `window-function` package, or inline:
  - Essential: hann, hamming, blackman, kaiser
  - Useful: blackman-harris, flat-top, nuttall, tukey, gaussian
  - Niche: DPSS/Slepian, Dolph-Chebyshev, KBD, taylor, parzen, bohman, lanczos

---

## Multirate / Sample Rate Conversion

- [ ] `half-band.js` — Efficient 2x decimation/interpolation. ~Half coefficients zero.
- [ ] `polyphase.js` — Polyphase FIR decomposition for efficient multirate.
- [ ] `cic.js` — Cascaded integrator-comb. Multiplier-free decimation.
- [ ] `cic-comp.js` — FIR compensation filter for CIC passband droop.
- [ ] `decimate.js` — FIR-based downsampler (anti-alias + downsample in one step).
- [ ] `interpolate.js` — FIR-based upsampler (upsample + anti-image in one step).
- [ ] `farrow.js` — Polynomial fractional-delay. Arbitrary-ratio sample rate conversion.
- [ ] `thiran.js` — Allpass fractional delay. Maximally flat group delay, unity magnitude.
- [ ] `oversample.js` — Multi-stage oversampling with configurable anti-alias filters.

---

## Adaptive Filters

- [ ] `lms.js` — Least Mean Squares. O(N). General, robust.
- [ ] `nlms.js` — Normalized LMS. Input-normalized step size. Most common in practice.
- [ ] `rls.js` — Recursive Least Squares. O(N²). Fastest convergence.
- [ ] `levinson.js` — Levinson-Durbin recursion. Solve Toeplitz system for LPC coefficients.

---

## Psychoacoustic / Auditory

- [ ] `gammatone.js` — Auditory model filter (cochlear approximation). Hearing research, ASR.
- [ ] `erb-bank.js` — ERB-spaced filter bank. Perceptual audio coding, loudness models.
- [ ] `bark-bank.js` — Bark-scale filter bank. Critical band analysis.
- [ ] `octave-bank.js` — IEC 61260 fractional-octave (1/1, 1/3, 1/6 octave at ISO centers).

---

## Dynamic / Envelope / Nonlinear

- [ ] `envelope.js` — Attack/release envelope follower. Sidechain for compressors, auto-wah.
- [ ] `slew-limiter.js` — Rate-of-change limiter. Nonlinear. Click prevention, control smoothing.
- [ ] `noise-shaping.js` — Feed quantization error through filter. Dithering, bit-depth reduction.
- [ ] `pink-noise.js` — 1/f spectral slope. IIR approximation (Trampe Brockmann).

---

## Adaptive / Intelligent (controller layer)

- [ ] `one-euro.js` — 1€ filter. Adaptive lowpass for jitter removal in tracking/UI/sensors.
- [ ] `dynamic-smoothing.js` — Self-adjusting SVF smoother (signal-activity-dependent cutoff).
- [ ] `spectral-tilt.js` — Arbitrary spectral slope filter (Nth-order tilt).
- [ ] `variable-bandwidth.js` — Real-time tunable cutoff IIR (smooth parameter change).

---

## Analysis & Conversion Utilities

### Analysis
- [ ] `group-delay.js` — Group delay computation from SOS/coefficients.
- [ ] `phase-delay.js` — Phase delay (phase/frequency).
- [ ] `pole-zero.js` — Extract poles/zeros from SOS.
- [ ] `impulse-response.js` — Compute impulse response from SOS.
- [ ] `step-response.js` — Compute step response from SOS.
- [ ] `filter-info.js` — Boolean predicates: isStable, isMinPhase, isFir, isLinPhase.

### Representation conversion
- [ ] `tf2zpk.js` — Transfer function → zeros/poles/gain.
- [ ] `zpk2sos.js` — ZPK → second-order sections (with pairing/ordering).
- [ ] `sos2zpk.js` — SOS → zeros/poles/gain.
- [ ] `tf2sos.js` / `sos2tf.js` — Transfer function ↔ SOS.

---

## Composite / High-Level (built from primitives)

- [ ] `graphic-eq.js` — ISO octave-band graphic EQ (cascade of peaking biquads).
- [ ] `parametric-eq.js` — N-band parametric EQ with shelves.
- [ ] `crossover.js` — N-way crossover (Butterworth or LR). Returns N band coefficient sets.
- [ ] `crossfeed.js` — Headphone spatialization (frequency-dependent L↔R mixing).
- [ ] `formant.js` — Parallel resonator bank at vocal tract frequencies (vowel synthesis).
- [ ] `vocoder.js` — Analysis + synthesis filter bank for cross-synthesis.

---

## Structures / Alternate Implementations

- [ ] `lattice.js` — Lattice/ladder IIR structure. Better numerics for adaptive, LPC.
- [ ] `warped-fir.js` — Frequency-warped FIR. Concentrates resolution at low frequencies.
- [ ] `coupled-allpass.js` — Two parallel allpass combining into IIR (efficient structure).
- [ ] `convolution.js` — FFT-based fast convolution (partitioned overlap-add for long IRs).

---

## Integration targets

### web-audio-api
- [ ] Replace `BiquadFilterNode._coefficients()` → use `digital-filter/biquad`
- [ ] Replace `IIRFilterNode._tick()` → use `digital-filter/filter`
- [ ] Verify all WPT tests pass with swapped implementation
- [ ] Benchmark performance

### defeedback (final goal — Dante Virtual Soundcard)
- [ ] `analyzer.js` — FFT + peak detection + feedback/music discrimination
- [ ] `tracker.js` — peak tracking over time, growth rate detection
- [ ] `notch-bank.js` — dynamic pool of notch filters, smooth add/remove
- [ ] Integration with Dante Virtual Soundcard audio I/O
- [ ] Latency target: detection ~50-100ms, filtering 0ms (sample-by-sample biquad)

---

## WASM / Performance

- [ ] WASM `filter.js` cascade (hot path for real-time)
- [ ] SIMD for 128-sample blocks (AudioWorklet quantum)
- [ ] WASM FIR convolution (for long FIR filters)
- [ ] Benchmark suite: JS vs WASM vs native

---

## Documentation

- [ ] Per-filter reference: what / when / when-not / params / characteristics / comparison / example
- [ ] Decision guide: "which filter should I use?"
- [ ] Comparison tables: Butterworth vs Chebyshev vs Bessel vs Elliptic, IIR vs FIR, SVF vs biquad
- [ ] Interactive visualizations (frequency response, pole-zero plots)
