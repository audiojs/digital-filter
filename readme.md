# digital-filter [![experimental](https://img.shields.io/badge/stability-experimental-red.svg)](http://github.com/badges/stability-badges) [![Build Status](https://img.shields.io/travis/dfcreative/digital-filter.svg)](https://travis-ci.org/dfcreative/digital-filter)

Collection of digital filters, for audio & dsp applications.

## Usage

[![npm install digital-filter](https://nodei.co/npm/digital-filter.png?mini=true)](https://npmjs.org/package/digital-filter/)

Produce 1024 samples of [grey noise](https://en.wikipedia.org/wiki/Grey_noise):

```js
const noise = require('colors-of-noise/white')
const filter = require('digital-filter/loudness')

//generate frame of grey noise
let data = filter(noise(new Float32Array(1024)))
```

## Filters

* [x] [leaky integrator]()
* [x] [moving average]()
* [ ] [bilinear]()
* [ ] [biquad]()
* [ ] [loudness]()
* [ ] lowpass
* [ ] hipass
* [ ] rumble
* [ ] flutter
* [ ] noise
* [ ] bessel
* [ ] butterworth
* [ ] matched
* [ ] elliptical
* [ ] linkwitz-riley
* [ ] chebyshev
* [ ] inverse-chebyshev
* [ ] savitzky-golay
* [ ] curve (custom f-curve)

### leakyIntegrator(samples, {lambda: 0.95, y: 0})
<!--
[FIR]

[block scheme]

[formula]

[description]
-->
[Leaky integrator](https://en.wikipedia.org/wiki/Leaky_integrator).

Takes input array `samples` and params object, modifies `samples` in-place. Params object should be shared between subsequent calls.

Params:

* `lambda` − defines amount of "leak".
* `y` − keeps value of last sample, updated after every call.

```js
let leaky = require('digital-filter/leaky-integrator')

let opts = {lambda: .5}

//render 3 frames
for (let i = 0; i < 3; i++) {
	let data = new Float32Array(1024)
	leaky(data, opts)
}
```

### movingAverage(samples, {memory: 8})

[Moving average](https://en.wikipedia.org/wiki/Moving_average).

Takes input array `samples` and params object, modifies `samples` in-place. Params object should be shared between subsequent calls.

Params:

* `memory` − array with initial values of memory. If number, this will create an array of that size.

```js
let ma = require('digital-filter/moving-average')

//average of 5 items
let opts = {memory: 5}

for (let i = 0; i < 3; i++) {
	let data = new Float32Array(1024)
	ma(data, opts)
}
```

### bilinear(data, {order: 1, })

### loudness(data, {type: ''})

Implemented filter types:

* `a` — [A-weighting](https://en.wikipedia.org/wiki/A-weighting)
* `b` — B-weighting
* `c` — C-weighting
* `d` — D-weighting
* `z` — Z-weighting (zero weighting)
* `itu` — [ITU-R 468 weighting](https://en.wikipedia.org/wiki/ITU-R_468_noise_weighting)



## See also

* [audio-filter](https://github.com/audiojs/audio-filter) − digital filters for audio infrastructure
* [colors-of-noise](https://github.com/scijs/colors-of-noise) − collection of noise generators

<p align=center><a href="https://github.com/krishnized/license/">ॐ</a></p>
