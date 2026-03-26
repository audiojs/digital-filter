# Choosing a Filter

Five paths to finding the right filter. Start with whichever matches how you think about your problem.

---

## Path 1: "I want to..." lookup table

| I want to... | Use | Notes |
|---|---|---|
| **Frequency selection** | | |
| Remove frequencies above a cutoff | `butterworth(N, fc, fs)` | Default choice. Flat passband, no surprises |
| Remove frequencies below a cutoff | `butterworth(N, fc, fs, 'highpass')` | Same, highpass mode |
| Keep only a frequency range | `butterworth(N, [lo, hi], fs, 'bandpass')` | Bandpass mode |
| Remove a frequency range | `butterworth(N, [lo, hi], fs, 'bandstop')` | Band-reject mode |
| Remove one exact frequency | `biquad.notch(fc, Q, fs)` | Q=30 for narrow null |
| Boost/cut a frequency band | `biquad.peaking(fc, Q, fs, dB)` | Parametric EQ bell |
| Boost/cut everything below a frequency | `biquad.lowshelf(fc, Q, fs, dB)` | Shelf EQ |
| Boost/cut everything above a frequency | `biquad.highshelf(fc, Q, fs, dB)` | Shelf EQ |
| Split signal into 2 bands | `linkwitzRiley(4, fc, fs)` | LP+HP sum to flat |
| Split signal into N bands | `crossover([f1, f2, ...], 4, fs)` | N-way Linkwitz-Riley |
| **Sharp cutoff** | | |
| Sharpest cutoff, ripple OK in both bands | `elliptic(N, fc, fs, rp, rs)` | Minimum order for specs |
| Sharp cutoff, passband ripple OK | `chebyshev(N, fc, fs, ripple)` | Steeper than Butterworth |
| Sharp cutoff, passband must be flat | `chebyshev2(N, fc, fs, attenuation)` | Flat pass, equiripple stop |
| Sharp cutoff, no ripple anywhere | `legendre(N, fc, fs)` | Between Butterworth and Chebyshev |
| Let the library pick the best family | `iirdesign(fpass, fstop, rp, rs, fs)` | Auto-selects family + order |
| **Waveform preservation** | | |
| Filter without ringing/overshoot | `bessel(N, fc, fs)` | Maximally flat group delay |
| Filter without any phase distortion | `filtfilt(data, {coefs})` | Zero-phase (offline only) |
| **Audio** | | |
| Multi-band parametric EQ | `parametricEq(data, {bands, fs})` | N bands with shelf options |
| 10-band graphic EQ | `graphicEq(data, {gains, fs})` | ISO octave centers |
| Measure loudness (LUFS) | `kWeighting(fs)` + `filter` + RMS | ITU-R BS.1770 |
| Measure sound level (dBA) | `aWeighting(fs)` + `filter` + RMS | IEC 61672 |
| Vinyl playback | `riaa(fs)` + `filter` | RIAA de-emphasis |
| Headphone crossfeed | `crossfeed(data, params)` | Stereo spatialization |
| **Synthesis** | | |
| Classic analog synth lowpass | `moogLadder(data, {fc, resonance, fs})` | -24 dB/oct, saturating |
| Versatile synth filter (LP/HP/BP/notch) | `svf(data, {type, fc, Q, fs})` | Stable, 6 outputs |
| Diode ladder (303-style) | `diodeLadder(data, {fc, resonance, fs})` | Gritty character |
| Korg MS-20 filter | `korg35(data, {fc, resonance, fs})` | Nonlinear 2-pole |
| Vowel/formant synthesis | `formant(data, {formants, fs})` | Parallel resonators |
| Phaser effect | Cascade of `allpass.second` + LFO | See [applications](applications.md) |
| **Smoothing** | | |
| Smooth a control signal | `onePole(data, {fc, fs})` | Simplest, no overshoot |
| Smooth preserving peaks/edges | `savitzkyGolay(data, {window, order})` | Polynomial fit |
| Smooth with adaptive speed | `oneEuro(data, params)` | Low jitter + low latency |
| Smooth with self-adjusting cutoff | `dynamicSmoothing(data, params)` | Cutoff follows signal |
| Gaussian blur (symmetric) | `gaussianIir(data, {sigma})` | Fast recursive Gaussian |
| Remove impulse noise (clicks) | `median(data, {size})` | Nonlinear, preserves edges |
| Remove DC offset | `dcBlocker(data, {R})` | R=0.995 default |
| **Adaptive** | | |
| Cancel echo / noise | `nlms(input, desired, params)` | Normalized LMS, most practical |
| System identification | `lms(input, desired, params)` | Simpler, cheaper |
| Fastest convergence | `rls(input, desired, params)` | O(N^2) but fast tracking |
| LPC / Toeplitz solver | `levinson(R, order)` | From autocorrelation |
| **FIR design** | | |
| Quick FIR filter | `firwin(N, fc, fs, {type})` | Window method |
| FIR with arbitrary shape | `firwin2(N, freqs, gains)` | Frequency sampling |
| Optimal smooth FIR | `firls(N, bands, desired)` | Least-squares |
| Optimal sharp FIR | `remez(N, bands, desired)` | Equiripple (Parks-McClellan) |
| Estimate FIR order needed | `kaiserord(deltaF, attenuation)` | Returns numtaps + beta |
| 90-degree phase shift | `hilbert(N)` | FIR Hilbert transformer |
| Convert linear-phase to min-phase | `minimumPhase(h)` | Cepstral method |
| FIR derivative | `differentiator(N)` | Wideband differentiator |
| FIR integrator | `integrator(rule)` | Newton-Cotes |
| **Communications** | | |
| Pulse shaping (TX) | `raisedCosine(N, beta, sps)` | ISI-free at symbol centers |
| Root raised cosine (TX+RX pair) | `raisedCosine(N, beta, sps, {root: true})` | Matched pair |
| Detect known waveform | `matchedFilter(template)` | Maximum SNR |
| **Multirate** | | |
| Downsample | `decimate(data, factor)` | Anti-alias included |
| Upsample | `interpolate(data, factor)` | Anti-image included |
| Efficient 2x up/down | `halfBand(N)` | Half zeros = half cost |
| Multiplier-free decimation | `cic(data, params)` | CIC for high ratios |
| Fractional delay | `farrow(data, params)` | Lagrange interpolation |
| Allpass fractional delay | `thiran(delay, order)` | Maximally flat |
| Oversample for nonlinear processing | `oversample(data, params)` | Multi-stage |
| **Analysis** | | |
| Frequency response plot data | `freqz(sos, N, fs)` | Magnitude + phase |
| Magnitude to dB | `mag2db(magnitude)` | 20*log10 |
| Group delay | `groupDelay(sos, N, fs)` | Samples per frequency |
| Stability check | `isStable(sos)` | Poles inside unit circle? |
| 1/3-octave spectrum | `octaveBank(3, fs)` | IEC 61260 bands |
| Auditory filter bank | `gammatone(fc, fs)` | Cochlear model |
| ERB-spaced frequencies | `erbBank(fs)` | Perceptual spacing |
| Bark critical bands | `barkBank(fs)` | Zwicker model |

