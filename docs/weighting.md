# Weighting Filters

Frequency-dependent curves that model how humans perceive sound, standardized for measurement. A weighting filter reshapes a signal so that the measured level matches the perceived loudness — because human hearing is not flat.

## Why weighting filters exist

Human hearing sensitivity depends on frequency. A 100 Hz tone at 60 dB SPL sounds much quieter than a 1 kHz tone at 60 dB SPL. Fletcher and Munson (1933) measured this systematically, producing the equal-loudness contours: curves showing which SPL is needed at each frequency to sound equally loud. These contours are not flat — they dip at 2–5 kHz (where the ear canal resonance amplifies sound) and rise sharply below 500 Hz and above 10 kHz.

A weighting filter inverts these contours: it attenuates frequencies where the ear is insensitive (low bass, extreme highs) and passes frequencies where the ear is most sensitive (1–6 kHz). After filtering, the RMS level of the weighted signal corresponds to the perceived loudness.

Different weighting curves exist because:
- Loudness perception changes with level (A-weighting fits ~40 phon, C-weighting fits ~100 phon).
- Different industries need different measurements (broadcast loudness uses K-weighting, noise measurement uses A-weighting, BBC noise specs use ITU-R 468).
- Some "weighting" filters serve entirely different purposes (RIAA is for vinyl equalization, not psychoacoustics).

## Weighting filter comparison

All measurements relative to 1 kHz (0 dB reference):

| Frequency | A-weighting | C-weighting | K-weighting | ITU-R 468 | RIAA |
|---|---|---|---|---|---|
| 31.5 Hz | -39.4 dB | -3.0 dB | -13 dB | -29 dB | +19.3 dB |
| 125 Hz | -16.1 dB | -0.2 dB | -0.2 dB | -13 dB | +10.0 dB |
| 500 Hz | -3.2 dB | 0.0 dB | 0.0 dB | -4 dB | +3.0 dB |
| 1 kHz | 0.0 dB | 0.0 dB | 0.0 dB | 0.0 dB | 0.0 dB |
| 2 kHz | +1.2 dB | -0.2 dB | +3.9 dB | +5.6 dB | -2.6 dB |
| 4 kHz | +1.0 dB | -0.8 dB | +3.9 dB | +11.0 dB | -7.8 dB |
| 6.3 kHz | +1.0 dB | -2.0 dB | +3.9 dB | +12.2 dB | -11.9 dB |
| 10 kHz | -2.5 dB | -4.4 dB | +3.9 dB | +5.0 dB | -16.0 dB |
| 16 kHz | -6.6 dB | -8.5 dB | +3.9 dB | -10 dB | -21.7 dB |

**Reading the table:** A-weighting heavily attenuates bass. C-weighting is nearly flat. K-weighting boosts the high end where the ear is sensitive and dialog is concentrated. ITU-R 468 has a large peak at 6.3 kHz reflecting the ear's peak sensitivity to noise. RIAA is inverted relative to the others — it boosts bass and cuts treble to reverse the vinyl recording curve.

---

## A-weighting

![A-weighting frequency response](plots/a-weighting.svg)

### What it is

The most widely used frequency weighting curve. A-weighting approximates the inverse of the human equal-loudness contour at ~40 phon (quiet listening levels). It heavily attenuates frequencies below 500 Hz (-39 dB at 31.5 Hz) and mildly attenuates above 10 kHz. The result: measured dB(A) values correlate well with perceived loudness for moderate sound levels.

### Standard

IEC 61672-1:2013 "Electroacoustics — Sound level meters." This standard defines the exact analog transfer function with four corner frequencies.

### When it is required

- **Occupational noise regulations worldwide** (OSHA, EU Directive 2003/10/EC): all workplace noise measurements are in dB(A).
- **Environmental noise standards** (ISO 1996): traffic, aircraft, industrial noise assessments.
- **Building acoustics** (ISO 16283): sound insulation measurements.
- **Consumer product noise ratings**: appliance noise labels, HVAC specifications.
- **Most noise ordinances**: city/county noise limits are almost universally specified in dB(A).

A-weighting is the default. If a regulation says "dB" without specifying a weighting, it almost always means dB(A).

### When NOT to use it

