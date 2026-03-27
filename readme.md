# digital-filter [![test](https://github.com/audiojs/digital-filter/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/digital-filter/actions/workflows/test.yml) [![npm](https://img.shields.io/npm/v/digital-filter)](https://www.npmjs.com/package/digital-filter) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Digital filter design and processing –
[IIR](#iir) (Butterworth, Chebyshev, Elliptic, Bessel),
[FIR](#fir) (window, least-squares, equiripple),
[smoothing](#smooth),
[adaptive](#adaptive),
[multirate](#multirate).

## Install

```
npm install digital-filter
```

```js
import { butterworth, filter, freqz, mag2db } from 'digital-filter'

let sos = butterworth(4, 1000, 44100)
filter(data, { coefs: sos })
let dB = mag2db(freqz(sos, 512, 44100).magnitude)
```

Or import individual modules directly:

```js
import butterworth from 'digital-filter/iir/butterworth.js'
import firwin from 'digital-filter/fir/firwin.js'
```

> For audio-domain filters (weighting, EQ, synth, measurement) see [audio-filter](https://github.com/audiojs/audio-filter).


## Reading the plots

Each filter shows four panels. **Magnitude** (top-left) – how much of each frequency passes through, in dB. 0 dB = unchanged, –3 dB = half power (the conventional cutoff), –40 dB = 1%. **Phase** (top-right) – how much each frequency is delayed in degrees. Constant slope = linear phase = waveform preserved. **Group delay** (bottom-left) – the derivative of phase; shows delay variation across frequency in samples. Flat = no distortion. **Impulse response** (bottom-right) – the filter's output when fed a single 1-sample pulse; its "fingerprint."

The formulas describe the filter's frequency response. $|H(j\omega)|^2$ is the squared magnitude as a function of analog frequency $\omega$ – it defines the shape of the passband/stopband. $H(z)$ is the digital transfer function – what the code computes per sample. $h[n]$ is the impulse response – the FIR coefficients directly.

The dashed vertical line marks the cutoff frequency $f_c$.


## IIR

IIR filters use feedback – efficient (5–20 multiplies for a sharp lowpass), low latency, nonlinear phase. Designed from analog prototypes via the bilinear transform, implemented as cascaded second-order sections (SOS).[^sos]

[^sos]: Direct form above order ~6 loses precision with float64. Cascaded biquads don't.

### `biquad`

Nine second-order filter types – the building block for everything else. Every parametric EQ, every crossover, every Butterworth cascade is made of these.[^rbj]

[^rbj]: Robert Bristow-Johnson, [Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/), 1998.

* `biquad.lowpass(fc, Q, fs)` · `highpass` · `bandpass` · `bandpass2` · `notch` · `allpass`
* `biquad.peaking(fc, Q, fs, dBgain)` · `lowshelf` · `highshelf`

Digital transfer function: $H(z) = (b_0 + b_1 z^{-1} + b_2 z^{-2}) / (1 + a_1 z^{-1} + a_2 z^{-2})$. The numerator zeros set the nulls, denominator poles set the resonances. Q controls the peak width – 0.707 is Butterworth-flat, higher values produce a sharper resonance.

<img src="plots/biquad-types.svg">

### `svf(data, params)`

State variable filter. Same 2nd-order transfer function as a biquad, but the trapezoidal integration topology allows zero-delay feedback – safe for per-sample parameter modulation (LFO, envelope). Six simultaneous outputs from one computation. Simper/Cytomic (2011). Params: `fc`, `Q`, `fs`, `type`.

Coefficients: $g = \tan(\pi f_c/f_s)$, $k = 1/Q$. Equivalent to bilinear-transformed biquad.

<img src="plots/svf-lowpass.svg">

### `butterworth(order, fc, fs, type?)`

Maximally flat magnitude – no ripple anywhere. The safe default for anti-aliasing, crossovers, general-purpose filtering. Butterworth (1930).[^bw]

[^bw]: S. Butterworth, "On the Theory of Filter Amplifiers," *Wireless Engineer*, 1930.

Analog prototype: $|H(j\omega)|^2 = 1/(1 + (\omega/\omega_c)^{2N})$ – the magnitude squared drops monotonically. At $\omega = \omega_c$ it equals 0.5 (–3 dB). Poles at $s_k = \omega_c \cdot e^{j\pi(2k+N+1)/(2N)}$, uniformly spaced on a circle.
**–3 dB at fc · –6N dB/oct slope · 10.9% overshoot at order 4 · 73 samples settling**

<img src="plots/butterworth.svg">

### `chebyshev(order, fc, fs, ripple?, type?)`

Steeper cutoff than Butterworth for the same order – at the cost of passband ripple. When you need a sharper edge and can tolerate small amplitude variations.

Analog prototype: $|H(j\omega)|^2 = 1/(1 + \varepsilon^2 T_N^2(\omega/\omega_c))$ where $T_N$ is the Nth Chebyshev polynomial – it oscillates in the passband (causing ripple) then grows fast in the stopband (steep rolloff). $\varepsilon = \sqrt{10^{R_p/10} - 1}$ controls the ripple depth.
**Default 1 dB ripple · –34 dB at 2× fc · 8.7% overshoot · 256 samples settling**

<img src="plots/chebyshev.svg">

### `chebyshev2(order, fc, fs, attenuation?, type?)`

Flat passband, equiripple stopband. The ripple goes into the rejection region instead. Best when passband must be perfectly flat but you don't care about exact stopband shape.

Analog prototype: $|H(j\omega)|^2 = 1/(1 + 1/(\varepsilon^2 T_N^2(\omega_c/\omega)))$ – inverse of Type I. Zeros on the $j\omega$ axis create notches that enforce the stopband floor.
**Flat passband · –40 dB stopband floor · –40 dB at 2× fc**

<img src="plots/chebyshev2.svg">

### `elliptic(order, fc, fs, ripple?, attenuation?, type?)`

Sharpest transition for a given order – ripple in both passband and stopband. A 4th-order elliptic matches a 7th-order Butterworth in transition width. Cauer (1958).[^cauer]

[^cauer]: W. Cauer, *Synthesis of Linear Communication Networks*, 1958.

Analog prototype: $|H(j\omega)|^2 = 1/(1 + \varepsilon^2 R_N^2(\omega/\omega_c))$ where $R_N$ is a rational Chebyshev (Jacobi elliptic) function – optimal distribution of error between passband and stopband.
**Default 1 dB ripple, 40 dB attenuation · –40 dB at 2× fc · 10.6% overshoot**

<img src="plots/elliptic.svg">

### `bessel(order, fc, fs, type?)`

Maximally flat group delay – preserves waveform shape with near-zero overshoot. The choice for biomedical signals (ECG, EEG), control systems, and anywhere ringing distorts the measurement. Thomson (1949).[^thomson]

[^thomson]: W.E. Thomson, "Delay Networks Having Maximally Flat Frequency Characteristics," *Proc. IEE*, 1949.

Analog prototype: $H(s) = \theta_N(0)/\theta_N(s/\omega_c)$ where $\theta_N$ is the reverse Bessel polynomial. Poles cluster near the negative real axis, producing the flattest possible group delay.
**–3 dB at fc · –14 dB at 2× fc (gentlest rolloff) · 0.9% overshoot · 28 samples settling**

<img src="plots/bessel.svg">

### `legendre(order, fc, fs, type?)`

Steepest monotonic (ripple-free) rolloff. The sweet spot between Butterworth (gentle) and Chebyshev (sharp but rippled). Papoulis (1958), Bond (2004).[^papoulis]

[^papoulis]: A. Papoulis, "Optimum Filters with Monotonic Response," *Proc. IRE*, 1958.

Analog prototype: $|H(j\omega)|^2 = 1 - P_N(1 - 2(\omega/\omega_c)^2)$ where $P_N$ is an optimized Legendre polynomial that maximizes the rolloff slope while keeping it monotonic.
**–3 dB at fc · –31 dB at 2× fc · no ripple · 11.3% overshoot**

<img src="plots/legendre.svg">

### `linkwitzRiley(order, fc, fs)`

Crossover: LP + HP sum to perfectly flat magnitude. The standard for loudspeaker crossovers and multi-band processing. Two cascaded Butterworth filters. Linkwitz & Riley (1976).[^lr] Returns `{ low, high }`. Order must be even (2, 4, 6, 8).

[^lr]: S.H. Linkwitz, "Active Crossover Networks for Noncoincident Drivers," *JAES*, 1976.

**–6 dB at fc (both bands) · bands sum to 0 dB at all frequencies**

<img src="plots/linkwitz-riley-low.svg">

### `iirdesign(fpass, fstop, rp?, rs?, fs?)`

Give it your specs (passband edge, stopband edge, max ripple, min rejection) and it picks the best family and minimum order automatically. Returns `{ sos, order, type }`.

### IIR comparison

All at order 4, $f_c = 1\text{kHz}$, $f_s = 44100\text{Hz}$:

<img src="plots/iir-comparison.svg">

| | Butterworth | Chebyshev I | Chebyshev II | Elliptic | Bessel | Legendre |
|---|---|---|---|---|---|---|
| **Passband** | Flat | 1 dB ripple | Flat | 1 dB ripple | Flat (soft) | Flat |
| **@2 kHz** | –24 dB | –34 dB | –40 dB | –40 dB | –14 dB | –31 dB |
| **Overshoot** | 10.9% | 8.7% | 13.0% | 10.6% | **0.9%** | 11.3% |
| **Best for** | General | Sharp cutoff | Flat pass | Min order | No ringing | Sharp, no ripple |


## FIR

Finite impulse response – no feedback, always stable. Symmetric coefficients give perfect linear phase. The tradeoff: more taps = sharper cutoff = more latency. All design functions return `Float64Array`.

### `firwin(numtaps, cutoff, fs, opts?)`

Window method FIR – truncated ideal lowpass (sinc) multiplied by a window function. Impulse response: $h[n] = \sin(\omega_c n)/(\pi n) \cdot w[n]$ – the sinc gives the ideal brick-wall response, the window smooths the truncation. Supports `lowpass`, `highpass`, `bandpass`, `bandstop`. Default window: Hamming (–43 dB sidelobes).
**Linear phase · delay = (N–1)/2 samples**

<img src="plots/firwin-lp.svg">

### `firls(numtaps, bands, desired, weight?)`

Least-squares optimal – minimizes total squared error between actual and desired response. Smoother transitions than remez, better for audio where average error matters more than worst-case.
**Linear phase · smooth transition · no equiripple**

<img src="plots/firls.svg">

### `remez(numtaps, bands, desired, weight?)`

Parks-McClellan equiripple – minimizes peak error: $\min \max_\omega |W(\omega)(H(\omega) - D(\omega))|$. Narrowest transition band for a given number of taps. Parks & McClellan (1972).[^pm]
**Linear phase · equiripple error · sharpest cutoff per tap**

[^pm]: T.W. Parks, J.H. McClellan, "Chebyshev Approximation for Nonrecursive Digital Filters," *IEEE Trans.*, 1972.

<img src="plots/remez.svg">

### `firwin2(numtaps, freq, gain, opts?)`

Arbitrary magnitude response via frequency sampling. Specify gain at any set of frequency points. Used for custom EQ curves, matching measured responses.
**Linear phase · any shape**

<img src="plots/firwin2.svg">

### `hilbert(N)`

90° phase shift at unity magnitude. Impulse response: $h[n] = 2/(\pi n)$ for odd $n$, $0$ for even. Combine with the original to get the analytic signal (instantaneous amplitude + frequency). Used in envelope extraction, SSB modulation, pitch detection.
**Linear phase · zero at DC and Nyquist**

<img src="plots/hilbert.svg">

### `differentiator(N, opts?)`

FIR derivative: $h[n] = (-1)^n/n$ windowed. Discrete derivative with better noise immunity than a first difference. Used in edge detection, rate-of-change, velocity from position.
**Antisymmetric · linear phase**

<img src="plots/differentiator.svg">

### `raisedCosine(N, beta?, sps?, opts?)`

Pulse shaping for digital communications (QAM, PSK, OFDM). Zero intersymbol interference at symbol centers. $\beta$ controls excess bandwidth: 0 = minimum bandwidth (long ringing), 0.35 = standard, 1 = widest. `root: true` for matched TX/RX pair.

<img src="plots/raised-cosine.svg">

### `gaussianFir(N, bt?, sps?)`

Gaussian pulse shaping – the standard for GMSK (GSM) and Bluetooth. More spectrally compact than raised cosine at the cost of some ISI. BT=0.3 for GMSK.

<img src="plots/gaussian-fir.svg">

### `matchedFilter(template)`

Optimal detector for a known waveform in white noise. Time-reversed, energy-normalized template – maximizes SNR at the detection point. Used in radar, sonar, preamble detection.

<img src="plots/matched-filter.svg">

### `minimumPhase(h)`

Convert linear-phase FIR to minimum-phase via cepstral method. Same magnitude response, approximately half the delay. Useful when FIR latency is too high and linear phase is not required.

<img src="plots/minimum-phase.svg">

### `yulewalk(order, frequencies, magnitudes)`

IIR approximation of an arbitrary magnitude response via Yule-Walker (autocorrelation) method. When you have a target curve and want an IIR (not FIR) filter. Returns `{ b, a }`.

<img src="plots/yulewalk.svg">

### `kaiserord(deltaF, attenuation)`

Estimate FIR filter length and Kaiser $\beta$ from specifications. Give it transition width (fraction of Nyquist) and desired attenuation (dB), get `{ numtaps, beta }`. Feed into `firwin`.

### `integrator(rule?)`

Newton-Cotes quadrature coefficients. Convolve with signal to integrate. Rules: `rectangular` [1], `trapezoidal` [0.5, 0.5], `simpson` [1/6, 4/6, 1/6], `simpson38` [1/8, 3/8, 3/8, 1/8].

<img src="plots/integrator.svg">

### `lattice(data, params)`

Lattice/ladder IIR using reflection coefficients (PARCOR). Each stage is guaranteed stable when $|k_i| < 1$. Used in speech coding (LPC synthesis) and high-precision filtering. Params: `k`, `v`.

### `warpedFir(data, params)`

Frequency-warped FIR – allpass delay elements instead of unit delays concentrate resolution at low frequencies. Used in perceptual audio coding and efficient EQ. Params: `coefs`, `lambda` (~0.7 for 44.1 kHz).


## Smooth

Smoothing and denoising. All operate in-place: `fn(data, params) → data`.

### `onePole(data, params)`

Exponential moving average – the simplest IIR smoother. One multiply per sample, no overshoot. Difference equation: $y[n] = (1-a)\,x[n] + a\,y[n-1]$ where $a = e^{-2\pi f_c/f_s}$. Transfer function: $H(z) = (1-a)/(1-az^{-1})$. Params: `fc`, `fs`.
**–6 dB/oct · 1 multiply · IIR (infinite settling)**

<img src="plots/one-pole.svg">

### `movingAverage(data, params)`

Boxcar average of last N samples. $h[n] = 1/N$ for $n = 0..N-1$, $H(z) = (1 - z^{-N})/(N(1 - z^{-1}))$. Excellent for removing periodic noise when N matches the period. Params: `memory`.
**Linear phase · FIR · N multiplies · nulls at multiples of fs/N**

<img src="plots/moving-average.svg">

### `leakyIntegrator(data, params)`

Exponential decay accumulator. $y[n] = \lambda\,y[n-1] + (1-\lambda)\,x[n]$. Same as onePole but parameterized by decay factor $\lambda$ (0–1) instead of cutoff frequency. Params: `lambda`.
**1 multiply · IIR**

<img src="plots/leaky-integrator.svg">

### `median(data, params)`

Nonlinear – replaces each sample with the median of its neighborhood. Removes impulse noise (clicks, pops, outliers) while preserving edges and steps. Used in click removal, sensor outlier rejection, image denoising. Params: `size`.
**Nonlinear · no formula · preserves edges · O(N log N) per sample**

### `savitzkyGolay(data, params)`

Polynomial fit to sliding window – smooths noise while preserving peak height, width, and shape. The standard in spectroscopy, chromatography, and any measurement where peak distortion matters. Also computes smooth derivatives. Savitzky & Golay (1964).[^sg] Params: `windowSize`, `degree`, `derivative`.
**FIR · linear phase · preserves moments up to degree**

[^sg]: A. Savitzky, M.J.E. Golay, "Smoothing and Differentiation of Data," *Analytical Chemistry*, 1964.

<img src="plots/savitzky-golay.svg">

### `gaussianIir(data, params)`

Recursive Gaussian approximation (Young-van Vliet). O(1) cost regardless of kernel size – when sigma=100, FIR needs 600+ taps; this uses 6 multiplies. Forward-backward pass for zero phase. Params: `sigma`.
**IIR · zero phase (offline) · O(1) per sample**

<img src="plots/gaussian-iir.svg">

### `oneEuro(data, params)`

Adaptive lowpass – cutoff increases with signal speed. Smooth at rest, responsive when moving. Used for mouse/touch/gaze input, sensor fusion. Casiez et al. (2012).[^euro] Params: `minCutoff`, `beta`, `dCutoff`, `fs`.
**Adaptive · 1st-order IIR with time-varying cutoff**

[^euro]: G. Casiez et al., "1€ Filter," *CHI*, 2012.

### `dynamicSmoothing(data, params)`

Self-adjusting SVF – cutoff adapts to signal speed. Like oneEuro but at audio rate, for smoothing parameter changes without zipper noise. Params: `minFc`, `maxFc`, `sensitivity`, `fs`.
**Adaptive · 2nd-order SVF with time-varying cutoff**

<img src="plots/dynamic-smoothing.svg">


## Adaptive

Filters that learn from a reference signal. Returns filtered output; `params.error` contains the error signal; `params.w` updated in place.

### `lms(input, desired, params)`

Least Mean Squares – stochastic gradient descent. Update rule: $\mathbf{w}[n+1] = \mathbf{w}[n] + \mu\,e[n]\,\mathbf{x}[n]$ where $e[n] = d[n] - \mathbf{w}^T\mathbf{x}[n]$. Convergence requires $0 < \mu < 2/(N\sigma_x^2)$. Widrow & Hoff (1960).[^lms] Params: `order`, `mu`.
**O(N)/sample · slow convergence · very robust**

[^lms]: B. Widrow, M.E. Hoff, "Adaptive Switching Circuits," *IRE WESCON*, 1960.

<img src="plots/lms.svg">

### `nlms(input, desired, params)`

Normalized LMS – step size adapts to input power: $\mathbf{w}[n+1] = \mathbf{w}[n] + \mu\,e[n]\,\mathbf{x}[n] / (\mathbf{x}^T\mathbf{x} + \varepsilon)$. Convergence: $0 < \mu < 2$ regardless of input level. The practical default for echo cancellation, noise cancellation, system identification. Params: `order`, `mu` (0–2), `eps`.
**O(N)/sample · medium convergence · robust**

<img src="plots/nlms.svg">

### `rls(input, desired, params)`

Recursive Least Squares – fastest convergence (~2N samples) via inverse correlation matrix. Use when the filter must lock on fast (rapidly changing echo paths, fast channel tracking). Params: `order`, `lambda`, `delta`.
**O(N²)/sample · fast convergence · fragile if lambda is wrong · use for N ≤ 64**

<img src="plots/rls.svg">

### `levinson(R, order?)`

Levinson-Durbin recursion – solves Toeplitz system for LPC coefficients from autocorrelation. Used in speech coding (CELP, LPC-10), AR spectral estimation, linear prediction. Returns `{ a, error, k }` (prediction coefficients, error power, reflection coefficients).
**O(N²)/block · batch (not real-time)**


## Multirate

Change sample rates without aliasing. Anti-alias before you decimate, anti-image after you interpolate. Polyphase decomposition for efficiency, fractional delays for physical models.

### `decimate(data, factor, opts?)`

Anti-alias FIR lowpass + downsample by factor M. The right way to reduce sample rate – filters before dropping samples to prevent aliasing. Returns shorter `Float64Array`.

<img src="plots/decimate.svg">

### `interpolate(data, factor, opts?)`

Upsample by factor L + anti-image FIR lowpass. Inserts zeros then smooths – the right way to increase sample rate. Returns longer `Float64Array`.

<img src="plots/interpolate.svg">

### `halfBand(numtaps?)`

Half-band FIR – nearly half the coefficients are exactly zero, halving the multiply count. The efficient building block for 2× decimation/interpolation. Cascade for 4×, 8×, etc.

<img src="plots/half-band.svg">

### `cic(data, R, N?)`

Cascaded Integrator-Comb – multiplier-free decimation using only additions and subtractions. Ideal for high decimation ratios (10×–1000×) in hardware, SDR, and sigma-delta converters.

$$H(z) = \left(\frac{1 - z^{-RM}}{1 - z^{-1}}\right)^N$$

<img src="plots/cic.svg">

### `polyphase(h, M)`

Decompose FIR into M polyphase components – the key to efficient multirate. Instead of filtering then decimating (wasting work on discarded samples), compute only the samples you keep. Returns `Array<Float64Array>`.

<img src="plots/polyphase.svg">

### `farrow(data, params)`

Farrow fractional delay – variable delay via polynomial interpolation. The delay can change every sample without redesigning the filter. Pitch shifting, variable-rate resampling, time-stretching. Params: `delay`, `order`.

<img src="plots/farrow.svg">

### `thiran(delay, order?)`

Thiran allpass fractional delay – unity magnitude, maximally flat group delay. Fixed delay (unlike Farrow), but preserves all frequencies equally. The standard for physical modeling synthesis (waveguide strings, tubes). Returns `{ b, a }`.

<img src="plots/thiran.svg">

### `oversample(data, factor, opts?)`

Multi-stage upsampling with anti-alias FIR. Oversample before nonlinear processing (distortion, waveshaping, saturation) to push aliasing above the audible range, then decimate back.

<img src="plots/oversample.svg">


## Core

The engine – apply coefficients to data, analyze filter responses, convert between formats. Everything else builds on these.

### `filter(data, params)`

The main processor – applies SOS coefficients to data. Direct Form II Transposed, in-place. State persists in `params.state` between calls for seamless block processing. Params: `coefs`.

$$y[n] = b_0 x[n] + b_1 x[n\!-\!1] + b_2 x[n\!-\!2] - a_1 y[n\!-\!1] - a_2 y[n\!-\!2]$$

### `filtfilt(data, params)`

Zero-phase filtering – applies filter forward then backward, eliminating all phase distortion. Doubles effective order. Offline only (needs entire signal). The gold standard for measurement and analysis. Params: `coefs`.

### `convolution(signal, ir)`

Direct convolution. $(f * g)[n] = \sum_k f[k]\,g[n\!-\!k]$. Returns `Float64Array` of length N + M – 1.

### `freqz(coefs, n?, fs?)` · `mag2db(mag)`

Frequency response of SOS filter. Returns `{ frequencies, magnitude, phase }`. `mag2db`: $20\log_{10}(\text{mag})$.

### `groupDelay(coefs, n?, fs?)` · `phaseDelay(coefs, n?, fs?)`

Group delay $\tau_g = -d\phi/d\omega$ and phase delay $\tau_p = -\phi/\omega$. Returns `{ frequencies, delay }`.

### `impulseResponse(coefs, N?)` · `stepResponse(coefs, N?)`

Time-domain analysis. Returns `Float64Array`.

### `isStable(sos)` · `isMinPhase(sos)` · `isFir(sos)` · `isLinPhase(h)`

Filter property tests. Stable = poles inside unit circle. MinPhase = zeros inside. FIR = no feedback. LinPhase = symmetric coefficients.

### `sos2zpk(sos)` · `sos2tf(sos)` · `tf2zpk(b, a)` · `zpk2sos(zpk)`

Format conversion between SOS, zeros/poles/gain, and transfer function polynomials.

### `transform`

Analog prototype → digital SOS pipeline. `transform.polesSos(poles, fc, fs, type)`, `transform.poleZerosSos(poles, zeros, fc, fs, type)`, `transform.prewarp(f, fs)`.


## FAQ

**What is a filter?** A system that takes samples in and produces samples out. It does something in time (averaging, delaying) that corresponds to something in frequency (passing, cutting, boosting). The **magnitude response** shows how much of each frequency passes through.

**What is the dB scale?** Logarithmic ratio. $\text{dB} = 20\log_{10}(\text{ratio})$. 0 dB = unchanged, –3 dB = half power (the conventional cutoff), –6 dB = half amplitude, –20 dB = 10%, –60 dB = 0.1%.

**What are phase and group delay?** Magnitude tells you *how much* passes, phase tells you *when* it arrives. If all frequencies are delayed equally the waveform is preserved (**linear phase**). **Group delay** measures the delay per frequency. Constant group delay = linear phase. FIR can have linear phase; IIR cannot.

**IIR vs FIR?** IIR uses feedback – efficient (5–20 multiplies), low latency, nonlinear phase, can be unstable. FIR has no feedback – always stable, linear phase possible, needs 100–1000+ taps. Use IIR for real-time, FIR for offline or when linear phase is required.

**What are biquads and SOS?** The biquad is a 2nd-order filter with 5 coefficients. Every higher-order IIR is a cascade of biquads (**second-order sections**). Direct form above order ~6 loses precision with float64; SOS doesn't. This library returns SOS arrays by default.

**What is the bilinear transform?** Maps analog filter prototypes to digital: $s = (2/T)(z-1)/(z+1)$. All IIR design functions prewarp automatically – the cutoff you specify is the cutoff you get.

**When is a filter unstable?** When poles move outside the unit circle. Causes: coefficient quantization (use SOS, not direct form), careless parameter changes (Q → 0), feedback gain too high. Check with `isStable(sos)`. FIR is always stable.

**What is aliasing?** A digital system at sample rate $f_s$ can represent frequencies up to $f_s/2$ (Nyquist). Frequencies above Nyquist fold back as artifacts. `decimate` and `interpolate` handle anti-aliasing automatically.


## Choosing a filter

| I need to… | Use | Notes |
|---|---|---|
| Remove frequencies above/below a cutoff | `butterworth(N, fc, fs)` | Default, flat passband |
| Sharpest possible cutoff | `elliptic(N, fc, fs, rp, rs)` | Minimum order for specs |
| Sharp, passband ripple OK | `chebyshev(N, fc, fs, ripple)` | Steeper than Butterworth |
| Sharp, no ripple anywhere | `legendre(N, fc, fs)` | Between Butterworth and Chebyshev |
| Auto-select family + order | `iirdesign(fpass, fstop, rp, rs, fs)` | From specs |
| Notch out one frequency | `biquad.notch(fc, Q, fs)` | Q=30 for narrow null |
| Boost/cut a band | `biquad.peaking(fc, Q, fs, dB)` | Parametric EQ |
| Split into bands | `linkwitzRiley(4, fc, fs)` | LP+HP sum to flat |
| No ringing/overshoot | `bessel(N, fc, fs)` | Flat group delay |
| No phase distortion | `filtfilt(data, {coefs})` | Zero-phase, offline |
| Smooth a signal | `onePole(data, {fc, fs})` | Simplest |
| Smooth, preserve peaks | `savitzkyGolay(data, {windowSize, degree})` | Polynomial fit |
| Reduce sensor jitter | `oneEuro(data, params)` | Adaptive |
| Cancel echo/noise | `nlms(input, desired, params)` | Start here |
| Quick FIR | `firwin(N, fc, fs, {type})` | Window method |
| Sharp FIR | `remez(N, bands, desired)` | Parks-McClellan |
| Downsample | `decimate(data, factor)` | Anti-alias included |
| Upsample | `interpolate(data, factor)` | Anti-image included |

### IIR family decision tree

```
Linear phase needed?
├── Yes → FIR or filtfilt (offline)
└── No
    Waveform must be preserved?
    ├── Yes → bessel
    └── No
        Passband ripple OK?
        ├── Yes
        │   ├── Stopband ripple also OK? → elliptic
        │   └── Stopband monotonic → chebyshev
        └── No (passband must be flat)
            ├── Stopband ripple OK? → chebyshev2
            └── No ripple anywhere?
                ├── Steepest monotonic? → legendre
                └── Default → butterworth
```


## Recipes

### Hum removal

```js
for (let f of [60, 120, 180]) filter(data, { coefs: biquad.notch(f, 30, 44100) })
```

### Echo cancellation

```js
let params = { order: 512, mu: 0.5 }
nlms(farEnd, microphone, params)
// params.error = cleaned signal
```

### ECG filtering

```js
filter(data, { coefs: butterworth(2, 0.5, 500, 'highpass') })  // baseline wander
filter(data, { coefs: butterworth(4, 40, 500) })                 // noise
filter(data, { coefs: biquad.notch(50, 35, 500) })               // powerline
```

### Pulse shaping

```js
let htx = raisedCosine(101, 0.35, 8, { root: true })
let shaped = convolution(symbols, htx)
```

### Block processing

All stateful filters persist state between calls:

```js
let params = { coefs: butterworth(4, 1000, 44100) }
filter(block1, params)  // state persists
filter(block2, params)  // seamless
```


## Pitfalls

- **FIR when IIR suffices** – Butterworth order 4: 10 multiplies. Equivalent FIR: 100+.
- **High order when elliptic works** – elliptic 4 ≈ Butterworth 12. Use `iirdesign`.
- **Forgetting SOS** – never use high-order direct form. This library returns SOS by default.
- **filtfilt in real-time** – needs entire signal for backward pass.
- **LP+HP for crossover** – doesn't sum flat. Use `linkwitzRiley`.
- **Q too high** – Q > 10 creates tall resonance. For EQ: 0.5–8.
- **In-place** – `filter()` modifies data. Copy first: `Float64Array.from(data)`.
- **Stale state** – state persists in params. New signal → new params.


## See also

- **[audio-filter](https://github.com/audiojs/audio-filter)** – weighting, EQ, synthesis, measurement, effects
- **[window-function](https://github.com/scijs/window-function)** – 34 window functions
