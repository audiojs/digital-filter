# digital-filter research

> Complete collection of digital filters as functional JS + WASM modules.
> Part of audiojs ecosystem (Tier 2: DSP Primitives).

---

## 1. THE PROBLEM

**Who**: Any developer doing audio/signal processing in JS — synth builders, audio plugin authors, loudness metering tools, scientific visualization, communications simulation, biomedical data processing.

**Pain**: No JS/WASM library equivalent to scipy.signal exists. You cannot do `butterworth(8, 1000, 44100)` in JavaScript and get correct 8th-order Butterworth SOS coefficients. Web Audio API only gives you a single biquad with no coefficient access. Tone.js wraps that with no DSP-level control. fili.js exists but is pure JS, limited, unmaintained.

**What becomes possible**: A complete, composable, functional filter toolkit — design coefficients, process blocks, analyze responses — all from JS or WASM. Like D3 for filters.

**Villain**: Fragmentation. Every audio project re-implements biquads from scratch, usually wrong. No canonical reference implementation in JS.

**What world loses if this never exists**: JS audio ecosystem stays hobbyist-grade — no one can build professional loudness meters, crossover networks, or parametric EQs without dropping to C++ or Python.

---

## 2. THE TERRITORY

### What exists

| Library | Scope | Limitation |
|---|---|---|
| Web Audio BiquadFilterNode | 8 biquad types, native | Single section, no coefficient access, no FIR, no high-order |
| Web Audio IIRFilterNode | Arbitrary IIR coefficients | Immutable after creation, no automation |
| Tone.js | Musical abstractions over Web Audio | No DSP-level control, no filter design |
| fili.js | Butterworth/Bessel/Chebyshev design + processing | Pure JS, limited types, unmaintained |
| essentia.js | MIR (C++ → WASM) | Analysis-oriented, not real-time filter design |
| scipy.signal (Python) | Complete filter design + processing | Not JS |
| CMSIS-DSP (C, ARM) | Optimized biquad cascades | Not JS/WASM |
| Faust → WASM | Functional DSP → WASM compilation | Requires Faust language, not a library |

### What's missing

1. scipy.signal-equivalent coefficient design in JS
2. SOS-based high-order filter processing (numerical stability)
3. Analysis toolkit (freqz, group_delay, pole-zero)
4. WASM-optimized block processing for AudioWorklet
5. Parameter smoothing (anti-zipper)
6. Complete filter type coverage

### Existing audiojs assets to extract from

- `web-audio-api/src/BiquadFilterNode.js` — 8 biquad types with RBJ Cookbook coefficients, Direct Form I processing, `getFrequencyResponse()`
- `web-audio-api/src/IIRFilterNode.js` — Generic IIR Direct Form II Transposed, up to 20 coefficients
- `web-audio-api/src/ConvolverNode.js` — Partitioned FFT convolution (overlap-add)
- `web-audio-api/src/WaveShaperNode.js` — Half-band FIR (15-tap) for oversampling
- `web-audio-api/src/AnalyserNode.js` — Blackman window, FFT magnitude spectrum
- `web-audio-api/src/DynamicsCompressorNode.js` — Envelope detection (attack/release)
- `a-weighting` package — frequency weighting curves
- `window-function` package — Hann, Hamming, Blackman, Kaiser, Flat-top, Tukey

---

## 3. COMPLETE FILTER TAXONOMY

### 3.1 IIR Filters

#### Biquad / Second-Order Sections (the fundamental building block)

All higher-order IIR filters decompose into cascaded biquads for numerical stability.

General form: `H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)`

Processing: `y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]`

| Type | Params | Essence | Use |
|---|---|---|---|
| **lowpass** | fc, Q | -12 dB/oct above fc | Anti-aliasing, tone control, smoothing |
| **highpass** | fc, Q | -12 dB/oct below fc | DC removal, bass cut, presence |
| **bandpass** (const skirt) | fc, Q/BW | Peak gain = Q | Frequency isolation, wah-wah |
| **bandpass** (const peak) | fc, Q/BW | Peak = 0 dB | Unity-gain band selection |
| **notch** (band-reject) | fc, Q/BW | Null at fc | Hum removal, feedback suppression |
| **allpass** | fc, Q | Unity magnitude, phase shift | Phaser effects, phase equalization |
| **peaking EQ** (bell) | fc, Q/BW, dBgain | Boost/cut bell around fc | Parametric EQ — the workhorse |
| **low shelf** | fc, dBgain, S | Boost/cut below fc | Bass control, warmth |
| **high shelf** | fc, dBgain, S | Boost/cut above fc | Treble control, air/brightness |

**Reference**: RBJ Audio EQ Cookbook (W3C Note: w3.org/TR/audio-eq-cookbook/)

Shared intermediates:
- `A = 10^(dBgain/40)` — for peaking/shelving
- `w0 = 2*pi*fc/Fs`
- `alpha = sin(w0)/(2*Q)` or via bandwidth or shelf slope

#### Classic Analog-Prototype Filters (designed in s-domain, digitized)

