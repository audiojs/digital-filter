# Building Blocks

Small, focused, single-purpose processors. Each solves one specific problem. They don't form a class -- they're the toolbox drawer you reach into when you need a specific tool.

Grouped loosely by function:

## Spectral Correction

### dc-blocker.js

Remove DC offset (0 Hz component) from a signal. A recording with DC offset wastes headroom and causes clicks on editing boundaries.

$$H(z) = \frac{1 - z^{-1}}{1 - R z^{-1}}$$

The numerator is a zero at DC (blocks 0 Hz). The denominator is a pole near DC (keeps the filter's gain near unity at all other frequencies). $R$ controls how close the pole is to the unit circle -- closer to 1 means a narrower notch at DC but slower settling. Default $R = 0.995$.

```js
import dcBlocker from 'digital-filter/misc/dc-blocker.js'

let params = { R: 0.995 }
dcBlocker(data, params)
```

---

### pre-emphasis.js

Tilt the spectrum up (pre-emphasis) or down (de-emphasis). Used in speech processing (boost high frequencies before analysis to compensate for the -6 dB/octave spectral rolloff of voiced speech), FM broadcasting (boost before transmission, cut after reception to reduce high-frequency noise), and tape recording.

Pre-emphasis (FIR, boosts highs):

$$H(z) = 1 - \alpha z^{-1}$$

De-emphasis (IIR, cuts highs):

$$H(z) = \frac{1}{1 - \alpha z^{-1}}$$

Default $\alpha = 0.97$. They are exact inverses -- applying both in sequence yields unity.

```js
import { emphasis, deemphasis } from 'digital-filter/misc/pre-emphasis.js'

let params = { alpha: 0.97 }
emphasis(data, params)    // boost highs
deemphasis(data, params)  // restore
```

---

### spectral-tilt.js

Apply an arbitrary constant dB/octave slope across the spectrum. Implemented as a cascade of first-order shelving sections at octave-spaced frequencies (62.5 Hz to 8 kHz).

Positive slope boosts high frequencies; negative slope boosts low frequencies. Unlike pre-emphasis (which is a single first-order filter), spectral tilt distributes the correction across 8 stages for a more uniform slope over a wider bandwidth.

```js
import spectralTilt from 'digital-filter/misc/spectral-tilt.js'

let params = { slope: -3, fs: 44100 }  // -3 dB/octave (pink-ify)
spectralTilt(data, params)
```

## Delay-Based Structures

### comb.js

Comb filter -- signal plus a delayed copy of itself. The frequency response has evenly spaced peaks and notches (looks like a comb).

Feedforward (FIR):

$$H(z) = 1 + g \cdot z^{-M}$$

Feedback (IIR):

$$H(z) = \frac{1}{1 - g \cdot z^{-M}}$$

where $M$ is the delay in samples and $g$ is the gain. Feedforward combs create the hollow, swept sound of flanging. Feedback combs create resonant peaks -- the basis of Karplus-Strong plucked-string synthesis and Schroeder reverb structures.

```js
import comb from 'digital-filter/misc/comb.js'

// Flanger: short delay, feedforward
let params = { delay: 20, gain: 0.7, type: 'feedforward' }
comb(data, params)

// Karplus-Strong resonator: feedback comb
let params2 = { delay: 100, gain: 0.98, type: 'feedback' }
comb(data, params2)
```

---

### allpass.js

Unity magnitude at all frequencies, frequency-dependent phase shift. Two variants:

First-order:

$$H(z) = \frac{a + z^{-1}}{1 + a z^{-1}}$$

Second-order (biquad allpass):

$$H(z) = \frac{(1 - \alpha) - 2\cos\omega_0 z^{-1} + (1+\alpha)z^{-2}}{(1 + \alpha) - 2\cos\omega_0 z^{-1} + (1-\alpha)z^{-2}}$$

Allpass filters are the building blocks of phasers (cascade several, sweep `fc` with an LFO), dispersive delays (frequency-dependent delay without magnitude change), and Schroeder allpass reverbs.

```js
import { first, second } from 'digital-filter/misc/allpass.js'

// First-order allpass
first(data, { a: 0.5 })

// Second-order allpass (phaser stage)
second(data, { fc: 1000, Q: 2, fs: 44100 })
```

---

### resonator.js

Constant-peak-gain resonator. Unlike a peaking EQ biquad (whose peak gain depends on Q), this resonator's peak amplitude stays constant regardless of bandwidth -- only the width of the resonance changes.

$$H(z) = \frac{1 - R^2}{1 - 2R\cos\omega_0 z^{-1} + R^2 z^{-2}}$$

where $R = 1 - \pi \cdot BW / f_s$ and $\omega_0 = 2\pi f_c / f_s$.

Used for modal synthesis (bells, drums -- each mode is a resonator at a partial frequency), formant synthesis (the `formant` module uses these internally), and physical modeling.

```js
import resonator from 'digital-filter/misc/resonator.js'

// Bell partial at 880Hz, 10Hz bandwidth
let params = { fc: 880, bw: 10, fs: 44100 }
resonator(data, params)
```

## Dynamics

### envelope.js

Attack/release envelope follower. Rectifies the signal (takes absolute value) and applies asymmetric smoothing: fast attack (respond quickly to transients) and slow release (decay gradually).

$$y[n] = \begin{cases} \alpha_a \cdot y[n-1] + (1 - \alpha_a) \cdot |x[n]| & \text{if } |x[n]| > y[n-1] \\ \alpha_r \cdot y[n-1] + (1 - \alpha_r) \cdot |x[n]| & \text{otherwise} \end{cases}$$

where $\alpha = e^{-1/(t \cdot f_s)}$ and $t$ is the time constant in seconds.

Used as the sidechain for compressors, limiters, auto-wah, ducking, and any effect that needs to track signal level.

```js
import envelope from 'digital-filter/misc/envelope.js'

let params = { attack: 0.001, release: 0.05, fs: 44100 }
envelope(data, params)
// data is now the envelope (positive, smooth)
```

---

### slew-limiter.js

Rate-of-change limiter. Clips the derivative of the signal -- the output can only change by a maximum amount per sample. Nonlinear (not a conventional filter).

If the input jumps instantaneously, the output ramps to the new value at the maximum slew rate. This prevents clicks from sudden parameter changes (gain jumps, mute/unmute), implements portamento/glide in synthesizers, and smooths control voltages.

`rise` and `fall` are specified in units per second.

```js
import slewLimiter from 'digital-filter/misc/slew-limiter.js'

let params = { rise: 1000, fall: 1000, fs: 44100 }
slewLimiter(data, params)
```

## Noise

### noise-shaping.js

Reshape quantization noise spectrum during bit-depth reduction. Instead of rounding each sample independently (which produces white quantization noise), feed the quantization error back through a filter to push the noise into less audible frequency ranges.

First-order noise shaping (the default) is simple error feedback -- equivalent to differentiating the quantization noise, which pushes energy toward high frequencies where hearing is less sensitive.

```js
import noiseShaping from 'digital-filter/misc/noise-shaping.js'

// Dither from 24-bit to 16-bit with noise shaping
let params = { bits: 16 }
noiseShaping(data, params)
```

---

### pink-noise.js

Convert white noise to pink noise (1/f spectral slope, -3 dB/octave). Uses Paul Kellet's refined IIR approximation -- a parallel bank of first-order filters with empirically tuned coefficients that approximate the ideal -3 dB/octave slope to within 0.5 dB accuracy.

Pink noise has equal energy per octave (unlike white noise, which has equal energy per Hz). It sounds more natural and is the standard test signal for room acoustics, speaker calibration, and audio system measurement.

```js
import pinkNoise from 'digital-filter/misc/pink-noise.js'

// Generate white noise, then filter to pink
let white = new Float64Array(44100)
for (let i = 0; i < white.length; i++) white[i] = Math.random() * 2 - 1

let params = {}
pinkNoise(white, params)
// white is now pink noise (in-place)
```

## Time-Varying

### variable-bandwidth.js

A biquad filter (lowpass, highpass, or bandpass) that automatically recomputes its coefficients when `fc` or `Q` change. Tracks parameter changes via internal cache -- coefficients are only recomputed when values actually differ.

This is the module to use when filter parameters change over time (LFO-modulated filter, user-controlled knob) but you don't need the per-sample safety of the SVF. It uses the standard biquad topology, so it is not safe for rapid per-sample modulation (use `svf` for that). It is appropriate for block-rate parameter changes.

```js
import variableBandwidth from 'digital-filter/misc/variable-bandwidth.js'

let params = { fc: 1000, Q: 2, type: 'lowpass', fs: 44100 }
variableBandwidth(data, params)

// Change parameters -- coefficients auto-recompute
params.fc = 2000
variableBandwidth(data2, params)
```