---

## Path 2: IIR family selector

```
Do you need linear phase?
├─ Yes → Use FIR (see Path 3)
│        Or filtfilt for offline zero-phase
└─ No
   │
   Must the waveform shape be preserved (no ringing)?
   ├─ Yes → bessel
   └─ No
      │
      Is passband ripple acceptable?
      ├─ Yes
      │  │
      │  Is stopband ripple also acceptable?
      │  ├─ Yes → elliptic (minimum order, sharpest transition)
      │  └─ No  → chebyshev (equiripple passband, monotonic stopband)
      │
      └─ No (passband must be flat)
         │
         Is stopband ripple acceptable?
         ├─ Yes → chebyshev2 (flat passband, equiripple stopband)
         └─ No
            │
            Need the sharpest cutoff possible without any ripple?
            ├─ Yes → legendre (steepest monotonic)
            └─ No  → butterworth (the safe default)
```

**Order selection**: Start with order 4. If the cutoff is not steep enough, go to 6 or 8. If latency or ringing is a problem, go lower. If you need specific attenuation at a specific frequency, use `iirdesign` and it will compute the minimum order automatically.

**Bandpass/bandstop**: All families support these. Pass `[fLow, fHigh]` as the cutoff. The actual filter order doubles (a 4th-order bandpass uses 4 biquad sections).