| Type | Passband | Stopband | Transition | Group Delay | Defining Property |
|---|---|---|---|---|---|
| **Butterworth** | Maximally flat | Monotonic | Widest | Moderate | Flat magnitude, no ripple |
| **Chebyshev I** | Equiripple | Monotonic | Narrower | More variation | Sharpest for given ripple |
| **Chebyshev II** | Monotonic | Equiripple | Narrower than BW | Moderate | Flat passband + faster rolloff |
| **Elliptic/Cauer** | Equiripple | Equiripple | **Narrowest** (optimal) | Most variation | Minimum order for specs |
| **Bessel/Thomson** | Monotonic (soft) | Monotonic | Widest (gentle) | **Maximally flat** | Linear phase, no ringing |
| **Legendre/Papoulis** | Monotonic (optimal) | Monotonic | Between BW & Cheb I | Between | Steepest monotonic |
| **Gaussian** | Monotonic (soft) | Monotonic | Very wide | Minimum variation | Self-similar under Fourier transform |
| **Linkwitz-Riley** | Flat (LP+HP sum) | — | Steep (2x Butterworth) | — | Crossover: LP+HP = allpass |

**Butterworth**: `|H(jw)|^2 = 1/(1+(w/wc)^2N)`. Poles on circle in s-plane. -20N dB/decade. Default choice. Reference: Butterworth (1930).

**Chebyshev I**: `|H(jw)|^2 = 1/(1+eps^2*T_N^2(w/wc))`. T_N = Chebyshev polynomial. Equiripple in passband. Typical ripple: 0.5-3 dB.

**Chebyshev II**: Monotonic passband, equiripple stopband. Has finite zeros in stopband. Less common but useful when flat passband required with faster rolloff than Butterworth.

**Elliptic/Cauer**: Jacobi elliptic functions. Ripple in both bands. **Sharpest possible transition for given order/ripple specs**. Often 4-6 order suffices where Butterworth needs 10+. Reference: Cauer (1958).

**Bessel/Thomson**: Bessel polynomials. Maximally flat group delay. Preserves waveshape. Slowest rolloff. **Critical**: bilinear transform destroys the group delay property — use phase-preserving methods (Thiran allpass, matched methods). Reference: Thomson (1949).

**Legendre/Papoulis**: Legendre polynomials. Steepest monotonic passband — between Butterworth and Chebyshev I. Rarely in standard libraries, requires custom polynomial calculation. Reference: Papoulis (1958).

**Gaussian**: `h(t) = exp(-t^2/2σ^2)`. Fourier transform is also Gaussian. No overshoot/ringing. IIR approximations: Deriche filter, Young-van Vliet. Reference: Deriche (1993).

**Linkwitz-Riley**: Two cascaded Nth-order Butterworth. LR2 (12 dB/oct), LR4 (24 dB/oct), LR8 (48 dB/oct). LP+HP = flat (allpass). -6 dB at crossover. **The** crossover filter. Reference: Linkwitz & Riley (1976).

#### Specialized IIR Filters

**DC Blocker**: `H(z) = (1-z^-1)/(1-R*z^-1)`, R≈0.995-0.9999. Zero at DC + pole near DC. Essential after waveshaping/distortion. Reference: Julius O. Smith III.

**Leaky Integrator**: `H(z) = 1/(1-λ*z^-1)`, 0<λ<1. Exponentially forgets old samples. `λ = exp(-1/(Fs*τ))`. Envelope following, RMS estimation, smoothing.

**One-Pole Lowpass** (EMA): `H(z) = (1-a)/(1-a*z^-1)`, `a = exp(-2π*fc/Fs)`. Simplest IIR. -6 dB/oct. Parameter smoothing, anti-zipper.

**Two-Pole Lowpass**: Cascade of two one-poles or single biquad. -12 dB/oct. Smoother than single pole.

**Comb Filters**:
- Feedforward (FIR): `H(z) = 1 + a*z^-M`. Evenly-spaced notches. Flanging.
- Feedback (IIR): `H(z) = 1/(1-g*z^-M)`. Resonant peaks. Reverb (Schroeder), Karplus-Strong string synthesis. Reference: Schroeder (1962), Karplus & Strong (1983).

**Allpass Filters**:
- 1st-order: `H(z) = (a+z^-1)/(1+a*z^-1)`. Phase 0→-π.
- 2nd-order: RBJ allpass. Phase 0→-2π. Phaser effects.
- Allpass Hilbert pair: Two parallel allpass chains with ~90° phase difference → analytic signal. 6th-12th order for wideband. Reference: Regalia & Mitra.

**State Variable Filter (SVF)**:
- Chamberlin (1985): Euler integration. `hp = in - lp - q*bp; bp += f*hp; lp += f*bp`. Simultaneous LP/HP/BP/BR. **Unstable above Fs/6 at high Q**.
- **Andrew Simper / Cytomic (2011)**: Trapezoidal integration with zero-delay feedback. Stable at all frequencies. Correct tuning. All outputs (LP/HP/BP/notch/peak/allpass/shelves) from one structure. `g = tan(π*fc/Fs)`, `k = 1/Q`. **Gold standard for real-time audio**. Reference: Simper, "Linear Trapezoidal Integrated SVF" (Cytomic, 2011); Zavalishin, "The Art of VA Filter Design" (2012).

