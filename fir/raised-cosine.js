/**
 * Raised cosine / root-raised cosine FIR pulse shaping filter
 *
 * @module  digital-filter/raised-cosine
 */

let { cos, sin, PI, abs, sqrt, SQRT2 } = Math

/**
 * @param {number} N - Filter length (odd)
 * @param {number} beta - Roll-off factor 0-1 (0=sinc, 1=widest)
 * @param {number} sps - Samples per symbol
 * @param {object} opts - { root: false (RC) or true (RRC) }
 * @returns {Float64Array}
 */
export default function raisedCosine (N, beta, sps, opts) {
	if (beta == null) beta = 0.35
	if (sps == null) sps = 4
	if (!opts) opts = {}
	let root = opts.root || false
	let h = new Float64Array(N)
	let M = (N - 1) / 2

	for (let i = 0; i < N; i++) {
		let t = (i - M) / sps
		if (root) {
			if (t === 0) {
				h[i] = (1 - beta + 4 * beta / PI)
			} else if (abs(abs(t) - 1 / (4 * beta)) < 1e-10 && beta > 0) {
				h[i] = beta / (PI * SQRT2) * ((PI + 2) * sin(PI/(4*beta)) + (PI - 2) * cos(PI/(4*beta)))
			} else {
				let pt = PI * t
				let num = sin(pt * (1 - beta)) + 4 * beta * t * cos(pt * (1 + beta))
				let den = pt * (1 - (4 * beta * t) * (4 * beta * t))
				h[i] = num / den
			}
		} else {
			if (abs(abs(t) - 1 / (2 * beta)) < 1e-10 && beta > 0) {
				h[i] = PI / (4 * sps) * sinc(1 / (2 * beta))
			} else if (t === 0) {
				h[i] = 1 / sps
			} else {
				h[i] = sinc(t) * cos(PI * beta * t) / (1 - (2 * beta * t) * (2 * beta * t)) / sps
			}
		}
	}

	// Normalize energy
	let energy = 0
	for (let i = 0; i < N; i++) energy += h[i] * h[i]
	let scale = 1 / sqrt(energy)
	for (let i = 0; i < N; i++) h[i] *= scale

	return h
}

function sinc (x) { return x === 0 ? 1 : sin(PI * x) / (PI * x) }
