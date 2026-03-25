'use strict'

module.exports = freqz

function freqz (coefs, n, fs) {
	if (!n) n = 512
	if (!fs) fs = 44100
	if (!Array.isArray(coefs)) coefs = [coefs]

	let frequencies = new Float64Array(n)
	let magnitude = new Float64Array(n)
	let phase = new Float64Array(n)

	for (let i = 0; i < n; i++) {
		let w = i * Math.PI / n
		frequencies[i] = i * fs / (2 * n)

		let cosw = Math.cos(w), sinw = Math.sin(w)
		let cos2w = Math.cos(2 * w), sin2w = Math.sin(2 * w)

		let totalMag = 1
		let totalPhase = 0

		for (let j = 0; j < coefs.length; j++) {
			let c = coefs[j]
			let br = c.b0 + c.b1 * cosw + c.b2 * cos2w
			let bi = -c.b1 * sinw - c.b2 * sin2w
			let ar = 1 + c.a1 * cosw + c.a2 * cos2w
			let ai = -c.a1 * sinw - c.a2 * sin2w

			totalMag *= Math.sqrt((br * br + bi * bi) / (ar * ar + ai * ai))
			totalPhase += Math.atan2(bi, br) - Math.atan2(ai, ar)
		}

		magnitude[i] = totalMag
		phase[i] = totalPhase
	}

	return { frequencies, magnitude, phase }
}

freqz.mag2db = function (mag) {
	if (typeof mag === 'number') return 20 * Math.log10(mag)
	let db = new Float64Array(mag.length)
	for (let i = 0; i < mag.length; i++) db[i] = 20 * Math.log10(mag[i])
	return db
}