**Ladder Filters (Moog-style)**: 4 cascaded 1-pole LP + global feedback. -24 dB/oct with resonance. Self-oscillates at k=4. Implementations: Stilson-Smith (1996), Huovilainen (2004), Zavalishin ZDF (2012), D'Angelo-Valimaki (2014). Reference: Moog (1965).

**Diode Ladder**: Roland TB-303 character. Less bass loss at high resonance, brighter than transistor ladder. Reference: Stinchcombe (2004).

**Korg MS-20 (Korg35)**: 6 dB HPF + 12 dB LPF in series. Nonlinear feedback prevents hard clipping. Aggressive character. Reference: Zavalishin (2012), Pirkle.

**Sallen-Key**: 2nd-order active topology. LP/HP/BP/BR/AP. Wave Digital Filter approach preserves analog topology. Reference: Sallen & Key (1955).

**Resonant Filters**: Any filter with pronounced peak — biquad BP at high Q, SVF at high resonance, ladder with feedback, constant-peak-gain resonator. Formant synthesis, modal synthesis, wah-wah.

#### IIR Design Methods

| Method | Aliasing | HP/BS | Freq Accuracy | Best For |
|---|---|---|---|---|
| **Bilinear transform** | None | Yes | Warped (prewarp 1 freq) | Standard method for all types |
| **Impulse invariance** | Yes | LP/BP only | Linear (aliased) | Time-domain fidelity |
| **Matched Z-transform** | Yes | Partial | Linear (aliased) | Analog topology preservation |
| **Pole-zero placement** | N/A | Yes | Exact (manual) | Simple filters, education |

**Bilinear Transform**: `s = (2/T)(z-1)/(z+1)`. Maps left half s-plane → unit circle interior. Frequency warping: `Ω = (2/T)tan(ω*T/2)`. Prewarp critical frequency. **The standard method**. Reference: Tustin (1947), Oppenheim & Schafer.

#### Weighting / Loudness Filters

| Type | Standard | Essence | Order | Use |
|---|---|---|---|---|
| **A-weighting** | IEC 61672 | ~40 phon equal-loudness | 4p+2z (3 biquads) | dBA measurement, environmental noise |
| **B-weighting** | IEC 61672 (deprecated) | ~70 phon | — | Historical |
| **C-weighting** | IEC 61672 | ~100 phon, nearly flat | 4p (2 biquads) | dBC, peak measurement |
| **D-weighting** | IEC 61672 (deprecated) | Aircraft noise, 6kHz peak | — | Historical aircraft noise |
| **Z-weighting** | IEC 61672 | Flat (identity) | 0 | Unweighted SPL |
| **ITU-R 468** | ITU-R BS.468-4 | BBC noise perception, +12.2dB@6.3kHz | ~5th order | Broadcast noise measurement |
| **K-weighting** | ITU-R BS.1770 | Head shelf +4dB@1.5kHz + HPF@80Hz | 4 (2 biquads) | LUFS loudness metering |
| **RIAA** | IEC 98 | Vinyl playback de-emphasis | 2p+1z | Phono preamp, vinyl digitization |
| **Pre-emphasis** | Various (FM, CD, AES) | HF boost before transmission | 1st order | FM broadcasting (50/75μs), CD, tape |

**K-weighting (ITU-R BS.1770)**: Stage 1: high-shelf +4dB above 1.5kHz (head model). Stage 2: 2nd-order Butterworth HPF at ~80Hz (RLB). Coefficients spec'd for 48kHz. Must recalculate for other rates.

**RIAA**: Time constants 3180μs (50Hz), 318μs (500Hz), 75μs (2122Hz). Two poles, one zero. Bilinear transform to digital.

### 3.2 FIR Filters

#### Design Methods

| Method | Criterion | Advantage | Disadvantage |
|---|---|---|---|
| **Window method** | Truncate + window ideal h[n] | Simple, intuitive | No independent ripple control |
| **Parks-McClellan / Remez** | Minimax (equiripple) | **Minimum order for specs** | Iterative, can fail to converge |
| **Least-squares** | Minimize L2 error | Smallest total error energy | Larger peak error than PM |
| **Frequency sampling** | Exact at N points, IDFT | Arbitrary shapes, FFT-efficient | Ripple between samples |
| **Maximally flat** | Max zero derivatives at 0,π | Monotonic, smooth | Wider transition than equiripple |

**Parks-McClellan**: Minimize max|W(ω)[H(ω)-D(ω)]|. Remez exchange algorithm. Equiripple in both bands. **Gold standard** when minimum filter order needed.
- Order estimate (Bellanger): `N ≈ -2/3 * log10(10*δp*δs) / Δf`
- Order estimate (Kaiser): `N ≈ (-20*log10(√(δp*δs)) - 13) / (14.6*Δf)`

Reference: Parks & McClellan (1972).

#### Standard FIR Types

**Linear Phase FIR symmetry types**:
- Type I: Odd length, symmetric. No restrictions.
- Type II: Even length, symmetric. Zero at ω=π. Cannot be highpass/bandstop.
- Type III: Odd length, antisymmetric. Zeros at ω=0,π. For differentiators, Hilbert.
- Type IV: Even length, antisymmetric. Zero at ω=0. For differentiators, Hilbert.

