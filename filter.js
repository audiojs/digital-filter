/**
 * Biquad cascade (SOS) filter, Direct Form II Transposed
 *
 * @module  digital-filter/filter
 * @param {Float64Array|Float32Array|Array<number>} data - Input samples (modified in-place)
 * @param {{coefs: Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>|{b0:number,b1:number,b2:number,a1:number,a2:number}, state?: Array<[number,number]>}} params - Filter coefficients and optional state
 * @returns {Float64Array|Float32Array|Array<number>} Filtered data (same reference as input)
 */
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
