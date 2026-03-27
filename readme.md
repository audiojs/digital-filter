# digital-filter [![npm](https://img.shields.io/npm/v/digital-filter.svg)](https://npmjs.org/package/digital-filter) [![test](https://github.com/scijs/digital-filter/actions/workflows/test.yml/badge.svg)](https://github.com/scijs/digital-filter/actions/workflows/test.yml) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Digital filter design and processing.
From biquad to Butterworth to adaptive, with the depth of scipy.signal and the simplicity of a single import.

> 82 modules · 164 tests · 1 dependency ([window-function](https://github.com/scijs/window-function)) · pure ESM
>
> **[Guide](docs/guide.md)** — learn, choose, apply · **[Reference](reference.md)** — full API

```js
import { butterworth, filter, freqz, mag2db } from 'digital-filter'

let sos = butterworth(4, 1000, 44100)       // design
filter(data, { coefs: sos })                 // apply
let dB = mag2db(freqz(sos, 512, 44100).magnitude)  // analyze
```

## Which filter?

| I need to... | Use | Why |
|---|---|---|
| Cut frequencies above/below a threshold | [`butterworth`](iir/) | Flat passband, no ripple, the default |
| Sharper cutoff, some ripple OK | [`chebyshev`](iir/) | Steeper than Butterworth for same order |
| Sharpest possible cutoff | [`elliptic`](iir/) | Minimum order for given specs |
| Steepest cutoff without any ripple | [`legendre`](iir/) | Between Butterworth and Chebyshev |
| Preserve waveform shape / no ringing | [`bessel`](iir/) | Maximally flat group delay |
| Remove a specific frequency (hum) | [`biquad.notch`](iir/) | Narrow null at target frequency |
| Boost/cut a frequency band | [`biquad.peaking`](iir/) | Parametric EQ bell curve |
| Split signal into frequency bands | [`linkwitzRiley`](iir/) | LP+HP sum to flat (crossover) |
| Real-time synth filter with resonance | [`svf`](iir/) | Stable at all frequencies, 6 outputs |
| Classic analog synth sound | [`moogLadder`](analog/) | -24dB/oct with self-oscillation |
| Smooth a control signal | [`onePole`](smooth/) | Simplest, no overshoot |
| Smooth data preserving peaks | [`savitzkyGolay`](smooth/) | Polynomial fit preserves shape |
| Reduce jitter in sensor/UI data | [`oneEuro`](smooth/) | Adaptive, latency-aware |
| Remove DC offset | [`dcBlocker`](misc/) | Minimal, fast |
| Remove impulse noise | [`median`](smooth/) | Nonlinear, preserves edges |
| Measure loudness (LUFS) | [`kWeighting`](weighting/) + `filter` | ITU-R BS.1770 standard |
| Cancel echo / noise adaptively | [`nlms`](adaptive/) | Normalized LMS, most practical |
| Design FIR with exact specs | [`remez`](fir/) | Parks-McClellan equiripple optimal |
| Design FIR quickly | [`firwin`](fir/) | Window method, simple and fast |
| Downsample | [`decimate`](multirate/) | Anti-alias + downsample in one step |
| Analyze hearing / cochlea | [`gammatone`](auditory/) | Standard auditory model |
| Zero-phase filtering (offline) | [`filtfilt`](core/) | Forward-backward, no phase distortion |

## Modules

### [`core/`](core/) — The engine

Process, analyze, and convert filters. Everything else builds on these.

| Module | What it does |
|---|---|
| `filter` | SOS cascade processor (Direct Form II Transposed) |
| `filtfilt` | Zero-phase forward-backward filtering |
| `convolution` | Direct convolution with impulse response |
| `freqz` / `mag2db` | Frequency response (magnitude + phase) |
| `groupDelay` / `phaseDelay` | Delay analysis |
| `impulseResponse` / `stepResponse` | Time-domain analysis |
| `isStable` / `isMinPhase` / `isFir` / `isLinPhase` | Filter properties |
| `sos2zpk` / `sos2tf` / `tf2zpk` / `zpk2sos` | Format conversion |
| `transform` | Analog prototype → digital SOS (bilinear transform) |
| `window` | 34 window functions (re-export from [window-function](https://github.com/scijs/window-function)) |

### [`iir/`](iir/) — IIR filter design

Infinite impulse response filters from analog prototypes. Return SOS coefficient arrays. The classical filter families — Butterworth, Chebyshev, Elliptic, Bessel — plus the biquad building block and state variable filter.

![IIR Comparison](plots/iir-comparison.svg)

| Module | What it does | Origin |
|---|---|---|
| `biquad` | 9 second-order types: LP, HP, BP, notch, allpass, peaking, shelves | RBJ Cookbook |
| `svf` | Trapezoidal state variable filter — safe for real-time modulation | Simper 2011 |
| `butterworth` | Maximally flat magnitude, no ripple | Butterworth 1930 |
| `chebyshev` | Equiripple passband, steeper cutoff | Chebyshev 1854 |
| `chebyshev2` | Flat passband, equiripple stopband | Inverse Chebyshev |
| `elliptic` | Sharpest transition for given order — ripple in both bands | Cauer 1958 |
| `bessel` | Maximally flat group delay — preserves waveform shape | Thomson 1949 |
| `legendre` | Steepest monotonic (ripple-free) rolloff | Papoulis 1958 |
| `iirdesign` | Auto-selects optimal family + order from specs | — |
| `linkwitzRiley` | Crossover: LP+HP sum to unity (cascaded Butterworth) | Linkwitz 1976 |

### [`fir/`](fir/) — FIR filter design

Finite impulse response filters. Always stable, linear phase by default. Return Float64Array coefficients.

| Module | What it does | Method |
|---|---|---|
| `firwin` | LP/HP/BP/BS via windowed sinc | Window method |
| `firwin2` | Arbitrary magnitude response | Frequency sampling |
| `firls` | Minimize total squared error | Least-squares |
| `remez` | Minimize peak error (equiripple) | Parks-McClellan 1972 |
| `kaiserord` | Estimate filter length from specs | Kaiser formula |
| `hilbert` | 90-degree phase shift FIR | Analytic signal |
| `minimumPhase` | Convert linear-phase to minimum-phase | Cepstral method |
| `differentiator` | FIR derivative | Windowed |
| `integrator` | Newton-Cotes quadrature coefficients | Trapezoidal/Simpson |
| `raisedCosine` | Nyquist ISI-free pulse shaping | Communications |
| `gaussianFir` | GMSK/Bluetooth pulse shaping | Gaussian |
| `matchedFilter` | Maximum SNR detection | Correlator |
| `yulewalk` | IIR from arbitrary magnitude (Yule-Walker) | Autocorrelation |
| `lattice` | Lattice/ladder structure (reflection coefficients) | LPC |
| `warpedFir` | Frequency-warped FIR (perceptual resolution) | Allpass delay |

### [`smooth/`](smooth/) — Smoothing and denoising

From simple averages to adaptive smoothers. Choose by noise model, latency requirement, and edge preservation.

| Module | What it does | Character |
|---|---|---|
| `onePole` | One-pole lowpass (EMA) — simplest IIR smoother | $y[n] = (1\!-\!a)x[n] + ay[n\!-\!1]$ |
| `movingAverage` | Boxcar average of last N samples | Linear phase, no overshoot |
| `leakyIntegrator` | Exponential decay ($\lambda$-controlled) | Same as one-pole, param-wise |
| `median` | Nonlinear — replaces with neighborhood median | Removes impulses, preserves edges |
| `savitzkyGolay` | Polynomial fit to sliding window | Preserves peaks and shapes |
| `gaussianIir` | Recursive Gaussian — O(1) regardless of sigma | Large-kernel smoothing |
| `oneEuro` | Adaptive cutoff — smooth at rest, fast when moving | Sensor/UI jitter (Casiez 2012) |
| `dynamicSmoothing` | Self-adjusting SVF cutoff | Audio parameter smoothing |

### [`adaptive/`](adaptive/) — Adaptive filters

Filters that learn from data. The weights adjust in real time to minimize error between desired and actual output.

| Module | Complexity | Convergence | Best for |
|---|---|---|---|
| `lms` | O(N)/sample | Slow | Learning, simple |
| `nlms` | O(N)/sample | Medium | Real-world default |
| `rls` | O(N^2)/sample | Fast (~2N samples) | Fast-changing systems |
| `levinson` | O(N^2)/block | Instant (batch) | LPC, speech coding |

### [`multirate/`](multirate/) — Sample rate conversion

Change sample rates, fractional delays, efficient polyphase structures.

| Module | What it does |
|---|---|
| `decimate` | Anti-alias + downsample by factor M |
| `interpolate` | Upsample + anti-image by factor L |
| `halfBand` | Half-band FIR for efficient 2x (nearly half coefficients are zero) |
| `cic` | Cascaded integrator-comb — multiplier-free, high decimation |
| `polyphase` | Decompose FIR into M polyphase components |
| `farrow` | Lagrange fractional delay (variable per sample) |
| `thiran` | Allpass fractional delay (maximally flat group delay) |
| `oversample` | Multi-stage oversampling with anti-alias |

### [`weighting/`](weighting/) — Acoustic measurement

Perceptual frequency weighting curves from international standards. Return SOS arrays for a given sample rate.

| Module | Standard | What it does |
|---|---|---|
| `aWeighting` | IEC 61672 | Human loudness perception at ~40 phon — the default for noise measurement |
| `cWeighting` | IEC 61672 | Nearly flat — peak SPL, concert venues, impulse noise |
| `kWeighting` | ITU-R BS.1770 | LUFS loudness metering (Spotify, YouTube, broadcast) |
| `itu468` | ITU-R BS.468 | Broadcast equipment noise — peaked at 6.3 kHz |
| `riaa` | IEC 98 | Vinyl playback equalization (bass boost + treble cut) |

### [`analog/`](analog/) — Virtual analog

Nonlinear models of classic analog synthesizer filters. ZDF (zero-delay feedback) topology with tanh saturation.

| Module | What it does | Character |
|---|---|---|
| `moogLadder` | 4-pole -24dB/oct cascade with resonance | Warm, fat, singing — the Moog sound |
| `diodeLadder` | TB-303 diode ladder with per-stage saturation | Squelchy acid bass |
| `korg35` | MS-20 2-pole with nonlinear feedback | Aggressive, screaming resonance |

### [`auditory/`](auditory/) — Hearing and cochlear models

Perceptual filter banks that model human hearing. For audio analysis, feature extraction, and psychoacoustic research.

| Module | What it does | Scale |
|---|---|---|
| `gammatone` | Cochlear filter (cascade of complex one-pole) | ERB (Glasberg & Moore 1990) |
| `octaveBank` | IEC 61260 fractional-octave filter bank | ISO standard frequencies |
| `erbBank` | ERB-spaced center frequencies and bandwidths | Equivalent Rectangular Bandwidth |
| `barkBank` | Bark critical band filters (Zwicker 1980) | 24 critical bands |

### [`eq/`](eq/) — Equalization and composites

Multi-band audio processing chains built from biquad cascades.

| Module | What it does |
|---|---|
| `graphicEq` | 10-band ISO octave graphic EQ |
| `parametricEq` | N-band parametric EQ with peaking + shelves |
| `crossover` | N-way Linkwitz-Riley crossover network |
| `crossfeed` | Headphone spatialization (L↔R lowpass mix) |
| `formant` | Parallel resonator bank (vowel synthesis) |
| `vocoder` | Channel vocoder (spectral envelope transfer) |

### [`misc/`](misc/) — Building blocks

Single-purpose processors that don't fit a larger class. Grab one when you need it.

| Module | What it does |
|---|---|
| `dcBlocker` | Remove DC offset — $H(z) = (1 - z^{-1})/(1 - Rz^{-1})$ |
| `comb` | Feedforward/feedback comb (flanging, reverb, Karplus-Strong) |
| `allpass` | Phase shift at unity magnitude (phaser, dispersive delay) |
| `emphasis` / `deemphasis` | Pre/de-emphasis — speech, FM broadcast |
| `resonator` | Constant-peak-gain resonator (modal/formant synthesis) |
| `envelope` | Attack/release envelope follower (compressor sidechain) |
| `slewLimiter` | Rate-of-change limiter (portamento, click prevention) |
| `noiseShaping` | Quantization error shaping for dithering |
| `pinkNoise` | 1/f spectral slope filter (Paul Kellet method) |
| `spectralTilt` | Arbitrary dB/octave slope via shelving cascade |
| `variableBandwidth` | Biquad with auto-recomputing coefficients |

<p align=center><a href="./LICENSE">MIT</a> • <a href="https://github.com/krishnized/license/">ॐ</a></p>
