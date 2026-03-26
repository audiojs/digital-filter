/**
 * Gaussian FIR pulse shaping filter (for GMSK, BT product control)
 *
 * @module  digital-filter/gaussian-fir
 */

let { exp, PI, sqrt, LN2 } = Math

/**
 * @param {number} N - Filter length (odd)
 * @param {number} bt - Bandwidth-time product (default 0.3 for GMSK)
 * @param {number} sps - Samples per symbol (default 4)
 * @returns {Float64Array}
 */
export default function gaussianFir (N, bt, sps) {
	if (bt == null) bt = 0.3
	if (sps == null) sps = 4
	let h = new Float64Array(N)
	let M = (N - 1) / 2
	let c = sqrt(2 * PI / LN2) * bt
	let d = 2 * PI * PI * bt * bt / LN2

	for (let i = 0; i < N; i++) {
		let t = (i - M) / sps
		h[i] = c * exp(-d * t * t)
	}

	// Normalize to unit sum
	let sum = 0
	for (let i = 0; i < N; i++) sum += h[i]
	for (let i = 0; i < N; i++) h[i] /= sum

	return h
}
