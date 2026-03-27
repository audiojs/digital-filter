# Auditory and Psychoacoustic Models

Filter banks that model how the human ear decomposes sound into frequency bands. The cochlea is not an FFT -- it is a bank of overlapping bandpass filters, each tuned to a different frequency, with bandwidth that increases with frequency. These modules provide computational equivalents for audio analysis, feature extraction, and psychoacoustic research.

## How hearing works

Sound enters the cochlea and travels along the **basilar membrane**, a tapered structure that vibrates at different positions for different frequencies. High frequencies excite the base (near the entrance), low frequencies excite the apex (the far end). This is **tonotopic mapping** -- frequency is encoded as position.

At each position, the membrane acts as a bandpass filter. The bandwidth of each filter is called a **critical band** -- frequencies within the same critical band interact (mask each other), frequencies in different bands are processed independently. Critical bandwidth is narrow at low frequencies (~100 Hz below 500 Hz) and wide at high frequencies (~2500 Hz at 10 kHz).

Three frequency scales model this nonlinear spacing.

## Frequency scales

### ERB (Equivalent Rectangular Bandwidth)

Glasberg & Moore 1990. The most accurate modern model of auditory filter bandwidth. The ERB of a filter centered at frequency $f$ is:

$$\text{ERB}(f) = 24.7 \cdot (4.37 \cdot f/1000 + 1)$$

The ERB-number scale (frequency in ERB units) is:

$$E(f) = 21.4 \cdot \log_{10}(4.37 \cdot f/1000 + 1)$$

Approximately 40 ERBs span the audible range. Used in modern psychoacoustic research, auditory modeling, and hearing aid design.

### Bark

Zwicker 1961. Divides the audible range into **24 critical bands** (Bark 1 through Bark 24). Each band corresponds to roughly 1.3 mm on the basilar membrane. The Bark scale was the foundation of psychoacoustic audio coding -- **MP3**, **AAC**, and other perceptual codecs use critical-band analysis to determine masking thresholds and allocate bits.

The 24 bands span approximately:

| Bark | Range | Bark | Range |
|---|---|---|---|
| 1 | 20--100 Hz | 13 | 1720--2000 Hz |
| 2 | 100--200 Hz | 14 | 2000--2320 Hz |
| 3 | 200--300 Hz | 15 | 2320--2700 Hz |
| 4 | 300--400 Hz | 16 | 2700--3150 Hz |
| 5 | 400--510 Hz | 17 | 3150--3700 Hz |
| 6 | 510--630 Hz | 18 | 3700--4400 Hz |
| 7 | 630--770 Hz | 19 | 4400--5300 Hz |
| 8 | 770--920 Hz | 20 | 5300--6400 Hz |
| 9 | 920--1080 Hz | 21 | 6400--7700 Hz |
| 10 | 1080--1270 Hz | 22 | 7700--9500 Hz |
| 11 | 1270--1480 Hz | 23 | 9500--12000 Hz |
| 12 | 1480--1720 Hz | 24 | 12000--15500 Hz |

### Octave

IEC 61260 standard. Divides the spectrum into bands spaced by octave fractions (1/1, 1/3, 1/6, etc.) with center frequencies derived from the ISO 266 reference: $f_c = 1000 \cdot G^{k/n}$ where $G = 10^{3/10} \approx 1.9953$ and $n$ is the fraction. The standard for acoustic measurement: room acoustics, noise surveys, vibration analysis.

## Filters

### gammatone.js

The **gammatone filter** is the standard computational model of a single auditory nerve fiber's frequency response. Its impulse response is:

$$h(t) = t^{n-1} \, e^{-2\pi b\,t} \, \cos(2\pi f_c\, t)$$

where $n$ is the filter order (4 is standard -- matches physiological measurements), $f_c$ is the center frequency, and $b = 1.019 \cdot \text{ERB}(f_c)$ is the decay rate derived from the equivalent rectangular bandwidth.

The implementation uses a cascade of $n$ complex one-pole filters, which is numerically efficient and naturally produces the $t^{n-1}$ envelope through repeated filtering.

Used in: automatic speech recognition (ASR) front-ends, hearing aid algorithms, auditory scene analysis, computational neuroscience, and any application that needs a perceptually-motivated frequency decomposition.

```js
import gammatone from 'digital-filter/auditory/gammatone.js'

let params = { fc: 1000, fs: 44100, order: 4 }
gammatone(data, params)   // in-place

// Stateful: params._s persists between calls
gammatone(chunk1, params)
gammatone(chunk2, params)
```

