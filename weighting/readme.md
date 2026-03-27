# Acoustic Weighting Filters

Frequency weighting curves reshape a signal's spectrum to match how humans perceive loudness -- or to meet a measurement standard. Each curve is a fixed filter: apply it before measuring level, and the number you get correlates with subjective experience (or regulatory requirement) rather than raw physics.

## Background

In 1933 Fletcher and Munson published the first equal-loudness contours: lines on a frequency-vs-SPL plot where every point sounds equally loud. The ear is most sensitive around 3--4 kHz and dramatically less sensitive at low frequencies, especially at quiet levels. As level increases, the curve flattens -- loud sounds are perceived more evenly across frequency.

Standardization bodies (IEC, ITU, ANSI) turned these contours into weighting filters: fixed frequency-domain curves applied to a measurement signal so that a single dB(A) or dB(C) number reflects perceived loudness rather than physical energy.

## Filters

### a-weighting.js

The A-weighting curve approximates the 40-phon equal-loudness contour (ISO 226). It heavily attenuates bass (about -26 dB at 125 Hz, -39 dB at 31.5 Hz) and gently rolls off above 6 kHz. Normalized to 0 dB at 1 kHz.

Standardized in **IEC 61672**. This is THE default weighting for noise measurement -- occupational health (OSHA, NIOSH), environmental noise regulations, consumer electronics specifications, and nearly every sound level meter on earth.

The analog transfer function:

$$H_A(s) = \frac{K \cdot s^4}{(s + \omega_1)^2 \,(s + \omega_2)\,(s + \omega_3)\,(s + \omega_4)^2}$$

where $\omega_1 = 2\pi \cdot 20.6\,\text{Hz}$, $\omega_2 = 2\pi \cdot 107.7\,\text{Hz}$, $\omega_3 = 2\pi \cdot 737.9\,\text{Hz}$, $\omega_4 = 2\pi \cdot 12194\,\text{Hz}$, and $K$ normalizes to 0 dB at 1 kHz.

Implementation decomposes this into 3 biquad sections via bilinear transform with frequency prewarping.

```js
import aWeighting from 'digital-filter/weighting/a-weighting.js'
import filter from 'digital-filter/core/filter.js'

let sos = aWeighting(44100)   // 3 biquad sections
filter(data, { coefs: sos })  // apply in-place
```

**API**: `aWeighting(fs?)` &rarr; `SOS[]` (3 sections)
- `fs` -- sample rate in Hz (default 44100)

![A-weighting](../plots/a-weighting.svg)

---

### c-weighting.js

C-weighting is nearly flat across the audible range, approximating the 100-phon equal-loudness contour. Only the extreme low and high ends are attenuated (same corner frequencies as A-weighting at 20.6 Hz and 12194 Hz, but without the mid-frequency shaping).

Used for **peak SPL measurement**, concert/venue sound levels, and impulse noise assessment. When you see "dB(C)" on a spec sheet, this is the curve.

```js
import cWeighting from 'digital-filter/weighting/c-weighting.js'

let sos = cWeighting(48000)   // 2 biquad sections
```

**API**: `cWeighting(fs?)` &rarr; `SOS[]` (2 sections)
- `fs` -- sample rate in Hz (default 44100)

![C-weighting](../plots/c-weighting.svg)

---

### k-weighting.js

K-weighting is the pre-filter for **LUFS loudness metering** per ITU-R BS.1770. Two cascaded stages:

1. **High-shelf** (+4 dB above ~1.5 kHz) -- models the acoustic effect of the head (head-related transfer function).
2. **Highpass** (38 Hz, 2nd-order Butterworth) -- removes subsonic content that contributes energy but not perceived loudness.

This is the filter behind every streaming platform's loudness normalization: **Spotify** (-14 LUFS), **YouTube** (-14 LUFS), **Apple Music** (-16 LUFS), and broadcast standards (**EBU R128**, -23 LUFS).

