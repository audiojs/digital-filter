/**
 * Biquad cascade (SOS) filter, Direct Form II Transposed
 *
 * @module  digital-filter/filter
 * @param {Float64Array|Float32Array|Array<number>} data - Input samples (modified in-place)
 * @param {{coefs: Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>|{b0:number,b1:number,b2:number,a1:number,a2:number}, state?: Array<[number,number]>}} params - Filter coefficients and optional state
 * @returns {Float64Array|Float32Array|Array<number>} Filtered data (same reference as input)
 */

/**
 * Compute initial state for SOS filter to start in steady state (no transient).
 * For DF2T: y = b0*x + s0, s0 = b1*x - a1*y + s1, s1 = b2*x - a2*y
 * At steady state with constant input x, output of section is constant y = dcGain * x.
 * Solve the recurrence with x_n = x, y_n = y for all n:
 *   s0 = b1*x - a1*y + s1
 *   s1 = b2*x - a2*y
 *   y = b0*x + s0
 * From (3): s0 = y - b0*x
 * Substituting into (1): y - b0*x = b1*x - a1*y + s1 → s1 = y(1+a1) - x(b0+b1)
 * From (2): s1 = b2*x - a2*y → y(1+a1) - x(b0+b1) = b2*x - a2*y
 * → y(1+a1+a2) = x(b0+b1+b2) → y = x * (b0+b1+b2)/(1+a1+a2)
 * So for unit input x=1 through cascaded sections:
 *
 * @param {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>|{b0:number,b1:number,b2:number,a1:number,a2:number}} sos - SOS sections
 * @returns {Array<[number,number]>} Initial state for each section
 */
export function sosfilt_zi (sos) {
	if (!Array.isArray(sos)) sos = [sos]
	let state = []
	let x = 1 // input to first section is 1.0

	for (let s of sos) {
		let { b0, b1, b2, a1, a2 } = s
		// DC gain of this section
		let y = (b0 + b1 + b2) / (1 + a1 + a2) * x
		// Steady-state values from DF2T equations:
		// s1 = b2*x - a2*y
		let z2 = b2 * x - a2 * y
		// s0 = b1*x - a1*y + s1
		let z1 = b1 * x - a1 * y + z2
		state.push([z1, z2])
		// Output of this section becomes input of next
		x = y
	}

	return state
}

export default function filter(data, params) {
	let coefs = params.coefs
	if (!Array.isArray(coefs)) coefs = [coefs]

	let n = coefs.length

	if (!params.state) {
		params.state = new Array(n)
		for (let i = 0; i < n; i++) params.state[i] = [0, 0]
	}
	let state = params.state

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		for (let j = 0; j < n; j++) {
			let c = coefs[j], s = state[j]
			let y = c.b0 * x + s[0]
			s[0] = c.b1 * x - c.a1 * y + s[1]
			s[1] = c.b2 * x - c.a2 * y
			x = y
		}
		data[i] = x
	}

	return data
}
