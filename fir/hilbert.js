import { hamming } from '../core/window.js'

/**
 * Generate Hilbert transform FIR coefficients.
 * @param {number} N - Filter length (should be odd)
 * @param {object} opts - { window: 'hamming' (default) }
 * @returns {Float64Array} FIR coefficients
 */
export default function hilbert (N, opts) {
	if (!opts) opts = {}
	let h = new Float64Array(N)
	let M = (N - 1) / 2

	for (let i = 0; i < N; i++) {
		let n = i - M
		if (n === 0) {
			h[i] = 0
		} else if (n % 2 !== 0) {
			// Odd samples: 2/(pi*n)
			h[i] = 2 / (Math.PI * n)
		} else {
			h[i] = 0
		}
	}

	// Apply window
	let win = opts.window || hamming(N)
	if (typeof win === 'function') win = win(N)
	for (let i = 0; i < N; i++) h[i] *= win[i]

	return h
}
