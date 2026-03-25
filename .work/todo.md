# digital-filter — complete DSP filter collection

> ESM, pure functions, plain args, no classes. Zero dependencies.
> 55 modules, 86 tests, 105ms, pure ESM.

## Done

### Core (6)
- [x] `biquad.js` — 9 RBJ Cookbook types
- [x] `filter.js` — SOS cascade processor, DF2T
- [x] `freqz.js` — frequency response + mag2db
- [x] `transform.js` — analog→digital pipeline
- [x] `group-delay.js` — group delay from SOS
- [x] `filtfilt.js` — zero-phase forward-backward filtering

### IIR design (6)
- [x] `butterworth.js` — LP/HP/BP/BS via transform
- [x] `chebyshev.js` — Type I via transform
- [x] `chebyshev2.js` — Type II (inverse Chebyshev), flat passband + stopband ripple
- [x] `bessel.js` — orders 1-10 via transform
- [x] `elliptic.js` — Cauer, via transform + Jacobi functions
- [x] `iirdesign.js` — auto-order from specs (picks best type)

### FIR design (5)
- [x] `window.js` — 11 window functions (hann, hamming, blackman, kaiser, etc.)
- [x] `firwin.js` — window-method FIR (LP/HP/BP/BS)
- [x] `firls.js` — least-squares optimal FIR
- [x] `remez.js` — Parks-McClellan equiripple FIR
- [x] `kaiserord.js` — Kaiser order + beta estimation

### Simple / specialized (14)
- [x] `dc-blocker.js`, `one-pole.js`, `leaky-integrator.js`, `moving-average.js`
- [x] `comb.js`, `allpass.js`, `pre-emphasis.js`, `resonator.js`
- [x] `envelope.js`, `slew-limiter.js`, `median.js`, `hilbert.js`
- [x] `svf.js` — Cytomic trapezoidal, 6 modes
- [x] `linkwitz-riley.js`, `savitzky-golay.js`

### Adaptive (2)
- [x] `lms.js` — Least Mean Squares
- [x] `nlms.js` — Normalized LMS

### Dynamic / nonlinear (3)
- [x] `noise-shaping.js`, `pink-noise.js`, `one-euro.js`

### Multirate (2)
- [x] `decimate.js` — anti-alias + downsample
- [x] `interpolate.js` — upsample + anti-image

### Analysis & conversion (8)
- [x] `sos2zpk.js`, `sos2tf.js`, `tf2zpk.js`, `zpk2sos.js`
- [x] `impulse-response.js` — impulse + step response
- [x] `phase-delay.js`
- [x] `filter-info.js` — isStable, isMinPhase, isFir, isLinPhase

### Weighting (5)
- [x] `a-weighting.js`, `c-weighting.js`, `k-weighting.js`, `itu468.js`, `riaa.js`

---

## Tier 3 — Specialized (future)

### IIR design
- [ ] `legendre.js` — Papoulis optimal monotonic
- [ ] `gaussian.js` — Deriche IIR approximation
- [ ] `yulewalk.js` — IIR from arbitrary frequency response

### FIR extras
- [ ] `firwin2.js` — Arbitrary frequency-response FIR (frequency sampling)
- [ ] `minimum-phase.js` — Convert linear-phase FIR to minimum-phase
- [ ] `differentiator.js` — FIR derivative
- [ ] `integrator.js` — FIR cumulative sum
- [ ] `raised-cosine.js` — Pulse shaping (communications)
- [ ] `gaussian-fir.js` — Gaussian pulse shaping
- [ ] `matched-filter.js` — Time-reversed template

### Virtual analog / synthesis
- [ ] `moog-ladder.js` — 4-pole transistor ladder (Zavalishin ZDF)
- [ ] `diode-ladder.js` — TB-303 style
- [ ] `korg35.js` — MS-20 style

### Psychoacoustic / auditory
- [ ] `gammatone.js` — Cochlear model
- [ ] `erb-bank.js` — ERB-spaced filter bank
- [ ] `bark-bank.js` — Bark-scale filter bank
- [ ] `octave-bank.js` — IEC 61260 fractional-octave

### Multirate extras
- [ ] `half-band.js` — Efficient 2x up/downsample
- [ ] `cic.js` — Cascaded integrator-comb (multiplier-free)
- [ ] `polyphase.js` — Polyphase FIR decomposition
- [ ] `farrow.js` — Polynomial fractional-delay
- [ ] `thiran.js` — Allpass fractional delay
- [ ] `oversample.js` — Multi-stage oversampling

### Adaptive extras
- [ ] `rls.js` — Recursive Least Squares O(N²)
- [ ] `levinson.js` — Levinson-Durbin (LPC coefficients)

### Intelligent / controller
- [ ] `dynamic-smoothing.js` — Self-adjusting SVF smoother
- [ ] `spectral-tilt.js` — Arbitrary spectral slope
- [ ] `variable-bandwidth.js` — Real-time tunable cutoff

### Composites
- [ ] `graphic-eq.js` — ISO octave-band graphic EQ
- [ ] `parametric-eq.js` — N-band parametric EQ
- [ ] `crossover.js` — N-way crossover
- [ ] `crossfeed.js` — Headphone spatialization
- [ ] `formant.js` — Parallel resonator bank
- [ ] `vocoder.js` — Analysis + synthesis filter bank

### Structures
- [ ] `lattice.js` — Lattice/ladder IIR structure
- [ ] `warped-fir.js` — Frequency-warped FIR
- [ ] `convolution.js` — FFT-based fast convolution

---

## Integration targets

### web-audio-api
- [ ] Replace BiquadFilterNode._coefficients() → digital-filter/biquad
- [ ] Replace IIRFilterNode._tick() → digital-filter/filter

### defeedback (Dante Virtual Soundcard)
- [ ] analyzer, tracker, notch-bank modules
- [ ] Dante VSC audio I/O integration

---

## Documentation
- [ ] Filter encyclopedia: single docs/filters.md with IIR/FIR/Adaptive/Multirate/Analysis/Weighting sections
- [ ] Per-filter entries: what / when / params / formula / example
- [ ] Decision guide: "which filter should I use?"
- [ ] Interactive visualizations
