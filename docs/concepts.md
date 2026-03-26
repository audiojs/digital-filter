# Concepts

Everything you need to understand digital filters, explained without assuming prior DSP knowledge.

## What is a filter?

A filter is a system that changes a signal. It takes samples in and produces samples out. The simplest useful filter: **averaging the last 3 samples**.

```js
output[i] = (input[i] + input[i-1] + input[i-2]) / 3
```

This smooths the signal — fast changes get reduced, slow trends survive. That's a **lowpass filter**: it passes low frequencies and reduces high frequencies.

Every filter has this dual nature: it does something in *time* (averaging, delaying, accumulating) that corresponds to something in *frequency* (passing, cutting, boosting).

## Frequency domain: what a filter really does

Sound is a mix of frequencies. A middle-A note is 440 Hz — the air pressure oscillates 440 times per second. Music is thousands of frequencies happening simultaneously.

A filter's job is to treat different frequencies differently. A lowpass filter at 1000 Hz:
- Frequencies below 1000 Hz → pass through unchanged
- Frequencies above 1000 Hz → reduced (attenuated)
- The boundary region → gradual transition

The **magnitude response** shows this: a plot of "how much of each frequency gets through" (y-axis, in dB) vs frequency (x-axis, in Hz). This is the single most important visualization for understanding any filter.

### What dB means

Decibels (dB) are a logarithmic scale for ratios:

| dB | Ratio | Meaning |
|---|---|---|
| 0 dB | 1.0 | Unchanged |
| -3 dB | 0.71 | Half power (the standard "cutoff" point) |
| -6 dB | 0.50 | Half amplitude |
| -20 dB | 0.10 | 10% amplitude |
| -40 dB | 0.01 | 1% amplitude |
| -60 dB | 0.001 | 0.1% — effectively silent |
| +6 dB | 2.0 | Double amplitude |
| +20 dB | 10.0 | 10× amplitude |

Conversion: `dB = 20 × log10(ratio)`. The `mag2db` function does this.

### Passband, stopband, transition band

Every frequency-selective filter has three regions:

```
     0 dB ─────────┐
                   │ ← transition band
   -40 dB          └──────────────
     passband          stopband
```

- **Passband**: frequencies that pass through (near 0 dB)
- **Stopband**: frequencies that are rejected (far below 0 dB)
- **Transition band**: the slope between them (narrower = "sharper" cutoff)

The **-3 dB point** (half power) is the conventional boundary — the "cutoff frequency" (fc).

## Phase: the hidden dimension

The magnitude response tells you *how much* of each frequency passes. But there's a second dimension: *when* it arrives.

A filter delays different frequencies by different amounts. This delay is called **phase shift**. If all frequencies are delayed by the same amount, the waveform shape is preserved — that's **linear phase**. If different frequencies arrive at different times, the waveform gets distorted — that's **nonlinear phase**.

**Group delay** measures this: how many samples each frequency is delayed. A filter with constant group delay has linear phase.

Why this matters:
- **Audio**: nonlinear phase in a crossover makes the drivers sum incorrectly. In EQ, it's usually inaudible.
- **Data**: if you're measuring a waveform shape (ECG, transient), phase distortion changes the measurement.
- **Communications**: phase distortion causes intersymbol interference.

**FIR filters** can have perfect linear phase (symmetric coefficients). **IIR filters** cannot — they always distort the phase somewhat, except for the allpass type (which distorts phase by design, for effects like phasers).

## IIR vs FIR: the fundamental choice

Every digital filter is one of two types:

### IIR (Infinite Impulse Response)

Uses feedback — output depends on previous *outputs* as well as inputs.

```
y[n] = b0·x[n] + b1·x[n-1] + b2·x[n-2] - a1·y[n-1] - a2·y[n-2]
```

**Advantages**: Very efficient — a sharp lowpass filter needs only 2nd-10th order (5-20 multiplies per sample). Can match analog filter behavior exactly.

**Disadvantages**: Nonlinear phase. Can be unstable if coefficients are wrong. Cannot achieve linear phase.

**Use when**: Real-time audio (EQ, crossovers, dynamics), control systems, any application where latency matters.

