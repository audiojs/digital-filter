/**
 * FIR differentiator (derivative approximation)
 * Type III antisymmetric FIR
 *
 * @module  digital-filter/differentiator
 */

import { getWindow } from './util.js'

/**
 * @param {number} N - Filter length (must be odd)
 * @param {object} opts - { window: 'hamming', fs: sample rate for scaling }
 * @returns {Float64Array}
 */
export default function differentiator (N, opts) {
	if (!opts) opts = {}
	let h = new Float64Array(N)
	let M = (N - 1) / 2

	for (let i = 0; i < N; i++) {
		let n = i - M
		if (n === 0) h[i] = 0
		else h[i] = Math.cos(Math.PI * n) / n  // (-1)^n / n
	}

	let win = getWindow(opts.window, N)
	for (let i = 0; i < N; i++) h[i] *= win[i]

	if (opts.fs) for (let i = 0; i < N; i++) h[i] *= opts.fs

	return h
}
