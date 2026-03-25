/**
 * Group delay computation from SOS coefficients
 * Returns -dφ/dω for each frequency bin.
 *
 * @module  digital-filter/group-delay
 */

export default function groupDelay (coefs, n, fs) {
	if (!n) n = 512
	if (!fs) fs = 44100
	if (!Array.isArray(coefs)) coefs = [coefs]

	let frequencies = new Float64Array(n)
	let delay = new Float64Array(n)

	for (let i = 0; i < n; i++) {
		let w = i * Math.PI / n
		frequencies[i] = i * fs / (2 * n)

		let totalDelay = 0

		for (let j = 0; j < coefs.length; j++) {
			let c = coefs[j]
			let cosw = Math.cos(w), sinw = Math.sin(w)
			let cos2w = Math.cos(2 * w), sin2w = Math.sin(2 * w)

			// Numerator: B(z) = b0 + b1*z^-1 + b2*z^-2
			let br = c.b0 + c.b1 * cosw + c.b2 * cos2w
			let bi = -c.b1 * sinw - c.b2 * sin2w
			let dbr = -c.b1 * sinw - 2 * c.b2 * sin2w
			let dbi = -c.b1 * cosw - 2 * c.b2 * cos2w

			// Denominator: A(z) = 1 + a1*z^-1 + a2*z^-2
			let ar = 1 + c.a1 * cosw + c.a2 * cos2w
			let ai = -c.a1 * sinw - c.a2 * sin2w
			let dar = -c.a1 * sinw - 2 * c.a2 * sin2w
			let dai = -c.a1 * cosw - 2 * c.a2 * cos2w

			// Group delay = Re{ (dB/dw)/B - (dA/dw)/A }
			let numGD = (dbr * br + dbi * bi) / (br * br + bi * bi)
			let denGD = (dar * ar + dai * ai) / (ar * ar + ai * ai)

			totalDelay += numGD - denGD
		}

		delay[i] = totalDelay
	}

	return { frequencies, delay }
}