### FIR (Finite Impulse Response)

No feedback — output depends only on current and past *inputs*.

```
y[n] = h[0]·x[n] + h[1]·x[n-1] + ... + h[N-1]·x[n-N+1]
```

**Advantages**: Always stable. Can have perfect linear phase. Predictable behavior.

**Disadvantages**: Needs many taps for sharp cutoff (100-1000+ multiplies per sample). Higher latency (delay = half the filter length for linear phase).

**Use when**: Offline processing, situations requiring linear phase, adaptive filtering, pulse shaping in communications.

### Quick comparison

| Property | IIR | FIR |
|---|---|---|
| Efficiency | 5-20 multiplies for sharp LP | 100-1000+ multiplies |
| Phase | Nonlinear (always) | Linear (with symmetric coefficients) |
| Stability | Can be unstable | Always stable |
| Latency | Low (few samples) | High (N/2 samples) |
| Analog equivalent | Yes (Butterworth, etc.) | No direct analog equivalent |
| Adaptive | Hard to adapt | Easy to adapt (LMS, NLMS) |

## The biquad: building block of IIR filters

The **second-order section (SOS)** or **biquad** is a filter with 5 coefficients:

```
H(z) = (b0 + b1·z⁻¹ + b2·z⁻²) / (1 + a1·z⁻¹ + a2·z⁻²)
```

Every IIR filter — no matter how complex — is built from cascaded biquads. A 4th-order Butterworth is two biquads in series. An 8th-order elliptic is four biquads.

Why biquads and not higher-order direct form? **Numerical stability**. A 10th-order filter implemented directly requires coefficients to have ~15 decimal digits of precision — impossible with float64. But the same filter as 5 cascaded biquads works perfectly with normal precision.

The library represents biquad coefficients as `{b0, b1, b2, a1, a2}` — the `a0` coefficient is always 1 (normalized). An array of these objects is an **SOS array** — the universal exchange format in this library.

## The bilinear transform: analog meets digital

Classic filter families (Butterworth, Chebyshev, Bessel, Elliptic) were designed for analog circuits in the 1930s-1960s. To use them digitally, we need a mapping from continuous time (s-domain) to discrete time (z-domain).

The **bilinear transform** does this:

```
s = (2/T) · (z-1)/(z+1)
```

It maps the entire analog frequency axis to the digital frequency axis [0, Nyquist]. The mapping is exact at one frequency (the **prewarped** cutoff) but compresses frequencies near Nyquist.

This is why this library has a `transform.js` module: it takes analog prototype poles (from Butterworth, Chebyshev, etc.) and converts them to digital biquad coefficients via bilinear transform. Adding a new analog filter family only requires defining its poles — the rest of the pipeline is shared.

## Stability: when filters blow up

An IIR filter is **stable** if its output stays bounded for any bounded input. Mathematically: all **poles** must be inside the unit circle in the z-plane.

Poles are values of z where the denominator of H(z) is zero. For a biquad with coefficients `a1, a2`, the poles are the roots of `z² + a1·z + a2 = 0`. If both roots have magnitude < 1, the filter is stable.

The `isStable(sos)` function checks this.

In practice, instability happens when:
- Coefficient quantization pushes a pole outside the unit circle (more common with high-order direct form — another reason to use SOS)
- Filter parameters are changed carelessly (e.g., Q → 0 in some formulations)
- Feedback gain exceeds the stability limit (e.g., Moog ladder at resonance > 4)

FIR filters are always stable — they have no poles (or equivalently, all poles are at z=0).

## Sampling theorem and aliasing

A digital system with sample rate `fs` can represent frequencies up to `fs/2` (the **Nyquist frequency**). Frequencies above Nyquist fold back ("alias") into the representable range, creating false signals that cannot be distinguished from real ones.

This is why:
- **Anti-aliasing filters** are applied before sampling (or before decimation)
- **Anti-imaging filters** are applied after upsampling
- Filter design must respect the Nyquist limit: `fc < fs/2`

The `decimate`, `interpolate`, and `oversample` modules handle aliasing automatically.