---

## Path 3: FIR design method selector

```
How precise are your specs?

"Just need a decent lowpass/highpass/bandpass"
→ firwin (window method)
  Fast, reliable, good for most tasks.
  firwin(101, 1000, 44100)

"I have exact passband/stopband specs and need minimum taps"
→ remez (Parks-McClellan equiripple)
  Optimal for sharp transitions. Equiripple error.
  remez(51, [0, 0.2, 0.3, 1], [1, 1, 0, 0])

"I need smooth approximation with minimal ringing"
→ firls (least-squares optimal)
  Smoother than remez, better for audio.
  firls(51, [0, 0.2, 0.3, 1], [1, 1, 0, 0])

"I need an arbitrary magnitude shape"
→ firwin2 (frequency sampling)
  Specify gain at arbitrary frequency points.
  firwin2(101, [0, 0.3, 0.4, 1], [1, 1, 0, 0])

"I don't know how many taps I need"
→ kaiserord first, then firwin
  kaiserord(deltaF, attenuation) → {numtaps, beta}
```

**Comparison at a glance**:

| Method | Optimality | Best for | Weakness |
|---|---|---|---|
| `firwin` | Good enough | Quick prototyping, general use | Not optimal for tight specs |
| `firls` | Least-squares | Smooth specs, audio, interpolation | Wider transition than remez |
| `remez` | Minimax | Sharp transitions, tight specs | Can have convergence issues at high order |
| `firwin2` | Frequency sampling | Arbitrary shapes, EQ curves | Not optimal in any formal sense |

---

## Path 4: By domain