| Type | Definition/Formula | Key Property | Use |
|---|---|---|---|
| **Lowpass/HP/BP/BS** | Standard frequency-selective | From ideal sinc via transform | Fundamental building blocks |
| **Hilbert transform** | H(ω) = -j·sgn(ω), h[n] = 2sin²(πn/2)/(πn) | 90° phase shift | Analytic signal, SSB, envelope detection |
| **Differentiator** | H(ω) = jω | Antisymmetric, slope approximation | Derivative estimation, edge detection |
| **Moving average** | h[n] = 1/N (boxcar) | Optimal for white noise + step preservation | Smoothing, trend extraction |
| **Weighted MA** | Linearly decreasing weights | Emphasizes recent | Trend tracking |
| **Savitzky-Golay** | Polynomial least-squares fit | Preserves moments up to order p | Smoothing with shape preservation |
| **Half-band** | Cutoff at π/2, h[2k+1]=0 | ~Half coefficients zero | Efficient 2x decimation/interpolation |
| **CIC** | H(z)=[(1-z^(-RM))/(1-z^-1)]^N | **Zero multiplications** | High-ratio decimation, FPGA/ASIC |
| **Matched filter** | h[n] = s*[N-1-n] (time-reversed signal) | Maximizes output SNR | Radar pulse compression, detection |
| **Median filter** | y[n] = median(window) | **Nonlinear**, preserves edges | Impulse noise removal |

**CIC (Hogenauer)**: Cascade of N integrators + N combs. Multiplier-free. B-spline-shaped response. -13N dB sidelobes. Needs compensation filter for passband droop. Reference: Hogenauer (1981).

**Savitzky-Golay**: Least-squares polynomial of degree p on window of 2M+1 points. Preserves polynomial trends. Also estimates derivatives. Equivalent to maximally flat FIR for zeroth derivative. Reference: Savitzky & Golay (1964).

#### Multirate / Sample Rate Conversion

| Operation | Method | Key Insight |
|---|---|---|
| **Decimation** | Anti-alias LPF (ωc=π/M) → downsample | Polyphase: compute only retained samples (M× savings) |
| **Interpolation** | Zero-insert → LPF (ωc=π/L, gain L) | Polyphase: filter original-rate samples, interleave |
| **Fractional delay** | Lagrange, windowed sinc, Farrow structure | Farrow: polynomial in delay value, enables continuous variation |
| **Polyphase decomposition** | Split H(z) into M phases | Enables efficient multirate — core technique |
| **Multistage decimation** | Cascade smaller stages (e.g., 100 = 10×10) | Minimizes total computation for large rate changes |
| **Thiran allpass** | IIR fractional delay, maximally flat group delay | Unity magnitude, good for narrowband |

**Farrow structure**: `h[n] = Σ c_k[n]·d^k`. Polynomial in fractional delay d. Fixed sub-filter coefficients. Enables real-time variable delay without recomputation. Used in timing recovery, resampling, Doppler correction.

#### Adaptive Filters

| Algorithm | Update Rule | Cost/sample | Convergence | Use |
|---|---|---|---|---|
| **LMS** | w += μ·e·x | O(N) | Slow (eigenvalue spread) | General, robust |
| **NLMS** | w += μ·e·x/(x^T·x+ε) | O(N) | Faster (input-normalized) | **Most common in practice** |
| **RLS** | w += K·e (matrix update) | O(N²) | **Fastest** (independent of input) | When speed critical |
| **Kalman** | Predict-update cycle | O(N²) | Optimal (Gaussian) | Dynamic systems, explicit model |
| **Wiener** | w_opt = R_xx^(-1)·r_xd | Offline | Optimal (stationary) | Benchmark, theoretical |

**Applications**: Noise cancellation (ANC), acoustic echo cancellation (AEC, 100-500ms tail), channel equalization, system identification, beamforming.

**LMS**: `w[n+1] = w[n] + μ·e[n]·x[n]`. Convergence: `0 < μ < 2/(N·σ_x²)`. Reference: Widrow & Hoff (1960).

#### Window Functions

| Window | Sidelobe (dB) | Rolloff (dB/oct) | ENBW (bins) | Key Feature |
|---|---|---|---|---|
| Rectangular | -13.3 | -6 | 1.00 | Best resolution, worst leakage |
| Triangular/Bartlett | -26.5 | -12 | 1.33 | Simple |
| **Hann** | -31.5 | -18 | 1.50 | General purpose, COLA with 50% overlap |
| **Hamming** | -42.7 | -6 | 1.36 | First sidelobe cancelled, speech standard |
| **Blackman** | -58.1 | -18 | 1.73 | Good all-round |
| Blackman-Harris (4t) | -92.0 | -6 | 2.00 | High dynamic range |
| Blackman-Nuttall | -98.0 | -6 | 1.98 | Best of Blackman family |
| Nuttall (4t cont) | -93.3 | -18 | 2.02 | Fast rolloff + low sidelobes |
| **Flat-top** | -93.0 | -6 | 3.77 | **Amplitude accuracy** (~0.01dB) |
| **Kaiser** (param β) | Tunable | Varies | Varies | **Adjustable** tradeoff, near-optimal |
| Gaussian | ~-42 | ∞ | ~1.45 | Min time-bandwidth product (Gabor) |
| **Tukey** (param α) | Between rect/Hann | Varies | ~1+α*0.5 | Rectangular center + cosine taper |
| Planck-taper | Very fast rolloff | Very fast | Varies | C∞ smooth, LIGO gravitational waves |
| DPSS/Slepian | Optimal | — | — | **Provably optimal** energy concentration |
| Dolph-Chebyshev | Tunable (equiripple) | 0 | Varies | Min mainlobe for given equiripple level |
| Welch | -21.3 | -12 | 1.20 | Parabolic, simple |
| Parzen | -53.1 | -24 | 1.92 | 4-fold convolution of rectangular |
| Bohman | -46.0 | -24 | 1.79 | Convolution of two cosine halves |
| **KBD** (Kaiser-Bessel Derived) | Depends on β | — | — | MDCT/AAC codec, Princen-Bradley condition |

