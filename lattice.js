/**
 * Lattice IIR filter.
 * Uses reflection coefficients (k) instead of direct-form coefficients.
 * Better numerical properties for adaptive and LPC applications.
 *
 * @module  digital-filter/lattice
 */

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { k: reflection coefficients array, v: ladder coefficients (optional) }
 */
export default function lattice (data, params) {
	let k = params.k  // reflection coefficients
	let v = params.v  // ladder (feedforward) coefficients, optional
	let N = k.length

	if (!params._state) params._state = new Float64Array(N)
	let s = params._state

	// Pre-allocate work arrays
	if (!params._f) { params._f = new Float64Array(N + 1); params._g = new Float64Array(N + 1) }
	let f = params._f, g = params._g

	for (let i = 0, len = data.length; i < len; i++) {
		f[0] = data[i]
		g[0] = data[i]

		for (let j = 0; j < N; j++) {
			f[j + 1] = f[j] + k[j] * s[j]
			g[j + 1] = k[j] * f[j] + s[j]
		}

		// State = backward outputs (delayed one sample for next iteration)
		for (let j = 0; j < N; j++) s[j] = g[j]

		if (v) {
			let y = 0
			for (let j = 0; j <= N; j++) y += (v[j] || 0) * f[j]
			data[i] = y
		} else {
			data[i] = f[N]
		}
	}

	return data
}
