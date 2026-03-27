# Equalization and Audio Composites

Multi-band audio processing chains built from biquad cascades. Each module here combines lower-level primitives (biquads, resonators, envelope followers) into a complete processing unit -- the kind of thing that has a front panel in hardware.

The common thread: these all operate on multiple frequency bands simultaneously, splitting or shaping the spectrum in parallel, then recombining. A single biquad handles one band; these modules orchestrate many.

## Graphic EQ

A 10-band equalizer at ISO octave-spaced center frequencies: 31.25, 62.5, 125, 250, 500, 1k, 2k, 4k, 8k, 16kHz. Each band is a peaking biquad with fixed center frequency and Q -- you control only gain per band.

This is the hardware graphic EQ: a row of sliders, each boosting or cutting its octave band. Simple, visual, predictable. The tradeoff versus parametric EQ is precision -- you cannot adjust bandwidth or move center frequencies.

Bands at 0 dB gain are skipped entirely (no processing cost).

```js
import graphicEq from 'digital-filter/eq/graphic-eq.js'

let params = {
  gains: { 125: -3, 1000: 2, 8000: 4 },  // dB per band
  fs: 44100
}
graphicEq(data, params)
```

## Parametric EQ

N-band fully configurable equalizer. Each band specifies center frequency (`fc`), quality factor (`Q`), gain in dB, and filter type (`peak`, `lowshelf`, `highshelf`).

This is the professional tool. Where graphic EQ gives you fixed sliders, parametric EQ lets you place a bell curve at any frequency, with any width and any gain. Three band types:

- **Peak** (bell): boost/cut centered at `fc`, width controlled by Q
- **Low shelf**: boost/cut everything below `fc`
- **High shelf**: boost/cut everything above `fc`

Q and bandwidth are inversely related: $BW = f_c / Q$. A Q of 1 at 1kHz gives a 1kHz-wide bell. A Q of 10 at 1kHz gives a 100Hz-wide surgical notch.

Set `params._dirty = true` to trigger coefficient recomputation after changing band parameters.

```js
import parametricEq from 'digital-filter/eq/parametric-eq.js'

let params = {
  bands: [
    { fc: 80, Q: 0.7, gain: 3, type: 'lowshelf' },
    { fc: 400, Q: 2, gain: -4, type: 'peak' },
    { fc: 2500, Q: 1.5, gain: 2, type: 'peak' },
    { fc: 10000, Q: 0.7, gain: 1.5, type: 'highshelf' }
  ],
  fs: 44100
}
parametricEq(data, params)
```

## Crossover

N-way frequency band splitter using Linkwitz-Riley (LR) filters. Given N-1 crossover frequencies, returns N arrays of SOS coefficients -- one filter chain per output band.

**Why Linkwitz-Riley, not Butterworth?** A Butterworth lowpass and highpass at the same frequency are each -3 dB at the crossover point. Summing two -3 dB signals gives +3 dB -- a bump. Linkwitz-Riley solves this: it is a squared Butterworth (two cascaded Butterworths of half order), placing the crossover point at -6 dB. Two -6 dB signals sum to 0 dB. The LP and HP outputs sum to an allpass -- perfectly flat magnitude, no comb filtering.

This matters for loudspeaker crossovers (woofer + tweeter must sum flat) and multi-band processing (compress/limit each band separately, then recombine without artifacts).

```js
import crossover from 'digital-filter/eq/crossover.js'
import filter from 'digital-filter/core/filter.js'

// 3-way crossover: sub (<120Hz), mid (120-3kHz), hi (>3kHz)
let bands = crossover([120, 3000], 4, 44100)

let sub = Float64Array.from(data)
let mid = Float64Array.from(data)
let hi  = Float64Array.from(data)

filter(sub, { coefs: bands[0] })
filter(mid, { coefs: bands[1] })
filter(hi,  { coefs: bands[2] })
```

## Crossfeed

Headphone spatialization filter. Mixes a lowpass-filtered version of each channel into the opposite ear.

**The problem.** With speakers, sound from the left speaker reaches your right ear (and vice versa) -- attenuated and delayed, mostly at low frequencies. This interaural crosstalk is how you perceive spatial width. Headphones eliminate it entirely: each ear hears only its channel. The result is an unnaturally wide, "inside the head" stereo image.

**The solution.** Feed a lowpass-filtered copy of L into R and R into L. The lowpass models the head's acoustic shadow (high frequencies are blocked by the head; low frequencies diffract around it). The `level` parameter controls how much crossfeed to apply (0 = none, 1 = full mono). Default 0.3 is a mild, natural correction.

```js
import crossfeed from 'digital-filter/eq/crossfeed.js'

let params = { fc: 700, level: 0.3, fs: 44100 }
crossfeed(left, right, params)
// left and right are modified in-place
```

## Formant

Parallel bank of resonators for vowel/formant synthesis. Each resonator is tuned to a formant frequency with a specified bandwidth and gain. The outputs are summed.

Vowel identity is determined by formant frequencies -- resonant peaks in the vocal tract's transfer function. F1 and F2 alone distinguish most vowels: /a/ has F1~730Hz, F2~1090Hz; /i/ has F1~270Hz, F2~2290Hz. F3 adds speaker-specific color. By tuning a bank of resonators to these frequencies, you can impose vowel character on any source signal (noise, impulse train, synth waveform).

Default formants approximate the open vowel /a/.

```js
import formant from 'digital-filter/eq/formant.js'

// Vowel /i/ ("ee")
let params = {
  formants: [
    { fc: 270,  bw: 60,  gain: 1 },    // F1
    { fc: 2290, bw: 90,  gain: 0.5 },  // F2
    { fc: 3010, bw: 100, gain: 0.3 }   // F3
  ],
  fs: 44100
}
formant(data, params)
```

## Vocoder

Channel vocoder -- analyzes the spectral envelope of a modulator signal (typically voice) and applies it to a carrier signal (typically a synth waveform). The classic "robot voice" / "talking synthesizer" effect.

How it works, band by band:
1. **Analysis**: bandpass-filter the modulator, extract its envelope (amplitude over time)
2. **Synthesis**: bandpass-filter the carrier at the same frequency
3. **Multiply**: scale the carrier band by the modulator's envelope

Sum all bands to produce the output. The carrier provides the pitch and harmonic content; the modulator provides the spectral shape (the vowels, consonants, articulation).

More bands = finer spectral resolution = more intelligible speech transfer. 16 bands is a practical default; 32+ for high-fidelity vocoding.

```js
import vocoder from 'digital-filter/eq/vocoder.js'

let params = { bands: 16, fmin: 100, fmax: 8000, fs: 44100 }
let output = vocoder(carrier, modulator, params)
// output is a new Float64Array
```

## When to use what

| Need | Module | Why |
|---|---|---|
| Simple tone shaping, quick adjustments | `graphicEq` | Fixed bands, one parameter per band |
| Precision frequency surgery | `parametricEq` | Full control over fc, Q, gain, type |
| Split into frequency bands | `crossover` | Linkwitz-Riley sums flat |
| Better headphone imaging | `crossfeed` | Restores natural interaural crosstalk |
| Vowel synthesis, speech modeling | `formant` | Parallel resonators at formant frequencies |
| Spectral envelope transfer | `vocoder` | "Make this synth talk" |