**Fundamental tradeoff**: Narrower main lobe = better frequency resolution but higher sidelobes = more leakage. No window optimizes both.

**Kaiser**: `w[n] = I_0(β√(1-(2n/(N-1)-1)²)) / I_0(β)`. β=0→rectangular, β≈5.4→Hamming, β≈9→Blackman. Design formulas: β from desired attenuation, N from β and transition width. Reference: Kaiser (1974).

### 3.3 Special Purpose

**Pink noise filter (1/f)**: -3dB/octave. IIR approximation: cascade of 1st-order sections at octave-spaced frequencies (Trampe Brockmann, ±0.5dB 10Hz-20kHz). Also Voss-McCartney stacked random generator.

**Noise shaping**: Feed quantization error through filter to shape spectrum. `E(z) = (1-H(z))·E_q(z)`. 1st-order → highpass-shaped. F-weighted → inverse ear sensitivity. POW-R, MBIT+. For dithering/bit-depth reduction.

**Crossover networks**: N-way frequency splitting.
- Linkwitz-Riley: LP+HP=flat. LR4 most common.
- FIR linear-phase: `h_hp = δ[n-D] - h_lp` (perfect reconstruction). Steep but adds latency.

**Anti-aliasing / Reconstruction**: LPF before decimation / after interpolation. Oversampling strategy moves filter burden from analog to digital.

**Interpolation kernels**: Sinc (ideal), windowed sinc, Lanczos (sinc·sinc(t/a)), cubic (Keys a=-0.5), B-spline (smooth but blurs without prefilter), Mitchell-Netravali (B=1/3,C=1/3).

---

## 4. STANDARD VISUALIZATIONS

| Plot | Shows | Axes | When Essential |
|---|---|---|---|
| **Magnitude response** | Gain vs frequency | X: Hz (log), Y: dB | **Always** — primary design verification |
| **Phase response** | Phase shift vs frequency | X: Hz, Y: degrees/radians | Audio crossovers, communications, control |
| **Group delay** | Time delay vs frequency | X: Hz, Y: samples or seconds | Phase alignment, waveform preservation |
| **Impulse response** | Filter output for δ[n] | X: samples, Y: amplitude | Stability check, FIR coefficients, reverb |
| **Step response** | Filter output for u[n] | X: samples, Y: amplitude | Transient behavior, settling, DC gain |
| **Pole-zero plot** | Poles (×) and zeros (○) on z-plane | Complex plane, unit circle | Design understanding, stability |
| **Bode plot** | Magnitude + phase combined | Log Hz, dB + degrees | Control systems, gain/phase margins |
| **Spectrogram** | Time-varying frequency content | X: time, Y: Hz, color: dB | Non-stationary signals, real-time debug |
| Coefficient plot | Raw filter coefficients | X: index, Y: value | FIR verification, symmetry check |
| Nyquist plot | H(ejω) in complex plane | Re vs Im | Control stability (Nyquist criterion) |
| Eye diagram | Overlaid symbol-rate traces | X: symbol periods, Y: amplitude | Communications pulse shaping |
| Constellation | I/Q received symbols | I vs Q | Modulation quality |

**Essential five**: Magnitude response, phase response, group delay, pole-zero plot, impulse response.

---

## 5. APPLICATIONS BY DOMAIN

### Audio
EQ (parametric, graphic), crossovers (LR4), dynamics (envelope detection), reverb (allpass+comb, convolution), noise reduction, de-essing, rumble removal (HPF 20-80Hz), hum removal (notch 50/60Hz+harmonics), loudness metering (K-weighting → LUFS), dithering (noise shaping), sample rate conversion.

### Music Synthesis
Resonant lowpass (Moog -24dB/oct), SVF (LP/HP/BP/notch simultaneous), envelope follower, formant filters (parallel BP at F1/F2/F3), vocoder (16-32 band analysis+synthesis), phaser (cascaded allpass+LFO), flanger (short delay+LFO+feedback), chorus (multiple modulated delays), wah-wah (swept peaking EQ), comb filters (Karplus-Strong string).

