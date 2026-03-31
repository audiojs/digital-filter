/**
 * Polynomial deconvolution (long division).
 * Given b = conv(a, q) + r, finds quotient q and remainder r.
 * Equivalent to MATLAB's deconv(b, a).
 *
 * @param {Array<number>|Float64Array} b - Dividend polynomial (numerator / convolved signal)
 * @param {Array<number>|Float64Array} a - Divisor polynomial (denominator / kernel)
 * @returns {{q: Float64Array, r: Float64Array}} Quotient and remainder
 */
export default function deconvolve (b, a) {
	b = Array.from(b)
	a = Array.from(a)

	if (a.length === 0 || (a.length === 1 && a[0] === 0)) {
		throw new Error('deconvolve: division by zero polynomial')
	}

	if (b.length < a.length) {
		return { q: new Float64Array([0]), r: new Float64Array(b) }
	}

	let qLen = b.length - a.length + 1
	let q = new Float64Array(qLen)
	let rem = b.slice()

	for (let i = 0; i < qLen; i++) {
		q[i] = rem[i] / a[0]
		for (let j = 0; j < a.length; j++) {
			rem[i + j] -= q[i] * a[j]
		}
	}

	return { q, r: new Float64Array(rem) }
}