**API**: `gammatone(data, params)` &rarr; `data`
- `data` -- `Float32Array | Float64Array`, modified in-place
- `params.fc` -- center frequency Hz (default 1000)
- `params.fs` -- sample rate (default 44100)
- `params.order` -- filter order (default 4)

Gain is automatically normalized to 0 dB at the center frequency.

![Gammatone](../plots/gammatone.svg)

---

### erb-bank.js

Generates center frequencies and bandwidths spaced according to the **ERB scale** (Glasberg & Moore 1990). Returns band descriptors, not filter coefficients -- pair with `gammatone` to build a complete auditory filter bank.

The spacing ensures that adjacent bands overlap by approximately one ERB, matching the density of auditory filters on the basilar membrane.

```js
import erbBank from 'digital-filter/auditory/erb-bank.js'

let bands = erbBank(44100, { fmin: 50, fmax: 16000, density: 1 })
// [{ fc: 51.2, erb: 30.1, bw: 30.1 }, { fc: 83.5, ... }, ...]

// Build a gammatone filter bank:
import gammatone from 'digital-filter/auditory/gammatone.js'
for (let band of bands) {
  let channel = new Float64Array(data)
  gammatone(channel, { fc: band.fc, fs: 44100 })
}
```

**API**: `erbBank(fs?, opts?)` &rarr; `Array<{ fc, erb, bw }>`
- `fs` -- sample rate (default 44100)
- `opts.fmin` -- minimum frequency (default 50)
- `opts.fmax` -- maximum frequency (default 16000 or Nyquist)
- `opts.density` -- bands per ERB (default 1; use 2 for denser spacing)

---

### bark-bank.js

Generates a **Bark-scale filter bank**: 24 critical bands per Zwicker's psychoacoustic model. Returns band descriptors with biquad bandpass coefficients ready for filtering.

Each band's center frequency is the geometric mean of its edges, and the Q is set to match the critical bandwidth.

```js
import barkBank from 'digital-filter/auditory/bark-bank.js'
import filter from 'digital-filter/core/filter.js'

let bands = barkBank(44100)
// [{ bark: 1, fLow: 20, fHigh: 100, fc: 44.7, coefs: {...} }, ...]

// Filter into Bark bands:
for (let band of bands) {
  let channel = new Float64Array(data)
  filter(channel, { coefs: band.coefs })
}
```

**API**: `barkBank(fs?, opts?)` &rarr; `Array<{ bark, fLow, fHigh, fc, coefs }>`
- `fs` -- sample rate (default 44100)
- `opts.fmin` -- minimum frequency (default 20)
- `opts.fmax` -- maximum frequency (default 15500 or Nyquist)

---

### octave-bank.js

Generates an **IEC 61260 fractional-octave filter bank**. Center frequencies follow the ISO 266 standard: $f_c = 1000 \cdot G^{k/n}$ where $G = 10^{3/10}$. Returns band descriptors with biquad bandpass coefficients.

Common fractions: 1 (full octave, ~10 bands), 3 (1/3 octave, ~30 bands), 6 (1/6 octave, ~60 bands).

```js
import octaveBank from 'digital-filter/auditory/octave-bank.js'
import filter from 'digital-filter/core/filter.js'

let bands = octaveBank(3, 44100)              // 1/3 octave
let bands1 = octaveBank(1, 48000)             // full octave
let bands6 = octaveBank(6, 44100, { fmin: 100, fmax: 8000 })  // 1/6 octave, custom range

// Filter into octave bands:
for (let band of bands) {
  let channel = new Float64Array(data)
  filter(channel, { coefs: band.coefs })
}
```

**API**: `octaveBank(fraction?, fs?, opts?)` &rarr; `Array<{ fc, coefs }>`
- `fraction` -- octave fraction: 1, 3, 6, etc. (default 3)
- `fs` -- sample rate (default 44100)
- `opts.fmin` -- minimum center frequency (default 31.25)
- `opts.fmax` -- maximum center frequency (default 16000)

## When to use which scale

| Task | Scale | Why |
|---|---|---|
| Psychoacoustic research, auditory modeling | ERB | Most accurate modern model of cochlear filter bandwidth |
| Perceptual audio coding (MP3, AAC) | Bark | Standard in codec design; 24 bands map to masking thresholds |
| Acoustic measurement, room analysis | Octave | IEC/ISO standard; universally understood in engineering |
| ASR features, hearing aids | Gammatone + ERB | Biologically motivated; proven in speech and clinical applications |