### Audio production
Start with `biquad` for single-band EQ, `parametricEq` for multi-band, `graphicEq` for octave-band. Use `butterworth` for general filtering, `linkwitzRiley` / `crossover` for speaker management. `kWeighting` for loudness. `riaa` for vinyl. See [applications](applications.md#audio-processing).

### Music synthesis
`moogLadder` for classic analog warmth, `svf` for versatile real-time filter, `diodeLadder`/`korg35` for specific analog character. `formant` for vowel synthesis. `comb` + `onePole` for physical models. `envelope` for modulation. See [applications](applications.md#music-synthesis).

### Speech processing
`emphasis` for pre-emphasis, `levinson` for LPC, `nlms` for echo cancellation, `gammatone`/`erbBank` for auditory models. See [applications](applications.md#speech-processing).

### Biomedical
`butterworth` for clean bandpass (ECG: 0.5-40 Hz, EEG bands), `biquad.notch` for powerline removal, `filtfilt` for zero-phase offline analysis, `bessel` when waveform shape matters. See [applications](applications.md#biomedical).

### Communications
`raisedCosine` for pulse shaping, `matchedFilter` for detection, `decimate`/`interpolate` for sample rate conversion, `cic` for high-ratio decimation in SDR front-ends. See [applications](applications.md#communications).

### Measurement & instrumentation
`aWeighting`/`cWeighting` for SPL, `kWeighting` for LUFS, `octaveBank` for spectral analysis, `itu468` for broadcast noise measurement, `savitzkyGolay` for smoothing measurement data. See [applications](applications.md#measurement).

### Control systems / sensors
`onePole` for simple smoothing, `oneEuro` for adaptive jitter removal (mouse/touch/VR tracking), `dynamicSmoothing` for signals with varying dynamics, `median` for impulse noise removal, `slewLimiter` for rate limiting.

---

## Path 5: By characteristic

### I need the lowest latency
Use IIR (`butterworth`, `biquad`, `svf`). A 4th-order IIR lowpass adds only 2-4 samples of group delay at most frequencies. An equivalent FIR would need 50-100 samples of delay.

For sample-by-sample processing with no block delay: `svf`, `moogLadder`, `onePole`, `dcBlocker` all process in-place with O(1) state.

### I need linear phase
Use FIR (`firwin`, `remez`, `firls`). Symmetric FIR coefficients guarantee linear phase. The cost: delay equals half the filter length.

For offline signals: `filtfilt` gives zero-phase with any IIR filter (forward + backward pass). Cannot be used in real-time.

### I need the filter to adapt
Use `nlms` (best all-around: normalized step size, stable). Use `lms` if you need the simplest possible implementation. Use `rls` if you need fastest convergence and can afford O(N^2).

### I need zero-phase (offline)
`filtfilt(data, {coefs: sos})` — applies the filter forward, then backward. Doubles the effective order. Cannot be used in real-time because it needs the entire signal.

### I need to track a changing frequency
`svf` recomputes coefficients when `fc`/`Q` change — no clicks or artifacts. `variableBandwidth` does the same for biquad. `moogLadder` and `korg35` also support per-block parameter changes.

For smoothly varying cutoff without zipper noise, update parameters every block (64-256 samples), not every sample.

### I need the sharpest transition
For IIR: `elliptic` achieves the minimum order for any specification. If ripple is unacceptable, `legendre` is the steepest monotonic option.

For FIR: `remez` (Parks-McClellan) gives the minimum-length FIR for equiripple specifications.

Use `iirdesign(fpass, fstop, rp, rs, fs)` to auto-select the best IIR family and minimum order.

### I need to process blocks in real-time
All `filter(data, params)` calls maintain state in `params.state` between calls. Process consecutive blocks by reusing the same params object:

```js
let params = { coefs: butterworth(4, 1000, 44100) }

// Process blocks as they arrive
filter(block1, params)  // state persists
filter(block2, params)  // seamless continuation
filter(block3, params)
```

Same pattern works for `svf`, `moogLadder`, `onePole`, `envelope`, and all other stateful filters.

---

## Anti-patterns: common mistakes

### Using FIR when IIR is fine
A 4th-order Butterworth lowpass takes 10 multiplies per sample. An equivalent FIR takes 100+. If you do not need linear phase, use IIR. Most audio applications (EQ, crossovers, dynamics sidechains) work perfectly with IIR.

### Using Butterworth order 20 when elliptic order 4 suffices
High-order Butterworth filters have massive group delay, and the cutoff is not even that much sharper per added order. An elliptic order 4 can match Butterworth order 12 in transition width. Use `iirdesign` to find the minimum order automatically.

### Forgetting to use SOS cascade
Never implement a high-order IIR filter as a single transfer function (one big numerator and denominator polynomial). The coefficients lose precision and the filter becomes unstable above order ~6. Always use the SOS (biquad cascade) form. This library returns SOS by default — do not convert to `tf` form for filtering.

### Not prewarping (wrong cutoff frequency)
The bilinear transform compresses frequencies near Nyquist. A "1000 Hz" filter without prewarping might actually cut at 980 Hz. All IIR design functions in this library prewarp automatically — the cutoff you specify is the cutoff you get. This is only a concern if you are implementing your own bilinear transform.

### Using filtfilt in real-time
`filtfilt` requires the entire signal upfront (it processes backward). It cannot be used for streaming or real-time. For real-time processing, accept the phase distortion of a causal IIR, or add FIR latency for linear phase.

### Ignoring group delay
IIR filters delay different frequencies by different amounts. In a crossover, this means the drivers are not time-aligned, causing comb-filtering at the crossover frequency. Linkwitz-Riley crossovers (`linkwitzRiley`, `crossover`) are designed to handle this — their LP+HP sum to an allpass (flat magnitude). Do not build crossovers from independent Butterworth filters.

### Setting Q too high on a biquad
Q controls the resonance peak at the cutoff. For standard filtering, Q = 0.707 (Butterworth response) is the default. Q > 10 creates a narrow, tall resonance peak that can cause clipping. For parametric EQ, Q=0.5-8 covers the useful range. Only go higher for notch filters.

### Filtering the same data multiple times accidentally
`filter()` modifies data in-place. If you need the same input for multiple filters (e.g., crossover bands), copy first:

```js
let low = Float64Array.from(data)   // copy
let high = Float64Array.from(data)  // copy
filter(low, lowParams)
filter(high, highParams)
```

### Not resetting state between unrelated signals
Filter state persists in the params object. If you filter one file, then filter a completely different file with the same params, the first few output samples will be contaminated by the tail of the previous signal. Reset by deleting the state: `delete params.state` (or create a new params object).