For very loud sounds (use C-weighting — A-weighting underestimates low-frequency perception at high SPL). For broadcast loudness metering (use K-weighting per ITU-R BS.1770). For characterizing equipment noise floors (use ITU-R 468). A-weighting underestimates the annoyance of low-frequency noise at moderate-to-high levels.

### How it sounds

Feed audio through an A-weighting filter and listen: bass disappears almost completely. Sub-bass is inaudible. The midrange (1–4 kHz) passes through unchanged. High treble is slightly attenuated. The result sounds thin and mid-focused — which is exactly how our ears perceive quiet sounds.

### How it works

The analog prototype is a cascade of:
- Two high-pass poles at 20.6 Hz (removes sub-bass, -12 dB/oct below 20 Hz)
- One high-pass pole at 107.7 Hz (additional bass rolloff)
- One high-pass pole at 737.9 Hz (shapes the midrange transition)
- Two low-pass poles at 12194 Hz (rolls off extreme treble)

Total: 4 zeros at DC, 2 poles at 20.6 Hz, 1 pole at 107.7 Hz, 1 pole at 737.9 Hz, 2 poles at 12194 Hz. This is decomposed into 3 biquad sections via bilinear transform, with prewarping at each corner frequency. The gain is normalized to 0 dB at 1 kHz.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `fs` | number | 44100 | > 0 | Sample rate in Hz |

Returns an array of 3 biquad sections `[{b0,b1,b2,a1,a2}, ...]`.

### Example

```js
import { aWeighting, filter } from 'digital-filter'

// Measure A-weighted sound level
let coefs = aWeighting(48000)
let weighted = Float64Array.from(signal)
filter(weighted, { coefs })

// Compute RMS → dB(A)
let rms = Math.sqrt(weighted.reduce((s, x) => s + x * x, 0) / weighted.length)
let dbA = 20 * Math.log10(rms / 2e-5)  // ref: 20 μPa
```

### Comparison

vs **C-weighting**: A-weighting rolls off bass aggressively (-39 dB at 31.5 Hz); C-weighting is nearly flat (-3 dB at 31.5 Hz). A-weighting is for measuring perceived loudness at moderate levels; C-weighting is for peak measurements or very loud environments. The difference "C - A" in dB indicates how much low-frequency content is present.

vs **K-weighting**: A-weighting is defined by acoustics standards for sound pressure level. K-weighting is defined by broadcast standards for program loudness. A-weighting attenuates bass; K-weighting boosts the high end. They solve different problems.

### References

- IEC 61672-1:2013, "Electroacoustics — Sound level meters — Part 1: Specifications."
- H. Fletcher & W.A. Munson, "Loudness, its Definition, Measurement and Calculation," *JASA*, vol. 5, pp. 82–108, 1933.
- ISO 226:2003, "Normal Equal-Loudness Level Contours."

---

## C-weighting

![C-weighting frequency response](plots/c-weighting.svg)

### What it is

A nearly-flat frequency weighting that approximates human loudness perception at very high sound levels (~100 phon). Where A-weighting models quiet listening, C-weighting models loud listening — at high SPL, the ear's sensitivity becomes more uniform across frequencies, so less correction is needed. C-weighting only attenuates the extreme ends: -3 dB at 31.5 Hz and -8.5 dB at 16 kHz. The midrange (100 Hz – 8 kHz) is essentially flat.

### Standard

IEC 61672-1:2013. Defined alongside A-weighting using the same corner frequencies but with fewer poles (only the 20.6 Hz and 12194 Hz double-poles, no mid-frequency shaping).

### When it is required

- **Peak sound pressure measurements**: C-weighting is used for Lpeak (peak SPL) per IEC 61672.
- **Live music and concert venues**: sound level limits for peak measurements.
- **Impulse noise assessment**: gunshots, explosions, hammering — events where the peak level matters more than the average loudness.
- **Low-frequency noise evaluation**: when you suspect A-weighting underestimates the actual loudness because of strong bass content, measure both dB(A) and dB(C). If dB(C) - dB(A) > 10, significant low-frequency energy is present.

### When NOT to use it

For general-purpose noise measurement (use A-weighting — it is the legal standard in most contexts). For broadcast loudness (use K-weighting). C-weighting is not commonly mandated as a standalone measurement; it is most useful as a complement to A-weighting.