### Speech
Pre-emphasis (1-αz^-1, α≈0.97), LPC formant analysis, noise reduction (spectral subtraction, Wiener, RNNoise), echo cancellation (adaptive NLMS, 100-500ms), VAD, beamforming.

### Communications
Pulse shaping (root raised cosine, matched filter pairs), channel equalization (adaptive FIR), carrier recovery (PLL loop filter), decimation/interpolation (polyphase, CIC), AGC.

### Biomedical
ECG (0.05-150Hz BPF, 50/60Hz notch, Pan-Tompkins), EEG (Delta/Theta/Alpha/Beta/Gamma bands), EMG (20Hz HPF + envelope), motion artifact removal (adaptive LMS with accelerometer reference).

### Control
PID (discrete IIR), complementary filter (gyro HP + accel LP = IMU fusion), Kalman filter, anti-aliasing before ADC (Bessel preferred for no overshoot).

### Power Systems
Harmonic analysis (FFT, bandpass at 50/60Hz harmonics), THD measurement, power quality monitoring.

---

## 6. API DESIGN

### Architecture: Three Layers

```
┌─────────────────────────────────────────┐
│  Layer 1: DESIGN (pure functions)       │  design(type, params) → SOS coefficients
│  Stateless coefficient computation      │  No allocation, pure math
├─────────────────────────────────────────┤
│  Layer 2: PROCESS (stateful, WASM)      │  create(sos) → handle
│  Block-based filtering engine           │  process(handle, input) → output
│  Per-channel state, pre-allocated       │  update(handle, newSos), reset(handle)
├─────────────────────────────────────────┤
│  Layer 3: ANALYZE (pure functions)      │  freqz(sos, N) → {mag, phase, freq}
│  Response computation for visualization │  groupDelay(sos, N), poleZero(sos)
└─────────────────────────────────────────┘
```

### Design Decisions

**SOS format is non-negotiable**: Direct-form coefficients in float32 have catastrophic numerical issues above 2nd order. All high-order filters must use second-order sections.

**Block processing primary**: 128-sample blocks (Web Audio quantum). Amortizes WASM call overhead, enables SIMD. Single-sample `tick()` for convenience/feedback loops.

**Multichannel**: Separate instance per channel (simple, flexible, different filters per channel for crossovers). Shared coefficients, independent state.

**Parameter smoothing**: Interpolate frequency/Q/gain params and recompute coefficients per block (or sub-block). This is what JUCE and professional audio software does. Coefficient-domain interpolation doesn't map linearly to frequency domain.

**Memory for WASM**: Pre-allocate at init. No dynamic allocation during process. Float32 for audio (matches Web Audio), Float64 for coefficient computation.

### Functional API Pattern

```
// Layer 1: Design
lowpass(order, fc, fs) → sos[]
butterworth(order, fc, fs, type) → sos[]
chebyshev1(order, fc, fs, ripple, type) → sos[]
elliptic(order, fc, fs, ripplePass, rippleStop, type) → sos[]
biquad(type, fc, fs, Q, gain) → sos  // single section
kWeighting(fs) → sos[]
aWeighting(fs) → sos[]

// Layer 2: Process — in-place, stateful via params object (existing pattern)
filter(data, {sos, state}) → data  // modifies in-place, persists state
// or block: filter(input, output, {sos, state})

// Layer 3: Analyze
freqz(sos, nPoints, fs) → {frequencies, magnitude, phase}
groupDelay(sos, nPoints, fs) → {frequencies, delay}
poleZero(sos) → {poles, zeros}
impulseResponse(sos, nSamples) → Float64Array
```

### Existing Pattern to Follow

Current digital-filter API: `filter(samples, params)` — modifies in-place, params object persists state across calls. This is a good pattern: simple, functional, stateful via explicit object.

---

## 7. WHAT MAKES THIS CANONICAL

**Irreducible essence**: Take signal in, give signal out, changed exactly as specified by mathematics. The taste of water — no flavor of its own, only the transform.

**What makes it timeless**: The math doesn't change. Butterworth poles have been on a circle since 1930. RBJ Cookbook coefficients are correct forever. A well-implemented filter library has the shelf life of a math table.

**The seed that contains the whole tree**: The biquad. Every IIR filter decomposes into biquads. Get the biquad right — coefficient computation, processing, analysis — and everything else is composition.

**Single-player value**: One developer, one signal, one filter. No network effects needed. Pure tool.

**Moat**: Correctness + completeness + simplicity. scipy.signal is the benchmark — match it for JS with better ergonomics and WASM performance.

**Victory metric**: Can you implement a broadcast-grade LUFS loudness meter using only this library? If yes, it works.

---

## 8. PROPOSED MODULE STRUCTURE

