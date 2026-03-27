# Virtual Analog Filters

Digital models of classic analog synthesizer circuits. These filters recreate the sonic character of hardware -- the warmth, the saturation, the screaming resonance -- that clean digital IIR filters cannot produce.

## Why analog sounds different

A standard digital biquad is a linear system: double the input, double the output. Real analog circuits are nonlinear. Transistors and diodes have a transfer characteristic that compresses loud signals (approximately $\tanh$). This nonlinearity does three things:

1. **Soft saturation** -- harmonics are generated, especially odd-order. This is perceived as warmth and fatness.
2. **Resonance character** -- at high resonance, the filter sings rather than rings. In a linear filter, resonance = 1 means infinite gain at the cutoff frequency. In a nonlinear circuit, the saturation limits the peak and shapes the timbre of the self-oscillation.
3. **Bass preservation** -- in the Moog ladder, high resonance sucks out bass (the feedback cancels low-frequency energy). In the diode ladder, per-stage saturation prevents this, keeping the bottom end intact.

## Zero-delay feedback (ZDF)

Naive discretization of an analog filter (e.g., Euler forward difference) introduces a one-sample delay in the feedback path. This causes:
- Resonance frequency to drift from the true cutoff, especially near Nyquist
- Self-oscillation at the wrong frequency
- Instability at high cutoff settings

Zero-delay feedback solves this by using the **trapezoidal rule** for integration and solving the implicit equation analytically. The feedback path has no unit delay -- the output at sample $n$ depends on the input at sample $n$ and the current state, resolved simultaneously. This is the approach described in Vadim Zavalishin's "The Art of VA Filter Design" (2012).

The trapezoidal integrator coefficient:

$$g = \tan\!\left(\frac{\pi f_c}{f_s}\right)$$

This provides frequency warping that maps the analog frequency axis to the digital one, keeping the cutoff accurate up to Nyquist.

## Filters

### moog-ladder.js

The Moog transistor ladder filter, invented by **Robert Moog in 1966**. Four cascaded one-pole lowpass stages with global feedback from output to input. The defining sound of subtractive synthesis.

- **Slope**: -24 dB/octave (4-pole)
- **Resonance**: 0--1, where 1 = self-oscillation (the filter becomes a sine oscillator at the cutoff frequency)
- **Saturation**: $\tanh$ at the input, controlled by the `drive` parameter
- **Character**: Warm, fat, singing. The resonance peak is smooth and musical.

The feedback topology: output of the 4th stage feeds back to the input, scaled by $k = 4 \cdot \text{resonance}$. The implicit solve prevents delay in this feedback path.

```js
import moogLadder from 'digital-filter/analog/moog-ladder.js'

let params = { fc: 800, resonance: 0.7, fs: 44100, drive: 1.5 }
moogLadder(data, params)   // in-place

// Stateful: params._s persists between calls
moogLadder(chunk1, params)
moogLadder(chunk2, params) // continues from previous state
```

**API**: `moogLadder(data, params)` &rarr; `data`
- `data` -- `Float32Array | Float64Array`, modified in-place
- `params.fc` -- cutoff frequency Hz (default 1000)
- `params.resonance` -- 0--1 (default 0)
- `params.fs` -- sample rate (default 44100)
- `params.drive` -- input drive / saturation amount (default 1)

![Moog ladder](../plots/moog-ladder.svg)

---

### diode-ladder.js

Diode ladder filter in the style of the **Roland TB-303** and EMS VCS3. Four cascaded one-pole stages like the Moog, but with a critical difference: **$\tanh$ saturation at every stage**, not just the input.

- **Slope**: -24 dB/octave (4-pole)
- **Resonance**: 0--1
- **Saturation**: per-stage $\tanh$ nonlinearity
- **Character**: Bright, squelchy, acidic. The per-stage saturation preserves bass content at high resonance -- where the Moog thins out, the diode ladder stays fat.