At 48 kHz the exact ITU-R BS.1770-4 coefficients are used. At other sample rates, the filter is approximated via biquad design.

```js
import kWeighting from 'digital-filter/weighting/k-weighting.js'

let sos = kWeighting(48000)   // 2 biquad sections (exact ITU coefficients)
let sos2 = kWeighting(96000)  // 2 biquad sections (approximated)
```

**API**: `kWeighting(fs?)` &rarr; `SOS[]` (2 sections)
- `fs` -- sample rate in Hz (default 48000)

![K-weighting](../plots/k-weighting.svg)

---

### itu468.js

ITU-R BS.468 (also known as CCIR-468) noise weighting. Peaked response: **+12.2 dB at 6.3 kHz**, steep rolloff above 10 kHz, gradual rolloff below 1 kHz.

Developed by the **BBC** for measuring equipment noise. A-weighting was found to underestimate the subjective annoyance of high-frequency noise -- hiss, hum harmonics, and quantization artifacts sound worse than A-weighted measurements suggest. ITU-468 corrects this by emphasizing the 2--8 kHz region where the ear is most irritated by noise.

Still the standard for professional audio equipment specifications and broadcast equipment testing.

This implementation is a practical IIR approximation (cascaded biquads) accurate within ~1 dB across 31.5 Hz--20 kHz.

```js
import itu468 from 'digital-filter/weighting/itu468.js'

let sos = itu468(48000)   // 4 biquad sections
```

**API**: `itu468(fs?)` &rarr; `SOS[]` (4 sections)
- `fs` -- sample rate in Hz (default 48000)

![ITU-R 468](../plots/itu468.svg)

---

### riaa.js

**RIAA playback equalization** (de-emphasis) for vinyl records. This is NOT a perceptual weighting curve -- it is the inverse of the recording EQ applied during vinyl cutting.

Vinyl records are cut with boosted treble and reduced bass (the RIAA recording curve). On playback, the inverse is applied: **bass boost below 500 Hz, treble cut above 2122 Hz**. This is necessary because low frequencies require wide groove excursions (which limits playing time), and high frequencies need boosting to rise above surface noise.

Three time constants define the curve:
- $T_1 = 3180\,\mu\text{s}$ &rarr; pole at 50.05 Hz
- $T_2 = 318\,\mu\text{s}$ &rarr; zero at 500.5 Hz
- $T_3 = 75\,\mu\text{s}$ &rarr; pole at 2122 Hz

Normalized to 0 dB at 1 kHz. Implemented as a single biquad section via bilinear transform.

```js
import riaa from 'digital-filter/weighting/riaa.js'

let sos = riaa(44100)   // 1 biquad section
```

**API**: `riaa(fs?)` &rarr; `SOS[]` (1 section)
- `fs` -- sample rate in Hz (default 44100)

![RIAA](../plots/riaa.svg)

## Comparison

Approximate gain (dB) at key frequencies, normalized to 0 dB at 1 kHz:

| Frequency | A-weighting | C-weighting | K-weighting | ITU-R 468 | RIAA |
|---|---|---|---|---|---|
| 31.5 Hz | -39.4 | -3.0 | -∞ (HPF) | -29.9 | +19.3 |
| 125 Hz | -16.1 | -0.2 | -0.1 | -12.9 | +13.1 |
| 1 kHz | 0 | 0 | 0 | 0 | 0 |
| 4 kHz | +1.0 | -0.8 | +3.6 | +8.4 | -7.5 |
| 10 kHz | -2.5 | -3.0 | +3.0 | +2.6 | -13.7 |

## Which weighting?

| Task | Use |
|---|---|
| General noise measurement | A-weighting |
| Peak SPL, concert/venue levels | C-weighting |
| Broadcast/streaming loudness (LUFS) | K-weighting |
| Equipment noise specs, broadcast | ITU-R 468 |
| Vinyl playback | RIAA |