```
digital-filter/
├── biquad.js          # RBJ Cookbook: 9 biquad types → SOS
├── butterworth.js     # Nth-order Butterworth → SOS
├── chebyshev.js       # Type I and II → SOS
├── elliptic.js        # Cauer/Elliptic → SOS
├── bessel.js          # Bessel/Thomson → SOS
├── linkwitz-riley.js  # LR crossover → SOS pair
├── svf.js             # State Variable Filter (Simper/Cytomic)
├── filter.js          # SOS cascade processing (core engine)
├── moving-average.js  # Simple/weighted/circular buffer
├── leaky-integrator.js # Exponential decay
├── dc-blocker.js      # DC removal
├── comb.js            # Feedforward + feedback comb
├── allpass.js         # 1st/2nd order allpass
├── one-pole.js        # One-pole lowpass (EMA)
├── weighting/
│   ├── a.js           # A-weighting (IEC 61672)
│   ├── c.js           # C-weighting
│   ├── k.js           # K-weighting (ITU-R BS.1770)
│   ├── itu468.js      # ITU-R 468
│   └── riaa.js        # RIAA de-emphasis
├── savitzky-golay.js  # Polynomial smoothing
├── freqz.js           # Frequency response analysis
├── group-delay.js     # Group delay computation
├── pole-zero.js       # Pole-zero extraction
├── bilinear.js        # Bilinear transform (design utility)
└── window.js          # → re-export from window-function package
```

Each module: pure function, plain args, plain returns. No classes. No this. WASM-friendly.

---

## 9. KEY REFERENCES

### Textbooks
- Oppenheim & Schafer, "Discrete-Time Signal Processing" (3rd ed, 2009) — **the bible**
- Proakis & Manolakis, "DSP: Principles, Algorithms, and Applications" (4th ed, 2006)
- Julius O. Smith III, "Introduction to Digital Filters" — free at ccrma.stanford.edu/~jos/filters/
- Zölzer, "DAFX: Digital Audio Effects" (2nd ed, 2011)
- Zavalishin, "The Art of VA Filter Design" (free, Native Instruments, 2012)
- Pirkle, "Designing Audio Effect Plugins in C++" (2019)
- Haykin, "Adaptive Filter Theory" (5th ed, 2014)
- Lyons, "Understanding DSP" (3rd ed, 2010)
- Steven W. Smith, "The Scientist and Engineer's Guide to DSP" — free at dspguide.com

### Key Papers/Specs
- RBJ Audio EQ Cookbook (W3C Note: w3.org/TR/audio-eq-cookbook/)
- Simper, "Linear Trapezoidal Integrated SVF" (Cytomic, 2011)
- Parks & McClellan, "Chebyshev Approximation for Nonrecursive Digital Filters" (IEEE, 1972)
- Hogenauer, "Economical class of digital filters for decimation and interpolation" (IEEE, 1981)
- Kaiser, "Nonrecursive digital filter design using the I_0-sinh window function" (1974)
- Harris, "On the Use of Windows for Harmonic Analysis with the DFT" (Proc. IEEE, 1978)
- IEC 61672 (sound level meters, A/C-weighting)
- ITU-R BS.1770-5 (K-weighting, LUFS loudness metering)
- IEC 61260 (octave/fractional-octave band filters)

### Online
- ccrma.stanford.edu/~jos/ — Julius O. Smith III's 4 online books
- cytomic.com/technical-papers — Andrew Simper's SVF papers
- earlevel.com — Nigel Redmon's biquad/envelope tutorials
- musicdsp.org — community DSP snippet archive
- dsprelated.com — articles, forums

---

## 10. FILTER COMBINATIONS & HIGHER-ORDER APPLICATIONS

A single filter is a static transform. Combinations of filters — controlled by a signal or intelligence — become instruments of perception and response.

### Combination patterns

| Pattern | Mechanism | Examples |
|---|---|---|
| **Cascade** (series) | Multiply transfer functions | Multi-band EQ, crossovers, high-order from biquads |
| **Parallel** (sum) | Add transfer functions | Formant synthesis, additive EQ, filter banks |
| **Sidechain** (detect→control) | One signal controls another's filter params | Compressor, de-esser, ducker, auto-wah, envelope follower |
| **Adaptive** (error→update) | Filter adjusts coefficients to minimize error signal | Echo cancellation, noise cancellation, system ID, defeedback |
| **Analysis→Resynthesis** | Decompose, modify, rebuild | Vocoder, phase vocoder, spectral processing, pitch shifting |
| **Feedback** (output→input) | Create resonance, oscillation, reverb tails | Schroeder reverberator, Karplus-Strong, flanging, phaser |
| **Modulated** (LFO/envelope→params) | Time-varying filter parameters | Phaser, auto-filter, chorus, Leslie, wah-wah |
| **Complementary** (LP+HP=flat) | Split and recombine after independent processing | Multiband compression, crossovers, mid-side, parallel compression |

### The control loop: perception → decision → actuation

The filter is the hand. The controller is the brain.

```
signal → analyze → decide → filter → signal
            ↑                          |
            └──────────────────────────┘
```

Static filter = solved mathematics. The frontier is: **who controls the parameters, based on what knowledge?**

### Concrete application ideas

**Spectral imprinting / timbral transfer**
Record spectral signature of a source (Stradivarius, vintage amp, specific room). Express as filter chain (EQ curve matching via biquad cascade). Apply to another signal in real-time. Measurable, reproducible. Style transfer for audio — not neural nets, just measured filter curves. Could be a module: `spectralMatch(sourceFFT, targetFFT) → sos[]`.

