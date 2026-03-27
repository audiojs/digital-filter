/**
 * Frequency-warped FIR filter using first-order allpass delay elements.
 * Concentrates frequency resolution at low frequencies (matches hearing).
 *
 * @module  digital-filter/warped-fir
 */

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { coefs: FIR coefficients, lambda: warping factor (-1 to 1) }
 */
export default function warpedFir (data, params) {
	let h = params.coefs
	let lambda = params.lambda || 0.7  // typical for audio at 44.1kHz
	let N = h.length

	if (!params._s) params._s = new Float64Array(N)
	let s = params._s

	for (let i = 0, len = data.length; i < len; i++) {
		// Output: sum of FIR coefficients x warped delay line
		let y = h[0] * data[i]
		for (let j = 1; j < N; j++) y += h[j] * s[j - 1]

		// Update allpass chain (warped delay line)
		for (let j = N - 1; j >= 1; j--) {
			s[j] = s[j - 1] + lambda * (s[j] - s[j - 1])
		}
		s[0] = data[i] + lambda * (s[0] - data[i])

		data[i] = y
	}

	return data
}