### How it sounds

Almost no audible change. The bass is barely attenuated, the midrange is flat, and only extreme treble drops slightly. C-weighted playback sounds nearly identical to unweighted — which is the point: at loud levels, the ear hears nearly everything.

### How it works

The analog prototype has only the outermost poles from the A-weighting curve:
- Two high-pass poles at 20.6 Hz (2 zeros at DC)
- Two low-pass poles at 12194 Hz

Total: 2 biquad sections. No mid-frequency shaping. Normalized to 0 dB at 1 kHz.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `fs` | number | 44100 | > 0 | Sample rate in Hz |

Returns an array of 2 biquad sections.

### Example

```js
import { cWeighting, filter } from 'digital-filter'

// C-weighted peak measurement
let coefs = cWeighting(48000)
let weighted = Float64Array.from(signal)
filter(weighted, { coefs })

let peak = Math.max(...weighted.map(Math.abs))
let dbC = 20 * Math.log10(peak / 2e-5)
```

### Comparison

vs **A-weighting**: C-weighting passes bass nearly untouched (-3 dB at 31.5 Hz); A-weighting cuts it severely (-39 dB). Use A for perceived loudness at moderate levels; use C for peak measurements and low-frequency assessment.

vs **Flat (no weighting)**: C-weighting is nearly flat but rolls off the extreme low and high ends. For a true flat measurement (Z-weighting), use no filter.

### References

- IEC 61672-1:2013, "Electroacoustics — Sound level meters — Part 1: Specifications."

---

## K-weighting

![K-weighting frequency response](plots/k-weighting.svg)

### What it is

The weighting filter used for loudness metering in broadcasting. K-weighting consists of two stages: a high-shelf filter that boosts frequencies above ~1.5 kHz by ~4 dB (modeling the acoustic effect of the human head), followed by a high-pass filter at ~38 Hz (removing sub-bass content that does not contribute to perceived loudness). K-weighting is the front end of the LUFS (Loudness Units relative to Full Scale) measurement defined by ITU-R BS.1770.

### Standard

ITU-R BS.1770-4 "Algorithms to measure audio programme loudness and true-peak audio level." The exact biquad coefficients are specified in the standard for 48 kHz sample rate.

### When it is required

- **Broadcast television and radio**: EBU R128 (Europe), ATSC A/85 (US), ARIB TR-B32 (Japan) — all mandate LUFS metering per ITU-R BS.1770.
- **Streaming platforms**: Spotify (-14 LUFS), YouTube (-14 LUFS), Apple Music (-16 LUFS) — all use LUFS for normalization.
- **Podcast loudness**: Apple Podcasts recommends -16 LUFS ± 1.
- **Cinema**: Dolby requires dialog at -24 LKFS (= -24 LUFS).

If you produce audio for any broadcast or streaming platform, you need K-weighting.

### When NOT to use it

For sound pressure level measurement (use A-weighting — K-weighting is not a substitute for SPL metering). For noise floor measurement (use ITU-R 468). K-weighting is specifically for program loudness, not environmental acoustics.

### How it sounds

Compared to flat: the high end is boosted by ~4 dB (dialog, sibilance, hi-hats become louder) and the extreme low end is rolled off. The effect is subtle but meaningful — it increases the weight of the frequency range where speech intelligibility lives (2–8 kHz), reflecting that humans are most sensitive to sounds in this range.

### How it works

Two cascaded biquad stages:

**Stage 1 — Head-related shelf**: A high-shelf filter boosting ~+4 dB above 1.5 kHz. This models the acoustic gain of the human head — sound arriving from the front is amplified at high frequencies due to diffraction around the head and pinna effects. The exact coefficients for 48 kHz are specified in ITU-R BS.1770-4.

**Stage 2 — Highpass (RLB weighting)**: A 2nd-order Butterworth highpass at ~38 Hz. This removes sub-bass that the ear barely perceives. "RLB" stands for "Revised Low-frequency B-curve."

For sample rates other than 48 kHz, the library approximates the standard coefficients using equivalent biquad design (high shelf at 1681 Hz, +4.0 dB, and highpass at 38 Hz with Butterworth Q).

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `fs` | number | 48000 | > 0 | Sample rate in Hz. Exact ITU coefficients used at 48 kHz. |