**Adaptive feedback suppression (defeedback)**
FFT the signal → detect peaks that grow over time → deploy narrow notch filters at those frequencies → repeat. The controller tracks resonance buildup; filters are the actuators. Combine: analysis (FFT) + detection (peak tracking with hysteresis) + action (dynamic notch bank). No single filter does this — it's the combination.

**Psychoacoustic level-dependent EQ**
Filters shaped by perceptual loudness contours, not frequency alone. "Perceived-flat" at 40dB SPL ≠ perceived-flat at 80dB SPL (equal-loudness contours, ISO 226). The controller adapts EQ based on playback level. This is what loudness compensation should be but rarely is — volume-dependent EQ, not just volume scaling. Module: `loudnessEQ(spl, fs) → sos[]` that returns appropriate compensation for current listening level.

**Sympathetic resonance modeling**
Bank of resonant filters (high-Q biquads) tuned to harmonics of a target instrument. Excite with another signal — like piano strings resonating when you sing near them. Computable as parallel bank of peaking EQs with high Q. Applications: physical modeling, sympathetic string simulation, body resonance, room tone.

**Environment-aware real-time correction**
Microphone + speaker + room = a system. Continuously identify room transfer function via adaptive filter (LMS/NLMS with known reference signal). Continuously compensate. Exists in high-end conference systems, not consumer audio. The barrier isn't the filter — it's the identification loop. Module: `adaptiveEQ(referenceSignal, measuredSignal) → sos[]` updated per block.

**Neural network as filter controller**
RNNoise/DTLN pattern: neural network outputs per-frame gains for a filter bank. The "filter" is trivial (multiply frequency bins or set biquad gains); the intelligence is in what to suppress. Generalizes to: any perceptual task where the decision is "how much of each frequency band to keep." The library provides the filter bank; the AI provides the gains.

**Spectral envelope preservation during pitch shift**
Track formants (peaks in spectral envelope via LPC or cepstral analysis) → shift pitch → re-impose original formant structure via EQ. Filters as actuators of a perceptual model. Without this, pitch-shifted speech sounds like chipmunks.

**Inverse filtering / deconvolution**
Measure system impulse response (room, speaker, microphone) → compute inverse filter → convolve to cancel coloration. Used in room correction (Dirac, Sonarworks). The filter is convolution; the intelligence is in which corrections to apply (cut peaks, don't boost nulls).

**Multiband dynamics via filter splitting**
Split signal into N bands (Linkwitz-Riley crossover) → apply independent dynamics processing per band (compression, expansion, gating) → sum. This is how multiband compressors work. The crossover filters are static; the dynamics processors are signal-dependent. Extends to: multiband saturation, multiband transient shaping, multiband stereo width.

**Vocoder / cross-synthesis**
Two filter banks (analysis + synthesis), same center frequencies. Analysis bank extracts envelope of modulator signal. Synthesis bank resynthesizes carrier signal with modulator's spectral shape. Classic vocoder effect. The combination of parallel bandpass + envelope follower + gain modulation.

**Physical modeling via waveguide filters**
Delay line + lowpass filter in feedback = plucked string (Karplus-Strong). Multiple coupled delay-filter networks = acoustic instruments, rooms, resonant structures. The filter provides the frequency-dependent loss; the delay provides the pitch. Allpass filters add dispersion (stiffness in strings, inharmonicity in piano).

**Filter as encoder (LPC principle)**
Instead of transmitting raw audio, encode the filter parameters that would transform an excitation signal into the target. This is LPC speech coding: encode the vocal tract filter (10-14 coefficients per frame) + excitation (pitch + gain). Generalized: any signal with stable spectral structure can be encoded as "excitation + time-varying filter." Extreme compression for signals with predictable spectral envelopes.

### Any spectrum is reproducible

Yes. Fundamental theorem: any target frequency response can be approximated arbitrarily closely by a cascade of biquad sections. A parametric EQ with enough bands can sculpt any spectral shape. This is how room correction works: measure → compute inverse → deploy as biquad chain.

### What the library enables

The library provides the actuators. The value multiplier is the controller — whether that's a simple LFO, an envelope follower, an FFT-based analyzer, or a neural network. The library's job is to make the actuators correct, fast, and composable. The applications above are all combinations of: analysis (freqz, FFT) + decision (algorithm or AI) + actuation (filter, filter bank, cascade).

---

## 11. TRANSFORM PIPELINE

Added `transform.js` — the unified analog→digital conversion pipeline:

```
prototype poles → analog transform (LP→HP/BP/BS) → bilinear → digital SOS
```

- `polesSos(poles, fc, fs, type)` — all-pole prototypes (Butterworth, Chebyshev, Bessel)
- `poleZerosSos(poles, zeros, fc, fs, type)` — with finite zeros (Elliptic, Cheby II)
- LP/HP: proven bilinear formulas
- BP: proper LP→BP transform with zeros at origin, gain normalization
- BS: proper LP→BS transform with zeros at ±jω₀

All three filter families (Butterworth, Chebyshev, Bessel) refactored to use this pipeline. Each module now only defines its prototype poles — the rest is shared.

**Bug found and fixed**: Butterworth damping coefficient used `cos` instead of `sin` — gave wrong -3dB frequency for all odd orders (3,5,7,9). Order 3 was 597 Hz instead of 1000 Hz.
