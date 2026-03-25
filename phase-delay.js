/**
 * Compute phase delay of a filter.
 * Phase delay = -phase(ω) / ω
 * @param {Array|Object} coefs - SOS section(s)
 * @param {number} n - Number of frequency points (default 512)
 * @param {number} fs - Sample rate (default 44100)
 * @returns {{frequencies: Float64Array, delay: Float64Array}}
 */
export default function phaseDelay (coefs, n, fs) {
	if (!n) n = 512
	if (!fs) fs = 44100
	if (!Array.isArray(coefs)) coefs = [coefs]

	let frequencies = new Float64Array(n)
	let delay = new Float64Array(n)

	for (let i = 0; i < n; i++) {
		let w = i * Math.PI / n
		frequencies[i] = i * fs / (2 * n)

		let totalPhase = 0

		for (let j = 0; j < coefs.length; j++) {
			let c = coefs[j]
			let cosw = Math.cos(w), sinw = Math.sin(w)
			let cos2w = Math.cos(2*w), sin2w = Math.sin(2*w)

			let br = c.b0 + c.b1*cosw + c.b2*cos2w
			let bi = -c.b1*sinw - c.b2*sin2w
			let ar = 1 + c.a1*cosw + c.a2*cos2w
			let ai = -c.a1*sinw - c.a2*sin2w

			totalPhase += Math.atan2(bi, br) - Math.atan2(ai, ar)
		}

		// Phase delay = -phase / omega (in samples)
		delay[i] = w > 0 ? -totalPhase / w : 0
	}

	return { frequencies, delay }
}