The feedback topology also differs: the diode ladder feeds back a weighted sum of all stage outputs, giving a gentler, less peaked resonance than the Moog's all-or-nothing 4th-stage feedback.

```js
import diodeLadder from 'digital-filter/analog/diode-ladder.js'

let params = { fc: 600, resonance: 0.85, fs: 44100 }
diodeLadder(data, params)   // in-place
```

**API**: `diodeLadder(data, params)` &rarr; `data`
- `data` -- `Float32Array | Float64Array`, modified in-place
- `params.fc` -- cutoff frequency Hz (default 1000)
- `params.resonance` -- 0--1 (default 0)
- `params.fs` -- sample rate (default 44100)

![Diode ladder](../plots/diode-ladder.svg)

---

### korg35.js

The **Korg MS-20** filter (Korg35 topology). Two cascaded one-pole stages with nonlinear feedback -- a simpler, more aggressive circuit than the 4-pole ladders.

- **Slope**: -12 dB/octave (2-pole)
- **Resonance**: 0--1, where $k = 2 \cdot \text{resonance}$
- **Saturation**: $\tanh$ in the feedback path
- **Character**: Aggressive, screaming, harsh. The 2-pole slope is less steep, so more harmonics pass through. The nonlinear feedback distorts in a ragged, spitting way that is very different from the Moog's smooth singing.
- **Modes**: lowpass and highpass (highpass is complementary: input minus lowpass output)

```js
import korg35 from 'digital-filter/analog/korg35.js'

// Lowpass (default)
let params = { fc: 2000, resonance: 0.9, fs: 44100 }
korg35(data, params)

// Highpass
korg35(data, { fc: 500, resonance: 0.6, type: 'highpass', fs: 44100 })
```

**API**: `korg35(data, params)` &rarr; `data`
- `data` -- `Float32Array | Float64Array`, modified in-place
- `params.fc` -- cutoff frequency Hz (default 1000)
- `params.resonance` -- 0--1 (default 0)
- `params.fs` -- sample rate (default 44100)
- `params.type` -- `'lowpass'` (default) or `'highpass'`

![Korg35](../plots/korg35.svg)

## Comparison

| | Moog ladder | Diode ladder | Korg35 |
|---|---|---|---|
| **Origin** | Moog 1966 | TB-303 / EMS VCS3 | Korg MS-20 |
| **Poles** | 4 (-24 dB/oct) | 4 (-24 dB/oct) | 2 (-12 dB/oct) |
| **Saturation** | Input only | Every stage | Feedback path |
| **Resonance** | Smooth, singing | Squelchy, bright | Aggressive, screaming |
| **Bass at high Q** | Thins out | Preserved | Moderate loss |
| **Character** | Warm, fat | Acidic, squelchy | Harsh, raw |
| **Self-oscillation** | Clean sine | Slightly distorted | Ragged, spitting |

## Practical notes

**Parameter ranges**: All three filters clamp `fc` to below Nyquist ($0.49 \cdot f_s$). Resonance is normalized 0--1 across all three, but the internal feedback coefficients differ: Moog uses $k = 4r$, diode uses $k = 4r$, Korg uses $k = 2r$.

**Modulation**: Parameters can change between `process()` calls (the state vector `params._s` persists). For per-sample modulation of cutoff, call the function with single-sample buffers or modify the source to accept parameter arrays.

**What resonance = 1 means**: The filter self-oscillates -- it produces a (roughly) sinusoidal output at the cutoff frequency even with zero input. In the Moog, this is a clean sine. In the diode ladder, the per-stage saturation adds slight harmonic content. In the Korg35, the 2-pole structure and feedback nonlinearity produce a more complex, buzzy oscillation.

**Drive** (Moog only): Values above 1 push the input harder into the $\tanh$ saturation, adding harmonics before the filter. At `drive: 1` the filter is relatively clean; at `drive: 4+` it is heavily saturated.
