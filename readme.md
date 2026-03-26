# digital-filter [![npm](https://img.shields.io/npm/v/digital-filter.svg)](https://npmjs.org/package/digital-filter) [![test](https://github.com/scijs/digital-filter/actions/workflows/test.yml/badge.svg)](https://github.com/scijs/digital-filter/actions/workflows/test.yml) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Digital filter design and processing for JavaScript — from biquad to Butterworth to adaptive, with the depth of scipy.signal and the simplicity of a single import.

> 82 modules · 164 tests · 1 dependency ([window-function](https://github.com/scijs/window-function)) · pure ESM
>
> **[Guide](docs/guide.md)** — learn, choose, apply · **[Reference](docs/reference.md)** — every filter, one page · **[Plots](docs/readme.md)** — visual gallery

```js
import { butterworth, filter, freqz, mag2db } from 'digital-filter'

// Design a 4th-order Butterworth lowpass at 1kHz
let sos = butterworth(4, 1000, 44100)

// Filter a signal
let data = new Float64Array(1024)
filter(data, { coefs: sos })

// Analyze the response
let resp = freqz(sos, 512, 44100)
let dB = mag2db(resp.magnitude)
```

## Which filter should I use?

| I need to... | Use | Why |
|---|---|---|
| Cut frequencies above/below a threshold | `butterworth` | Flat passband, no ripple, the default |
| Sharper cutoff, some ripple OK | `chebyshev` | Steeper than Butterworth for same order |
| Sharpest possible cutoff | `elliptic` | Minimum order for given specs |
| Steepest cutoff without any ripple | `legendre` | Between Butterworth and Chebyshev |
| Preserve waveform shape / no ringing | `bessel` | Maximally flat group delay |
| Remove a specific frequency (hum) | `biquad.notch` | Narrow null at target frequency |
| Boost/cut a frequency band | `biquad.peaking` | Parametric EQ bell curve |
| Split signal into frequency bands | `linkwitzRiley` | LP+HP sum to flat (crossover) |
| Real-time synth filter with resonance | `svf` | Stable at all frequencies, 6 outputs |
| Classic analog synth sound | `moogLadder` | -24dB/oct with self-oscillation |
| Smooth a control signal | `onePole` | Simplest, no overshoot |
| Remove DC offset | `dcBlocker` | Minimal, fast |
| Smooth data preserving peaks | `savitzkyGolay` | Polynomial fit preserves shape |
| Measure loudness (LUFS) | `kWeighting` + `filter` | ITU-R BS.1770 standard |
| Cancel echo / noise adaptively | `nlms` | Normalized LMS, most practical |
| Design FIR with exact specs | `remez` | Parks-McClellan equiripple optimal |
| Design FIR quickly | `firwin` | Window method, simple and fast |
| Downsample | `decimate` | Anti-alias + downsample in one step |
| Analyze hearing / cochlea | `gammatone` | Standard auditory model |
| Zero-phase filtering (offline) | `filtfilt` | Forward-backward, no phase distortion |
| Remove impulse noise | `median` | Nonlinear, preserves edges |
| Reduce jitter in sensor/UI data | `oneEuro` | Adaptive, latency-aware |

## IIR filter families compared

![IIR Comparison](docs/plots/iir-comparison.svg)

All at order 4, fc=1000Hz, fs=44100Hz:

| | Butterworth | Chebyshev I | Chebyshev II | Elliptic | Bessel | Legendre |
|---|---|---|---|---|---|---|
| **Passband** | Flat | 1dB ripple | Flat | 1dB ripple | Flat (soft) | Flat |
| **@500Hz** | 0.0 dB | -0.3 dB | 0.0 dB | -0.1 dB | -0.7 dB | -0.4 dB |
| **@1kHz (-3dB)** | -3.0 | -1.0 | -3.0 | -1.0 | -3.0 | -3.0 |
| **@2kHz** | -24 dB | -34 dB | -40 dB | -40 dB | -14 dB | -31 dB |
| **@5kHz** | -57 dB | -69 dB | -78 dB | -46 dB | -43 dB | -65 dB |
| **Overshoot** | 10.9% | 8.7% | 13.0% | 10.6% | **0.9%** | 11.3% |
| **Settling** | 73 smp | 256 smp | 89 smp | 256 smp | **28 smp** | 116 smp |
| **Group delay variation** | 14 smp | 30 smp | 16 smp | 39 smp | **5 smp** | 21 smp |
| **Best for** | General | Sharp cutoff | Flat pass + sharp | Minimum order | No ringing | Sharp + no ripple |

**Reading the table**: Butterworth is the default. Chebyshev/Elliptic trade ripple for steeper cutoff. Bessel preserves waveform shape (lowest overshoot and most constant group delay). Legendre is the steepest you can get without any ripple.

## Butterworth order comparison

![Butterworth Orders](docs/plots/butterworth-orders.svg)

Higher order = steeper cutoff = more delay:

| Order | Slope | @2kHz | @5kHz | @10kHz |
|---|---|---|---|---|
| 1 | -6 dB/oct | -7 dB | -15 dB | -22 dB |
| 2 | -12 dB/oct | -12 dB | -29 dB | -43 dB |
| 4 | -24 dB/oct | -24 dB | -57 dB | -87 dB |
| 8 | -48 dB/oct | -49 dB | -115 dB | -173 dB |

## Biquad types

![Biquad Types](docs/plots/biquad-types.svg)

The 9 building blocks. All other IIR filters are cascades of these:

| Type | What it does | DC | @fc | Nyquist |
|---|---|---|---|---|
| `lowpass` | Passes below fc | 0 dB | -3 dB | -∞ |
| `highpass` | Passes above fc | -∞ | -3 dB | 0 dB |
| `bandpass` | Passes around fc | -∞ | 0 dB | -∞ |
| `notch` | Rejects fc | 0 dB | -∞ | 0 dB |
| `allpass` | Phase shift only | 0 dB | 0 dB | 0 dB |
| `peaking` | Boost/cut at fc | 0 dB | +gain | 0 dB |
| `lowshelf` | Boost/cut below fc | +gain | +gain/2 | 0 dB |
| `highshelf` | Boost/cut above fc | 0 dB | +gain/2 | +gain |

## All modules

### Core
| Module | API | What it does |
|---|---|---|
| `biquad` | `biquad.lowpass(fc, Q, fs)` → `{b0,b1,b2,a1,a2}` | 9 biquad coefficient types (RBJ Cookbook) |
| `filter` | `filter(data, {coefs})` → data | SOS cascade processor (DF2T) |
| `freqz` | `freqz(coefs, N, fs)` → `{frequencies, magnitude, phase}` | Frequency response analysis |
| `transform` | `transform.polesSos(poles, fc, fs, type)` | Analog prototype → digital SOS pipeline |

### IIR design — return SOS arrays
| Module | API | Reference |
|---|---|---|
| `butterworth` | `(order, fc, fs, type)` | Butterworth 1930 |
| `chebyshev` | `(order, fc, fs, ripple, type)` | Chebyshev Type I |
| `chebyshev2` | `(order, fc, fs, attenuation, type)` | Chebyshev Type II |
| `elliptic` | `(order, fc, fs, ripple, attenuation, type)` | Cauer / Elliptic |
| `bessel` | `(order, fc, fs, type)` | Thomson 1949 |
| `legendre` | `(order, fc, fs, type)` | Bond 2004 / Papoulis 1958 |
| `iirdesign` | `(fpass, fstop, rp, rs, fs)` | Auto-selects best family + order |

### FIR design — return Float64Array coefficients
| Module | API | Reference |
|---|---|---|
| `firwin` | `(numtaps, cutoff, fs, {type, window})` | Window method (scipy firwin) |
| `firwin2` | `(numtaps, freq, gain, {window})` | Arbitrary response (frequency sampling) |
| `firls` | `(numtaps, bands, desired, weight)` | Least-squares optimal |
| `remez` | `(numtaps, bands, desired, weight)` | Parks-McClellan equiripple 1972 |
| `kaiserord` | `(deltaF, attenuation)` | Kaiser order estimation |
| `hilbert` | `(N)` | 90° phase shift FIR |
| `minimumPhase` | `(h)` | Linear-phase → minimum-phase (cepstral) |
| `differentiator` | `(N)` | FIR derivative |
| `integrator` | `(rule)` | Newton-Cotes quadrature |
| `raisedCosine` | `(N, beta, sps, {root})` | Pulse shaping (communications) |
| `gaussianFir` | `(N, bt, sps)` | GMSK pulse shaping |
| `matchedFilter` | `(template)` | Maximum SNR detection |

### Simple filters — `fn(data, params)`, in-place
| Module | Key params | What it does |
|---|---|---|
| `dcBlocker` | `R` (0.995) | Remove DC offset |
| `onePole` | `fc, fs` | One-pole lowpass (EMA), -6dB/oct |
| `leakyIntegrator` | `lambda` | Exponential decay |
| `movingAverage` | `memory` | Boxcar average |
| `comb` | `delay, gain, type` | Feedforward/feedback comb |
| `allpass.first` | `a` | First-order allpass |
| `allpass.second` | `fc, Q, fs` | Second-order allpass (biquad) |
| `emphasis` | `alpha` | Pre-emphasis (H(z) = 1 - αz⁻¹) |
| `deemphasis` | `alpha` | De-emphasis (inverse) |
| `resonator` | `fc, bw, fs` | Constant-peak-gain resonator |
| `envelope` | `attack, release, fs` | Attack/release envelope follower |
| `slewLimiter` | `rise, fall, fs` | Rate-of-change limiter |
| `median` | `size` | Nonlinear median filter |

### Specialized
| Module | What it does |
|---|---|
| `svf` | Cytomic trapezoidal SVF (LP/HP/BP/notch/peak/allpass) |
| `linkwitzRiley` | Crossover: LP+HP sum to flat |
| `savitzkyGolay` | Polynomial smoothing/differentiation FIR |
| `filtfilt` | Zero-phase forward-backward filtering |
| `gaussianIir` | Recursive Gaussian smoothing (Young-van Vliet) |

### Virtual analog
| Module | What it does |
|---|---|
| `moogLadder` | Moog 4-pole -24dB/oct with resonance |
| `diodeLadder` | TB-303 diode ladder |
| `korg35` | MS-20 2-pole LP/HP with nonlinear feedback |

### Psychoacoustic
| Module | What it does |
|---|---|
| `gammatone` | Auditory filter (cochlear model, Glasberg & Moore 1990) |
| `octaveBank` | IEC 61260 fractional-octave filter bank |
| `erbBank` | ERB-spaced center frequencies and bandwidths |
| `barkBank` | Bark critical bands (Zwicker 1980) with biquad coefficients |

### Adaptive
| Module | What it does |
|---|---|
| `lms` | Least Mean Squares, O(N) per sample |
| `nlms` | Normalized LMS, input-power-normalized |
| `rls` | Recursive Least Squares, O(N²), fastest convergence |
| `levinson` | Levinson-Durbin recursion for LPC coefficients |

### Dynamic / nonlinear
| Module | What it does |
|---|---|
| `noiseShaping` | Quantization error shaping for dithering |
| `pinkNoise` | 1/f spectral slope (Paul Kellet method) |
| `oneEuro` | 1€ adaptive lowpass for jitter removal (Casiez 2012) |
| `dynamicSmoothing` | Self-adjusting SVF (cutoff adapts to signal speed) |
| `spectralTilt` | Arbitrary dB/octave spectral slope |
| `variableBandwidth` | Real-time tunable cutoff biquad |

### Multirate
| Module | What it does |
|---|---|
| `decimate` | Anti-alias + downsample |
| `interpolate` | Upsample + anti-image |
| `halfBand` | Half-band FIR for efficient 2× |
| `cic` | Cascaded integrator-comb (multiplier-free) |
| `polyphase` | Polyphase FIR decomposition |
| `farrow` | Lagrange fractional-delay |
| `thiran` | Allpass fractional delay (maximally flat) |
| `oversample` | Multi-stage oversampling |

### Composites
| Module | What it does |
|---|---|
| `graphicEq` | ISO octave-band graphic EQ |
| `parametricEq` | N-band parametric EQ with shelves |
| `crossover` | N-way Linkwitz-Riley crossover |
| `crossfeed` | Headphone spatialization |
| `formant` | Parallel resonator bank (vowel synthesis) |
| `vocoder` | Channel vocoder (analysis + synthesis) |

### Structures
| Module | What it does |
|---|---|
| `lattice` | Lattice/ladder IIR (reflection coefficients) |
| `warpedFir` | Frequency-warped FIR (perceptual resolution) |
| `convolution` | Direct convolution |

### Analysis (`analysis.js`) & conversion (`convert.js`)
| Export | What it does |
|---|---|
| `freqz` | Magnitude + phase response |
| `mag2db` | Magnitude to decibels |
| `groupDelay` | Group delay from SOS |
| `phaseDelay` | Phase delay from SOS |
| `impulseResponse` | Compute impulse response |
| `stepResponse` | Compute step response |
| `isStable` | All poles inside unit circle? |
| `isMinPhase` | All zeros inside unit circle? |
| `isFir` | No feedback coefficients? |
| `isLinPhase` | Symmetric/antisymmetric FIR? |
| `sos2zpk` | SOS → zeros/poles/gain |
| `sos2tf` | SOS → transfer function polynomials |
| `tf2zpk` | Polynomials → zeros/poles/gain |
| `zpk2sos` | Zeros/poles/gain → SOS |

### Weighting — return SOS for given sample rate
| Module | Standard | What it does |
|---|---|---|
| `aWeighting` | IEC 61672 | Human loudness perception (~40 phon) |
| `cWeighting` | IEC 61672 | Nearly flat, peak measurement |
| `kWeighting` | ITU-R BS.1770 | LUFS loudness metering |
| `itu468` | ITU-R BS.468 | Broadcast noise measurement |
| `riaa` | IEC 98 | Vinyl playback de-emphasis |

### Window functions

Re-exported from [`window-function`](https://github.com/scijs/window-function) (34 windows):
```js
import { window } from 'digital-filter'
let w = window.hann(1024) // Float64Array
```

## License

MIT
