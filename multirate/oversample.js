import firwin from '../fir/firwin.js'

/**
 * Oversample a signal by a given factor with anti-alias filtering.
 * @param {Float64Array} data - Input signal
 * @param {number} factor - Oversampling factor (2, 4, 8, etc.)
 * @param {object} opts - { numtaps: FIR filter length }
 * @returns {Float64Array} Oversampled signal
 */
export default function oversample (data, factor, opts) {
	if (!opts) opts = {}
	let numtaps = opts.numtaps || 63
	if (numtaps % 2 === 0) numtaps++

	let N = data.length
	let outLen = N * factor

	// Upsample: insert zeros
	let up = new Float64Array(outLen)
	for (let i = 0; i < N; i++) up[i * factor] = data[i] * factor

	// Anti-image lowpass at 1/factor of new Nyquist
	let h = firwin(numtaps, 0.5 / factor, 1, {window: 'kaiser'})

	// Apply FIR
	let out = new Float64Array(outLen)
	let M = (numtaps - 1) / 2
	for (let i = 0; i < outLen; i++) {
		let sum = 0
		for (let j = 0; j < numtaps; j++) {
			let idx = i - M + j
			if (idx >= 0 && idx < outLen) sum += h[j] * up[idx]
		}
		out[i] = sum
	}

	return out
}
