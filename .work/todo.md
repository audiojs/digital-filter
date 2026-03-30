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

## Tier 3 — Done

### IIR design
- [x] `legendre.js` — Papoulis optimal monotonic (orders 1-8)
- [x] `gaussian-iir.js` — Young-van Vliet recursive Gaussian (zero-phase)
- [x] `yulewalk.js` — IIR from arbitrary frequency response (Yule-Walker + Levinson-Durbin)

### FIR extras
- [x] `firwin2.js` — Arbitrary frequency-response FIR (frequency sampling + IDFT)
- [x] `minimum-phase.js` — Linear-phase to minimum-phase (cepstral method)
- [x] `differentiator.js` — FIR derivative (Type III antisymmetric)
- [x] `integrator.js` — Newton-Cotes rules (rectangular, trapezoidal, Simpson)
- [x] `raised-cosine.js` — RC + root-RC pulse shaping
- [x] `gaussian-fir.js` — Gaussian pulse shaping (GMSK)
- [x] `matched-filter.js` — Time-reversed template (max SNR)

### Virtual analog / synthesis
- [x] `moog-ladder.js` — 4-pole transistor ladder (Stilson-Smith + tanh saturation)
- [x] `diode-ladder.js` — TB-303 style (per-stage tanh)
- [x] `korg35.js` — MS-20 style (2-pole LP/HP + nonlinear feedback)

### Psychoacoustic / auditory
- [x] `gammatone.js` — Cochlear model (cascade of complex one-pole + ERB bandwidth)
- [x] `octave-bank.js` — IEC 61260 fractional-octave (1/1, 1/3, 1/6 at ISO centers)
- [x] `erb-bank.js` — ERB-spaced filter bank (Glasberg & Moore 1990)
- [x] `bark-bank.js` — Bark critical bands (Zwicker 1980, 24 bands)

### Multirate extras
- [x] `half-band.js` — Half-band FIR for efficient 2x
- [x] `cic.js` — Cascaded integrator-comb (multiplier-free decimation)
- [x] `polyphase.js` — Polyphase FIR decomposition
- [x] `farrow.js` — Lagrange fractional-delay
- [x] `thiran.js` — Allpass fractional delay (maximally flat group delay)
- [x] `oversample.js` — Multi-stage oversampling with anti-alias

### Adaptive extras
- [x] `rls.js` — Recursive Least Squares O(N²)
- [x] `levinson.js` — Levinson-Durbin (LPC coefficients + reflection coefficients)

### Intelligent / controller
- [x] `dynamic-smoothing.js` — Self-adjusting SVF (cutoff adapts to signal speed)
- [x] `spectral-tilt.js` — Arbitrary dB/octave slope (cascaded first-order)
- [x] `variable-bandwidth.js` — Real-time tunable biquad (recomputes on param change)

### Composites
- [x] `graphic-eq.js` — ISO octave-band graphic EQ (peaking biquads)
- [x] `parametric-eq.js` — N-band parametric EQ (peak/lowshelf/highshelf)
- [x] `crossover.js` — N-way crossover (Linkwitz-Riley)
- [x] `crossfeed.js` — Headphone spatialization (frequency-dependent L↔R)
- [x] `formant.js` — Parallel resonator bank (vowel synthesis)
- [x] `vocoder.js` — Channel vocoder (analysis + synthesis filter bank)

### Structures
- [x] `lattice.js` — Lattice/ladder IIR (reflection coefficients)
- [x] `warped-fir.js` — Frequency-warped FIR (allpass delay elements)
- [x] `convolution.js` — Direct convolution O(N×M)

## Remaining

* [ ] upfirdn, resample — general resampling (niche)
* [ ] residue — partial fraction expansion (textbook)
* [ ] tf2ss/ss2tf — state-space (niche)
* [ ] wiener, deconvolve — inverse filtering (niche)


---

## Integration targets