Returns an array of 2 biquad sections.

### Example

```js
import { kWeighting, filter } from 'digital-filter'

// K-weighted loudness measurement
let coefs = kWeighting(48000)
let weighted = Float64Array.from(signal)
filter(weighted, { coefs })

// RMS of K-weighted signal
let rms = Math.sqrt(weighted.reduce((s, x) => s + x * x, 0) / weighted.length)
let lufs = -0.691 + 20 * Math.log10(rms)  // simplified single-channel LUFS
```

### Comparison

vs **A-weighting**: A-weighting cuts bass heavily and is nearly flat in the midrange. K-weighting boosts the high end by +4 dB and lightly cuts only sub-bass. They model different things: A-weighting models equal-loudness at 40 phon; K-weighting models the acoustic effect of a human head plus the perceptual irrelevance of sub-bass.

vs **ITU-R 468**: ITU-R 468 has a dramatic +12 dB peak at 6.3 kHz and is designed for noise measurement. K-weighting is a gentle +4 dB shelf designed for program loudness. They are not interchangeable.

### References

- ITU-R BS.1770-4, "Algorithms to measure audio programme loudness and true-peak audio level," 2015.
- EBU R128, "Loudness normalisation and permitted maximum level of audio signals," 2014.
- EBU Tech 3341, "Loudness Metering: 'EBU Mode' metering to supplement EBU R128," 2014.

---

## ITU-R 468

### What it is

A noise weighting curve developed by the BBC and standardized by the ITU for measuring audio equipment noise. Unlike A-weighting (which models loudness perception at moderate levels), ITU-R 468 models the ear's sensitivity to *noise* specifically — and the ear is much more sensitive to noise in the 4–8 kHz range than A-weighting suggests. The curve peaks at +12.2 dB at 6.3 kHz, reflecting the ear canal resonance and the perceptual prominence of hiss in that frequency range.

### Standard

ITU-R BS.468-4 "Measurement of Audio-Frequency Noise Voltage in Sound Broadcasting." Originally CCIR-468, adopted by the BBC, IBA, and later standardized internationally.

### When it is required

- **Broadcast audio equipment specifications**: the BBC and most European broadcasters specify equipment noise floors using ITU-R 468 weighting (not A-weighting).
- **Audio equipment datasheets**: professional audio manufacturers often quote both A-weighted and 468-weighted noise figures. The 468 figure is always higher (worse) because of the 6.3 kHz boost.
- **Dolby noise reduction system testing**: Dolby Labs uses 468 weighting for noise measurements.

### When NOT to use it

For regulatory noise measurements (those require A-weighting per IEC 61672). For broadcast loudness metering (use K-weighting per ITU-R BS.1770). ITU-R 468 is specifically for equipment noise characterization.

### How it sounds

The 6.3 kHz peak is dramatic. Feed audio through ITU-R 468 and listen: high-frequency content is massively amplified. Tape hiss, preamp noise, and analog noise become painfully prominent. Bass nearly disappears. The filter exaggerates exactly what the ear finds most annoying about noise.

### How it works

This implementation approximates the ITU-R 468 curve using 4 cascaded biquad sections:
- A highpass at 20 Hz (removes sub-bass)
- A peaking filter at 6.3 kHz, +12.2 dB, Q≈0.72 (the characteristic peak)
- A high-shelf at 1.25 kHz, +5.6 dB (raises the upper midrange)
- A lowpass at 22 kHz (the steep rolloff above 10 kHz)

The approximation is accurate within ~1 dB across 31.5 Hz – 20 kHz. The original standard defines the curve as a table of values; the biquad approximation is practical for real-time implementation.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `fs` | number | 48000 | > 0 | Sample rate in Hz |

Returns an array of 4 biquad sections.

### Example

```js
import { itu468, filter } from 'digital-filter'

// Measure equipment noise floor with ITU-R 468 weighting
let coefs = itu468(48000)
let weighted = Float64Array.from(noiseFloorSample)
filter(weighted, { coefs })

// Quasi-peak detection (the standard specifies quasi-peak, not RMS)
// Simplified: use RMS as approximation
let rms = Math.sqrt(weighted.reduce((s, x) => s + x * x, 0) / weighted.length)
let dBq = 20 * Math.log10(rms)
```

