/**
 * Gammatone auditory filter (cochlear model).
 * Cascade of complex one-pole filters (4th-order by default).
 *
 * @module  digital-filter/gammatone
 */

let { cos, sin, exp, PI } = Math

export default function gammatone (data, params) {
	let fc = params.fc || 1000
	let fs = params.fs || 44100
	let order = params.order || 4

	// ERB bandwidth
	let erb = 24.7 * (4.37 * fc / 1000 + 1)
	let b = 2 * PI * 1.019 * erb

	let T = 1 / fs
	let w = 2 * PI * fc * T
	let a = exp(-b * T)
	let cosW = a * cos(w), sinW = a * sin(w)

	// State: order complex pairs (re, im) + phase accumulator
	if (!params._s) params._s = new Float64Array(order * 2)
	let s = params._s

	for (let i = 0, n = data.length; i < n; i++) {
		let x = data[i]

		for (let j = 0; j < order; j++) {
			let re = s[j * 2], im = s[j * 2 + 1]
			let newRe = cosW * re - sinW * im + x
			let newIm = sinW * re + cosW * im
			s[j * 2] = newRe
			s[j * 2 + 1] = newIm
			x = newRe
		}

		data[i] = x
	}

	return data
}