* [ ] Interactive web demo (issue #1)
### [ ] loudness meter
### [ ] Crossover network

### web-audio-api
- [ ] Replace BiquadFilterNode._coefficients() → digital-filter/biquad
- [ ] Replace IIRFilterNode._tick() → digital-filter/filter

### defeedback (Dante Virtual Soundcard)
- [ ] analyzer, tracker, notch-bank modules
- [ ] Dante VSC audio I/O integration



---

## Documentation — Filter Encyclopedia

Goal: after reading, an engineer has complete understanding of what filters exist, why, when to use each, and what opportunities they unlock. Encyclopedic, educational, well-illustrated, with references.

### Structure

```
docs/
├── readme.md            — Overview: what are filters, why they matter, how to navigate
├── concepts.md          — Foundational concepts (prerequisites for everything else)
├── iir.md               — IIR filter families (biquad, butterworth, chebyshev, bessel, elliptic, svf, etc.)
├── fir.md               — FIR filter design (window method, least-squares, equiripple, specialized)
├── adaptive.md          — Adaptive filters (LMS, NLMS, applications)
├── weighting.md         — Weighting filters (A/C/K, ITU-R 468, RIAA)
├── applications.md      — Domain guides (audio, speech, biomedical, communications, control)
├── choosing.md          — Decision guide: which filter for which job
└── references.md        — Complete bibliography
```

### Per-filter entry template (every filter gets all of these)

Each filter entry documents these aspects:

**Identity**
- [ ] Name, aliases, alternate names in other libraries (scipy, MATLAB)
- [ ] Designer/origin: who created it, when, why, what problem they were solving
- [ ] Original paper/standard with year

**Purpose**
- [ ] One-sentence essence: what this filter does that nothing else does as well
- [ ] Primary use case: the #1 scenario where this is the right choice
- [ ] When NOT to use: what's better for adjacent problems
- [ ] What it replaces / what replaces it

**Mathematics**
- [ ] Transfer function H(z) or H(s) — the defining equation
- [ ] Difference equation (time-domain implementation)
- [ ] Pole-zero configuration (where poles/zeros sit and why)
- [ ] Design parameters: what each controls, valid ranges, typical values, what happens at extremes

**Frequency domain characteristics**
- [ ] Magnitude response plot (dB vs Hz, log scale) — the primary visual
- [ ] Phase response plot (degrees vs Hz)
- [ ] Group delay plot (samples vs Hz) — shows signal distortion
- [ ] Passband ripple (dB) — flatness within the pass region
- [ ] Stopband attenuation (dB) — rejection of unwanted frequencies
- [ ] Transition width — how sharp the cutoff is
- [ ] -3dB bandwidth — where the filter is "half power"

**Time domain characteristics**
- [ ] Impulse response plot — the filter's "fingerprint"
- [ ] Step response plot — shows overshoot, ringing, settling time
- [ ] Latency (samples or ms) — processing delay
- [ ] Is it linear phase? (preserves waveform shape)
- [ ] Is it minimum phase? (minimum possible delay)

**Stability & numerics**
- [ ] Stability conditions (when can it go unstable?)
- [ ] Numerical precision considerations (float32 vs float64, SOS vs direct form)
- [ ] Sensitivity to coefficient quantization

**Comparison**
- [ ] Side-by-side with closest alternatives (same plot, different filters)
- [ ] Table: this filter vs others on key metrics
- [ ] "Choose this when..." / "Choose that instead when..."

**Practical**
- [ ] Code example (minimal, copy-pasteable)
- [ ] Typical parameter values for common scenarios
- [ ] Known applications (specific software, standards, industries that use it)
- [ ] Popularity tier (ubiquitous / common / specialized / rare)

### Concepts section (concepts.md)

Foundational knowledge needed to understand the catalog:

- [ ] What is a filter? (LTI system, input→output transform)
- [ ] Frequency domain vs time domain — why both matter
- [ ] IIR vs FIR — fundamental tradeoff (infinite memory vs finite, recursive vs non-recursive)
- [ ] Transfer function H(z) — what it means, how to read it
- [ ] Poles and zeros — intuitive explanation (peaks and nulls)
- [ ] Magnitude response — what dB means, what "passband" and "stopband" mean
- [ ] Phase response — why phase matters (waveform distortion)
- [ ] Group delay — what "linear phase" means and why you'd want it
- [ ] Stability — what makes a filter blow up
- [ ] Second-order sections (SOS) — why we cascade biquads instead of using high-order direct form
- [ ] Bilinear transform — how analog filters become digital
- [ ] Frequency warping — why digital filters behave differently near Nyquist
- [ ] Sampling theorem — Nyquist, aliasing, anti-aliasing

### Comparison tables (choosing.md)

Decision aids:

- [ ] **IIR family comparison**: Butterworth vs Chebyshev I vs Chebyshev II vs Elliptic vs Bessel
      (columns: passband, stopband, transition width, group delay, phase linearity, order needed)
- [ ] **IIR vs FIR**: when each is appropriate
      (latency, phase, stability, computational cost, adaptability)
- [ ] **Biquad type selector**: all 9 types with one-line descriptions and shapes
- [ ] **"I want to..." lookup**: task → recommended filter → why
- [ ] **SVF vs biquad**: when to use which
- [ ] **Window function selector**: (reference to window-function docs)
- [ ] **FIR design method selector**: firwin vs firls vs remez — when each wins
- [ ] **Adaptive filter selector**: LMS vs NLMS — complexity/convergence tradeoff

### Application guides (applications.md)

Domain-specific filter recipes:

- [ ] **Audio**: EQ (parametric, graphic), crossovers, loudness metering (LUFS), de-essing, rumble/hum removal, sample rate conversion, noise shaping for dithering
- [ ] **Music synthesis**: resonant filters (Moog, SVF), envelope followers, formant filters, phaser/flanger/chorus, Karplus-Strong
- [ ] **Speech**: pre-emphasis, LPC, echo cancellation, noise reduction, VAD
- [ ] **Communications**: pulse shaping, channel equalization, matched filtering, carrier recovery
- [ ] **Biomedical**: ECG/EEG band extraction, 50/60Hz notch, motion artifact removal
- [ ] **Control systems**: PID as filter, complementary filter (IMU), anti-aliasing
- [ ] **Measurement**: weighting filters (A/C/K), octave-band analysis, THD measurement
- [ ] **Defeedback**: adaptive notch, peak detection, feedback vs music discrimination

### Illustrations needed

For each filter family, generate (as ASCII art or SVG or interactive):

- [ ] Magnitude response comparison (overlay multiple filters on same axes)
- [ ] Pole-zero plot showing how poles/zeros move with parameters
- [ ] Impulse response comparison
- [ ] Step response comparison (shows ringing/overshoot differences)
- [ ] Group delay comparison (shows phase linearity differences)
- [ ] Parameter sweep animations (e.g., Butterworth order 1→8 on same plot)

### References section

- [ ] Complete bibliography: every paper, standard, textbook cited
- [ ] Organized by topic, with one-line description of each
- [ ] Links to freely available resources (J.O. Smith online books, RBJ Cookbook, etc.)
- [ ] "Further reading" per topic area