### Comparison

vs **A-weighting**: A-weighting has a maximum boost of +1.2 dB at 2 kHz. ITU-R 468 peaks at +12.2 dB at 6.3 kHz — a 10 dB difference in the region where hiss lives. An amplifier that measures -90 dB(A) might measure only -80 dB(468). The 468 measurement is more representative of how annoying the noise sounds.

vs **K-weighting**: K-weighting boosts by +4 dB above 1.5 kHz — much less aggressive than ITU-R 468's +12 dB peak. K-weighting measures program loudness; ITU-R 468 measures noise annoyance. Different tools for different purposes.

### References

- ITU-R BS.468-4, "Measurement of Audio-Frequency Noise Voltage in Sound Broadcasting."
- R. Dolby, D. Robinson, & K. Gundry, "A Practical Noise Measurement Method," *JAES*, vol. 27, no. 3, 1979.
- BBC Research Report 1968/8, "The Assessment of Noise in Audio-Frequency Circuits."

---

## RIAA

![RIAA playback equalization](plots/riaa.svg)

### What it is

The RIAA equalization curve is the playback (de-emphasis) filter for vinyl records. It is not a psychoacoustic weighting — it reverses the deliberate frequency distortion applied during vinyl cutting. Records are cut with boosted treble and reduced bass (to keep groove widths manageable and improve signal-to-noise ratio). The RIAA playback curve inverts this: it boosts bass and cuts treble, restoring the original flat response.

### Standard

RIAA (Recording Industry Association of America) equalization standard, adopted in 1954. Replaced the dozens of competing equalization curves that had made records incompatible between labels.

### When it is required

- **Vinyl playback**: every phono preamplifier must implement the RIAA curve. Without it, vinyl sounds thin and harsh.
- **Vinyl digitization**: when digitizing records, the RIAA curve must be applied either in analog (phono preamp) or digitally.
- **Audio archaeology**: playing back historical recordings from the pre-RIAA era requires different EQ curves (Columbia, NAB, etc.), but the RIAA curve is the standard for post-1954 records.

### When NOT to use it

For any purpose other than vinyl equalization. RIAA is not a psychoacoustic weighting and has no application to noise measurement, loudness metering, or general filtering.

### How it sounds

Bass is boosted dramatically (+19 dB at 31.5 Hz relative to 1 kHz). Treble is cut severely (-16 dB at 10 kHz). The effect transforms a thin, hissy signal into a warm, full recording with deep bass and smooth highs. Without the RIAA curve, a vinyl record sounds like a telephone call through a seashell.

### How it works

The RIAA curve is defined by three time constants that determine three corner frequencies:

| Time constant | Frequency | What it does |
|---|---|---|
| T1 = 3180 μs | 50.05 Hz | Pole: bass boost below 50 Hz |
| T2 = 318 μs | 500.5 Hz | Zero: transition from boost to cut |
| T3 = 75 μs | 2122 Hz | Pole: treble cut above 2122 Hz |

The transfer function is:

```
H(s) = (1 + s·T2) / ((1 + s·T1) · (1 + s·T3))
```

This is a single biquad section (one zero, two poles). The bilinear transform converts it to digital form with prewarping at each corner frequency. The gain is normalized to 0 dB at 1 kHz.

### Key characteristics

- **Bass boost**: +19.3 dB at 31.5 Hz, +10.0 dB at 125 Hz.
- **Treble cut**: -7.8 dB at 4 kHz, -16 dB at 10 kHz, -21.7 dB at 16 kHz.
- **Noise reduction**: The treble cut acts as a lowpass filter, reducing surface noise and hiss by ~20 dB at high frequencies. This is the primary purpose of the recording/playback equalization scheme.
- **Section count**: 1 biquad (first-order numerator, second-order denominator).

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `fs` | number | 44100 | > 0 | Sample rate in Hz |

Returns an array of 1 biquad section.

### Example

```js
import { riaa, filter } from 'digital-filter'

// Apply RIAA playback equalization to digitized vinyl
let coefs = riaa(44100)
let vinyl = Float64Array.from(rawPhonographSignal)
filter(vinyl, { coefs })
// vinyl now has correct frequency balance
```

