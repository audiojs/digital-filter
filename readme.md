# digital-filter [![test](https://github.com/audiojs/digital-filter/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/digital-filter/actions/workflows/test.yml) [![npm](https://img.shields.io/npm/v/digital-filter)](https://www.npmjs.com/package/digital-filter) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Digital filter design and processing – from biquad to Butterworth to adaptive.

```js
import { butterworth, filter, freqz, mag2db } from 'digital-filter'

let sos = butterworth(4, 1000, 44100)       // design
filter(data, { coefs: sos })                 // apply
let dB = mag2db(freqz(sos, 512, 44100).magnitude)  // analyze
```

Or import individual modules:

```js
import butterworth from 'digital-filter/iir/butterworth.js'
```

## Reference

**IIR**<br>
[biquad](#biquad) ·
[svf](#svfdata-params) ·
[butterworth](#butterworthorder-fc-fs-type) ·
[chebyshev](#chebyshevorder-fc-fs-ripple-type) ·
[chebyshev2](#chebyshev2order-fc-fs-attenuation-type) ·
[elliptic](#ellipticorder-fc-fs-ripple-attenuation-type) ·
[bessel](#besselorder-fc-fs-type) ·
[legendre](#legendreorder-fc-fs-type) ·
[iirdesign](#iirdesignfpass-fstop-rp-rs-fs) ·
[linkwitzRiley](#linkwitzrileyorder-fc-fs)

**FIR**<br>
[firwin](#firwinnumtaps-cutoff-fs-opts) ·
[firwin2](#firwin2numtaps-freq-gain-opts) ·
[firls](#firlsnumtaps-bands-desired-weight) ·
[remez](#remeznumtaps-bands-desired-weight) ·
[kaiserord](#kaiserorddeltaf-attenuation) ·
[hilbert](#hilbertn) ·
[minimumPhase](#minimumphaseh) ·
[differentiator](#differentiatorn-opts) ·
[integrator](#integratorrule) ·
[raisedCosine](#raisedcosinen-beta-sps-opts) ·
[gaussianFir](#gaussianfirn-bt-sps) ·
[matchedFilter](#matchedfiltertemplate) ·
[yulewalk](#yulewalkorder-frequencies-magnitudes) ·
[lattice](#latticedata-params) ·
[warpedFir](#warpedfirdata-params)

**Smooth**<br>
[onePole](#onepoledata-params) ·
[movingAverage](#movingaveragedata-params) ·
[leakyIntegrator](#leakyintegratordata-params) ·
[median](#mediandata-params) ·
[savitzkyGolay](#savitzkygolaydata-params) ·
[gaussianIir](#gaussianiirdata-params) ·
[oneEuro](#oneeuropdata-params) ·
[dynamicSmoothing](#dynamicsmoothingdata-params)

**Adaptive**<br>
[lms](#lmsinput-desired-params) ·
[nlms](#nlmsinput-desired-params) ·
[rls](#rlsinput-desired-params) ·
[levinson](#levinsonr-order)

**Multirate**<br>
[decimate](#decimatedata-factor-opts) ·
[interpolate](#interpolatedata-factor-opts) ·
[halfBand](#halfbandnumtaps) ·
[cic](#cicdata-r-n) ·
[polyphase](#polypaseh-m) ·
[farrow](#farrowdata-params) ·
[thiran](#thirandelay-order) ·
[oversample](#oversampledata-factor-opts)

**Core**<br>
[filter](#filterdata-params) ·
[filtfilt](#filtfiltdata-params) ·
[convolution](#convolutionsignal-ir) ·
[freqz](#freqzcoefs-n-fs) · [mag2db](#mag2dbmag) ·
[groupDelay](#groupdelaycoefs-n-fs) · [phaseDelay](#phasedelaycoefs-n-fs) ·
[impulseResponse](#impulseresponsecoefs-n) · [stepResponse](#stepresponsecoefs-n) ·
[isStable](#isstablesos) · [isMinPhase](#isminphasesos) · [isFir](#isfirsos) · [isLinPhase](#islinphaseh) ·
[sos2zpk](#sos2zpksos) · [sos2tf](#sos2tfsos) · [tf2zpk](#tf2zpkb-a) · [zpk2sos](#zpk2soszpk) ·
[transform](#transform)

## IIR design

IIR filters use feedback — efficient (5–20 multiplies for a sharp lowpass), low latency, but nonlinear phase. All design functions return SOS (second-order section) arrays.[^sos]

[^sos]: Every IIR filter is implemented as cascaded biquads. Direct form above order ~6 loses precision; SOS doesn't.

### `biquad`

Nine second-order filter types – the building block for all higher-order IIR. Every parametric EQ, every crossover, every Butterworth cascade is made of these. RBJ Audio EQ Cookbook.[^rbj]

[^rbj]: Robert Bristow-Johnson, [Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/), 1998.

* `biquad.lowpass(fc, Q, fs)`
* `biquad.highpass(fc, Q, fs)`
* `biquad.bandpass(fc, Q, fs)`
* `biquad.bandpass2(fc, Q, fs)`
* `biquad.notch(fc, Q, fs)`
* `biquad.allpass(fc, Q, fs)`
* `biquad.peaking(fc, Q, fs, dBgain)`
* `biquad.lowshelf(fc, Q, fs, dBgain)`
* `biquad.highshelf(fc, Q, fs, dBgain)`

$$H(z) = \frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{1 + a_1 z^{-1} + a_2 z^{-2}}$$

<img src="plots/biquad-types.svg">

### `svf(data, params)`

State variable filter – the workhorse of real-time synthesis. Trapezoidal integration (Simper/Cytomic 2011) keeps it stable even when you sweep cutoff with an LFO or envelope. Produces LP/HP/BP/notch/peak/allpass simultaneously from one computation. Used in every modern soft synth. Params: `fc`, `Q`, `fs`, `type`.

$$g = \tan(\pi f_c/f_s), \quad k = 1/Q$$

<img src="plots/svf-lowpass.svg">

### `butterworth(order, fc, fs, type?)`

Maximally flat magnitude response – no ripple anywhere. The safe default when you don't know which filter to pick. Anti-aliasing, crossovers, general-purpose lowpass/highpass. Butterworth (1930).[^butterworth]

[^butterworth]: S. Butterworth, "On the Theory of Filter Amplifiers," *Wireless Engineer*, 1930.

$$|H(j\omega)|^2 = \frac{1}{1 + (\omega/\omega_c)^{2N}}$$

<img src="plots/butterworth.svg">

Poles at $s_k = \omega_c \cdot e^{j\pi(2k+N+1)/(2N)}$, uniformly spaced on a circle. Slope: $-6N$ dB/oct.

### `chebyshev(order, fc, fs, ripple?, type?)`

Steeper cutoff than Butterworth for the same order – at the cost of passband ripple. When you need a sharper edge and can tolerate small amplitude variations in the passband.

$$|H(j\omega)|^2 = \frac{1}{1 + \varepsilon^2 T_N^2(\omega/\omega_c)}, \quad \varepsilon = \sqrt{10^{R_p/10} - 1}$$

<img src="plots/chebyshev.svg">

Poles on an s-plane ellipse. Default ripple: 1 dB.

### `chebyshev2(order, fc, fs, attenuation?, type?)`

Flat passband with sharp cutoff – the ripple goes into the stopband instead. Best when passband must be perfectly flat but you don't care about the exact shape of the rejection region.

$$|H(j\omega)|^2 = \frac{1}{1 + 1/(\varepsilon^2 T_N^2(\omega_c/\omega))}$$

<img src="plots/chebyshev2.svg">

Default attenuation: 40 dB.

### `elliptic(order, fc, fs, ripple?, attenuation?, type?)`

The sharpest transition you can get for a given order – ripple in both passband and stopband. A 4th-order elliptic matches a 7th-order Butterworth in transition width. Used when filter order (= latency, cost) is the bottleneck. Cauer (1958).[^cauer]

[^cauer]: W. Cauer, *Synthesis of Linear Communication Networks*, 1958.

$$|H(j\omega)|^2 = \frac{1}{1 + \varepsilon^2 R_N^2(\omega/\omega_c)}$$

<img src="plots/elliptic.svg">

$R_N$ is a rational Chebyshev (Jacobi elliptic) function. Default: 1 dB ripple, 40 dB attenuation.

### `bessel(order, fc, fs, type?)`

Maximally flat group delay – preserves waveform shape with near-zero overshoot (0.9% at order 4). The choice for biomedical signals (ECG, EEG), control systems, and anywhere ringing distorts the measurement. Thomson (1949).[^thomson]

[^thomson]: W.E. Thomson, "Delay Networks Having Maximally Flat Frequency Characteristics," *Proc. IEE*, 1949.

$$H(s) = \frac{\theta_N(0)}{\theta_N(s/\omega_c)}$$

<img src="plots/bessel.svg">

Gentlest rolloff of all families, but best transient response. 0.9% overshoot at order 4.

### `legendre(order, fc, fs, type?)`

Steepest rolloff you can get without any ripple – the sweet spot between Butterworth (gentle) and Chebyshev (sharp but rippled). When you need sharper than Butterworth but can't tolerate ripple. Papoulis (1958), Bond (2004).[^papoulis]

[^papoulis]: A. Papoulis, "Optimum Filters with Monotonic Response," *Proc. IRE*, 1958.

$$|H(j\omega)|^2 = 1 - P_N\!\left(1 - 2(\omega/\omega_c)^2\right)$$

<img src="plots/legendre.svg">

### `iirdesign(fpass, fstop, rp?, rs?, fs?)`

Give it your specs (passband, stopband, ripple, rejection) and it picks the best family and minimum order automatically. The lazy but correct way to design an IIR filter. Returns `{ sos, order, type }`.

### `linkwitzRiley(order, fc, fs)`

Crossover filter – LP + HP sum to perfectly flat magnitude. The standard for loudspeaker crossovers and multi-band processing. Two cascaded Butterworth filters. Linkwitz & Riley (1976).[^linkwitz] Returns `{ low, high }` SOS arrays. Order must be even (2, 4, 6, 8).

[^linkwitz]: S.H. Linkwitz, "Active Crossover Networks for Noncoincident Drivers," *JAES*, 1976.

<img src="plots/linkwitz-riley-low.svg">

### IIR comparison

All at order 4, $f_c = 1\text{kHz}$, $f_s = 44100\text{Hz}$:

<img src="plots/iir-comparison.svg">

| | Butterworth | Chebyshev I | Chebyshev II | Elliptic | Bessel | Legendre |
|---|---|---|---|---|---|---|
| **Passband** | Flat | 1 dB ripple | Flat | 1 dB ripple | Flat (soft) | Flat |
| **@2 kHz** | –24 dB | –34 dB | –40 dB | –40 dB | –14 dB | –31 dB |
| **Overshoot** | 10.9% | 8.7% | 13.0% | 10.6% | **0.9%** | 11.3% |
| **Best for** | General | Sharp cutoff | Flat pass | Min order | No ringing | Sharp, no ripple |

## FIR design

FIR filters have no feedback — always stable, linear phase when symmetric. More taps = sharper cutoff = more latency. All design functions return `Float64Array` coefficients.

### `firwin(numtaps, cutoff, fs, opts?)`

Window method FIR – truncated sinc × window function. The default for 80% of FIR tasks. Quick to design, predictable, good enough for most lowpass/highpass/bandpass needs.

$$h[n] = \frac{\sin(\omega_c n)}{\pi n} \cdot w[n]$$

<img src="plots/firwin-lp.svg">

Supports `lowpass`, `highpass`, `bandpass`, `bandstop`. Default window: Hamming.

### `firwin2(numtaps, freq, gain, opts?)`

Arbitrary magnitude response via frequency sampling. Specify gain at any set of frequency points – draw any shape you want. Used for custom EQ curves, matching measured responses.

<img src="plots/firwin2.svg">

### `firls(numtaps, bands, desired, weight?)`

Least-squares optimal FIR – minimizes total squared error between actual and desired response. Smoother than remez, better for audio applications where average error matters more than worst-case.

<img src="plots/firls.svg">

### `remez(numtaps, bands, desired, weight?)`

Parks-McClellan equiripple – minimizes peak error, giving the narrowest transition band for a given number of taps. The gold standard when you have tight specs. Parks & McClellan (1972).[^pm]

[^pm]: T.W. Parks, J.H. McClellan, "Chebyshev Approximation for Nonrecursive Digital Filters," *IEEE Trans.*, 1972.

$$\min \max_\omega \left| W(\omega)(H(\omega) - D(\omega)) \right|$$

<img src="plots/remez.svg">

### `kaiserord(deltaF, attenuation)`

Don't know how many taps you need? Give it transition width and desired attenuation, get back the filter length and Kaiser $\beta$. Feed the result to `firwin`. Returns `{ numtaps, beta }`.

### `hilbert(N)`

90° phase shift at unity magnitude. The key to analytic signals – combine with the original to get instantaneous amplitude and frequency. Used in envelope extraction, SSB modulation, pitch detection.

$$h[n] = \begin{cases} 2/(\pi n) & n \text{ odd} \\ 0 & n \text{ even} \end{cases}$$

<img src="plots/hilbert.svg">

### `minimumPhase(h)`

Convert linear-phase FIR to minimum-phase via cepstral method. Same magnitude response but half the delay – useful when FIR latency is too high but you don't need linear phase.

<img src="plots/minimum-phase.svg">

### `differentiator(N, opts?)`

FIR derivative filter – discrete derivative with better noise immunity than a simple first difference. Used in edge detection, rate-of-change estimation, velocity from position data.

<img src="plots/differentiator.svg">

### `integrator(rule?)`

Newton-Cotes quadrature coefficients for numerical integration. Rules: `rectangular`, `trapezoidal`, `simpson`, `simpson38`. Convolve with signal to integrate.

### `raisedCosine(N, beta?, sps?, opts?)`

Pulse shaping for digital communications (QAM, PSK, OFDM). Zero intersymbol interference at symbol centers. `root: true` for matched TX/RX pair – root raised cosine at both ends gives full raised cosine end-to-end.

<img src="plots/raised-cosine.svg">

### `gaussianFir(N, bt?, sps?)`

Gaussian pulse shaping – the standard for GMSK (GSM) and Bluetooth. More spectrally compact than raised cosine, at the cost of some ISI. Controlled by bandwidth-time product (BT=0.3 for GMSK).

<img src="plots/gaussian-fir.svg">

### `matchedFilter(template)`

Optimal detector for a known waveform in white noise – maximizes SNR at the detection point. Time-reversed, energy-normalized template. Used in radar, sonar, and digital communications for preamble/sync detection.

<img src="plots/matched-filter.svg">

### `yulewalk(order, frequencies, magnitudes)`

IIR approximation of an arbitrary magnitude response via Yule-Walker method. When you have a target frequency curve and want an IIR filter (not FIR) to match it. Returns `{ b, a }`.

<img src="plots/yulewalk.svg">

### `lattice(data, params)`

Lattice/ladder IIR structure using reflection coefficients (PARCOR). Better numerical properties than direct form – each stage is guaranteed stable if $|k_i| < 1$. Used in speech coding (LPC synthesis) and high-precision filtering. Params: `k` (reflection), `v` (ladder, optional).

### `warpedFir(data, params)`

Frequency-warped FIR – replaces unit delays with allpass delays, concentrating resolution at low frequencies where the ear is most sensitive. Used in perceptual audio coding and efficient EQ. Params: `coefs`, `lambda` (warping factor, ~0.7 for 44.1 kHz audio).

## Smooth

Domain-agnostic smoothing and denoising. All operate in-place: `fn(data, params) → data`.

### `onePole(data, params)`

One-pole lowpass (exponential moving average) – the simplest possible IIR smoother. One parameter, one multiply, no overshoot. Reach for this first when smoothing control signals, sensor data, or parameter changes. Params: `fc`, `fs`.

$y[n] = (1-a)\,x[n] + a\,y[n\!-\!1], \quad a = e^{-2\pi f_c/f_s}$

<img src="plots/one-pole.svg">

### `movingAverage(data, params)`

Boxcar average of last N samples. Linear phase, no overshoot, excellent for removing periodic noise when N matches the period. The simplest FIR smoother. Params: `memory`.

<img src="plots/moving-average.svg">

### `leakyIntegrator(data, params)`

Exponential decay. $y[n] = \lambda\,y[n\!-\!1] + (1-\lambda)\,x[n]$. Params: `lambda`.

<img src="plots/leaky-integrator.svg">

### `median(data, params)`

Nonlinear median filter – replaces each sample with the median of its neighborhood. Removes impulse noise (clicks, pops, outliers) while preserving edges. Used in audio click removal, sensor outlier rejection, image denoising. Params: `size`.

### `savitzkyGolay(data, params)`

Polynomial fit to sliding window – smooths noise while preserving peak height, width, and shape. The standard in spectroscopy, chromatography, and any measurement where peak distortion is unacceptable. Also computes smooth derivatives. Savitzky & Golay (1964).[^sg] Params: `windowSize`, `degree`, `derivative`.

[^sg]: A. Savitzky, M.J.E. Golay, "Smoothing and Differentiation of Data," *Analytical Chemistry*, 1964.

<img src="plots/savitzky-golay.svg">

### `gaussianIir(data, params)`

Recursive Gaussian smoothing (Young-van Vliet) – O(1) cost regardless of kernel size. When you need Gaussian blur with sigma=100, FIR needs 600+ taps; this needs 6 multiplies. Forward-backward for zero phase. Params: `sigma`.

<img src="plots/gaussian-iir.svg">

### `oneEuro(data, params)`

Adaptive lowpass – cutoff increases with signal speed. Smooth at rest, responsive when moving. The go-to for mouse/touch/gaze input, sensor fusion, any UI where you want low jitter without sluggish response. Casiez et al. (2012).[^euro] Params: `minCutoff`, `beta`, `dCutoff`, `fs`.

[^euro]: G. Casiez et al., "1€ Filter," *CHI*, 2012.

### `dynamicSmoothing(data, params)`

Self-adjusting SVF – cutoff adapts to signal speed. Like oneEuro but at audio rate. Smooth knob/fader movements without zipper noise while keeping transients snappy. Params: `minFc`, `maxFc`, `sensitivity`, `fs`.

<img src="plots/dynamic-smoothing.svg">

## Adaptive

Filters that learn. Weights adjust in real time to minimize error between desired and actual output. Returns filtered output; `params.error` contains error signal; `params.w` updated in place.

### `lms(input, desired, params)`

Least Mean Squares – the original adaptive algorithm. Simple stochastic gradient descent on MSE. Educational, but in practice almost always use NLMS instead (self-normalizing). Widrow & Hoff (1960).[^lms] Params: `order`, `mu`.

[^lms]: B. Widrow, M.E. Hoff, "Adaptive Switching Circuits," *IRE WESCON*, 1960.

$$\mathbf{w}[n+1] = \mathbf{w}[n] + \mu\,e[n]\,\mathbf{x}[n]$$

O(N)/sample. Convergence condition: $0 < \mu < 2/(N\sigma_x^2)$.

<img src="plots/lms.svg">

### `nlms(input, desired, params)`

Normalized LMS – self-normalizing step size that adapts to input power. The practical default. Start here for echo cancellation, noise cancellation, system identification, channel equalization. Params: `order`, `mu` (0–2), `eps`.

$$\mathbf{w}[n+1] = \mathbf{w}[n] + \frac{\mu\,e[n]\,\mathbf{x}[n]}{\mathbf{x}^T\mathbf{x} + \varepsilon}$$

O(N)/sample. Convergence: $0 < \mu < 2$ (independent of input power).

<img src="plots/nlms.svg">

### `rls(input, desired, params)`

Recursive Least Squares – fastest convergence (~2N samples) via inverse correlation matrix. When you need the filter to lock on fast (rapidly changing echo paths, fast channel tracking). O(N²)/sample – use for short filters (N ≤ 64). Params: `order`, `lambda`, `delta`.

<img src="plots/rls.svg">

### `levinson(R, order?)`

Levinson-Durbin recursion – solves Toeplitz system for LPC coefficients from autocorrelation. The foundation of speech coding (CELP, LPC-10), AR spectral estimation, and linear prediction. Returns `{ a, error, k }` (prediction coefficients, error power, reflection coefficients). O(N²)/block.

## Multirate

Sample rate conversion, fractional delays, polyphase structures.

### `decimate(data, factor, opts?)`

Anti-alias FIR lowpass + downsample by factor M. The right way to reduce sample rate – filters before dropping samples to prevent aliasing. Returns shorter `Float64Array`.

<img src="plots/decimate.svg">

### `interpolate(data, factor, opts?)`

Upsample by factor L + anti-image FIR lowpass. Inserts zeros then smooths – the right way to increase sample rate. Returns longer `Float64Array`.

<img src="plots/interpolate.svg">

### `halfBand(numtaps?)`

Half-band FIR – nearly half the coefficients are exactly zero, halving the multiply count. The efficient building block for 2× decimation/interpolation. Cascade multiple stages for 4×, 8×, etc.

<img src="plots/half-band.svg">

### `cic(data, R, N?)`

Cascaded Integrator-Comb – multiplier-free decimation using only additions and subtractions. Ideal for high decimation ratios (10×–1000×) in hardware, SDR, and sigma-delta converters. Sinc-shaped passband droop needs compensation for precision work.

$$H(z) = \left(\frac{1 - z^{-RM}}{1 - z^{-1}}\right)^N$$

<img src="plots/cic.svg">

### `polyphase(h, M)`

Decompose FIR into M polyphase components – the key to efficient multirate filtering. Instead of filtering then decimating (wasting work on samples you'll discard), compute only the output samples you keep. Returns `Array<Float64Array>`.

<img src="plots/polyphase.svg">

### `farrow(data, params)`

Farrow fractional delay – variable delay via polynomial interpolation. The delay can change every sample without redesigning the filter. Used in pitch shifting, variable-rate resampling, and time-stretching. Params: `delay`, `order`.

<img src="plots/farrow.svg">

### `thiran(delay, order?)`

Thiran allpass fractional delay – unity magnitude, maximally flat group delay. Fixed delay (unlike Farrow), but preserves all frequencies equally. The standard for physical modeling synthesis (waveguide strings, tubes). Returns `{ b, a }`.

<img src="plots/thiran.svg">

### `oversample(data, factor, opts?)`

Multi-stage upsampling with anti-alias FIR. Oversample before nonlinear processing (distortion, waveshaping, saturation) to push aliasing products above the audible range, then decimate back.

<img src="plots/oversample.svg">

## Core

The engine — processing, analysis, conversion. Everything else builds on these.

### `filter(data, params)`

The main processor – applies SOS coefficients to data. Direct Form II Transposed, in-place. State persists in `params.state` between calls for seamless block processing. Params: `coefs` (SOS array).

$$y[n] = b_0 x[n] + b_1 x[n\!-\!1] + b_2 x[n\!-\!2] - a_1 y[n\!-\!1] - a_2 y[n\!-\!2]$$

### `filtfilt(data, params)`

Zero-phase filtering – applies filter forward then backward, eliminating all phase distortion. Doubles effective order. Offline only (needs entire signal). The gold standard for measurement and analysis. Params: `coefs`.

### `convolution(signal, ir)`

Direct convolution. Returns `Float64Array` of length N + M – 1.

$(f * g)[n] = \sum_k f[k]\,g[n-k]$

### `freqz(coefs, n?, fs?)`

Frequency response of SOS filter. Returns `{ frequencies, magnitude, phase }`.

### `mag2db(mag)`

Magnitude to decibels. $20\log_{10}(\text{mag})$.

### `groupDelay(coefs, n?, fs?)`

Group delay: $\tau_g(\omega) = -d\phi/d\omega$. Returns `{ frequencies, delay }`.

### `phaseDelay(coefs, n?, fs?)`

Phase delay: $\tau_p(\omega) = -\phi(\omega)/\omega$. Returns `{ frequencies, delay }`.

### `impulseResponse(coefs, N?)`

Compute impulse response of SOS filter. Returns `Float64Array`.

### `stepResponse(coefs, N?)`

Compute step response. Returns `Float64Array`.

### `isStable(sos)` · `isMinPhase(sos)` · `isFir(sos)` · `isLinPhase(h)`

Filter property tests. Stable = all poles inside unit circle. MinPhase = all zeros inside. FIR = no feedback (a1=a2=0). LinPhase = symmetric/antisymmetric coefficients.

### `sos2zpk(sos)` · `sos2tf(sos)` · `tf2zpk(b, a)` · `zpk2sos(zpk)`

Format conversion between SOS, zeros/poles/gain, and transfer function polynomials.

### `transform`

Analog prototype → digital SOS pipeline. `transform.polesSos(poles, fc, fs, type)`, `transform.poleZerosSos(poles, zeros, fc, fs, type)`, `transform.prewarp(f, fs)`.

## See also

- **[audio-filter](https://github.com/audiojs/audio-filter)** — audio and acoustic filters (weighting, EQ, synthesis, measurement) built on digital-filter
- **[window-function](https://github.com/scijs/window-function)** — 34 window functions for spectral analysis