### Comparison

vs **A-weighting**: A-weighting attenuates bass; RIAA boosts it. They are unrelated — A-weighting is a psychoacoustic measurement tool, RIAA is a recording equalization standard.

vs **Pre-emphasis/de-emphasis**: RIAA is a specific case of pre-emphasis (recording) + de-emphasis (playback). The general `emphasis`/`deemphasis` functions in this library implement customizable pre/de-emphasis with a single time constant. RIAA uses three time constants and a standardized curve.

### References

- RIAA Engineering Standards Committee, "RIAA Standard Recording and Reproducing Characteristic," 1954.
- S. Lipshitz & J. Vanderkooy, "The Great Debate: Subjective Evaluation of Digital Dither," *JAES*, vol. 40, no. 7/8, 1992. (Contains precise RIAA error analysis.)
- IEC 60098:1987, "Analogue Audio Disk Records and Reproducing Equipment."

---

## LUFS metering recipe

LUFS (Loudness Units relative to Full Scale) is the broadcast loudness standard. It combines K-weighting with gated power measurement per ITU-R BS.1770-4. Here is the full algorithm:

### Step 1: K-weight the signal

Apply K-weighting to each channel independently.

```js
import { kWeighting, filter } from 'digital-filter'

let coefs = kWeighting(48000)
let channels = audioChannels.map(ch => {
  let weighted = Float64Array.from(ch)
  filter(weighted, { coefs: kWeighting(48000) })
  return weighted
})
```

### Step 2: Compute mean square per 400ms block

Divide each channel into overlapping 400 ms blocks (75% overlap = 100 ms hop). Compute the mean square power of each block.

```js
let blockSize = Math.round(0.4 * sampleRate)  // 400 ms
let hop = Math.round(0.1 * sampleRate)          // 100 ms
let blocks = []

for (let start = 0; start + blockSize <= channels[0].length; start += hop) {
  let power = 0
  for (let ch = 0; ch < channels.length; ch++) {
    let sum = 0
    for (let i = start; i < start + blockSize; i++) {
      sum += channels[ch][i] * channels[ch][i]
    }
    // Channel weighting: surround channels get +1.5 dB (×1.41)
    let chWeight = (ch >= 3) ? 1.41 : 1.0  // Ls, Rs channels
    power += chWeight * sum / blockSize
  }
  blocks.push(power)
}
```

### Step 3: Absolute gate at -70 LUFS

Remove all blocks below the absolute threshold of -70 LUFS.

```js
let absThreshold = Math.pow(10, (-70 + 0.691) / 10)
let gated1 = blocks.filter(p => p > absThreshold)
```

### Step 4: Relative gate at -10 dB

Compute the mean of the surviving blocks. Set a new threshold at -10 dB relative to this mean. Remove all blocks below the relative threshold.

```js
let meanPower = gated1.reduce((s, p) => s + p, 0) / gated1.length
let relThreshold = meanPower * Math.pow(10, -10 / 10)  // -10 dB below mean
let gated2 = blocks.filter(p => p > relThreshold)
```

### Step 5: Compute LUFS

Average the surviving blocks and convert to LUFS.

```js
let finalPower = gated2.reduce((s, p) => s + p, 0) / gated2.length
let lufs = -0.691 + 10 * Math.log10(finalPower)
```

The `-0.691` offset is specified by ITU-R BS.1770 to align the scale with previous loudness standards.

### Practical targets

| Platform | Target LUFS | Tolerance |
|---|---|---|
| EBU R128 (European broadcast) | -23 LUFS | ± 1 LU |
| ATSC A/85 (US broadcast) | -24 LKFS | ± 2 LU |
| Spotify | -14 LUFS | — |
| YouTube | -14 LUFS | — |
| Apple Music | -16 LUFS | ± 1 LU |
| Apple Podcasts | -16 LUFS | ± 1 LU |
| Netflix | -27 LUFS | dialog normalized |

### References

- ITU-R BS.1770-4, "Algorithms to measure audio programme loudness and true-peak audio level," 2015.
- EBU R128, "Loudness normalisation and permitted maximum level of audio signals," 2014.
- EBU Tech 3341, "Loudness Metering: 'EBU Mode' metering to supplement EBU R128," 2014.
