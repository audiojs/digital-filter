/**
 * Convert SOS to transfer function polynomial coefficients.
 * @param {Array} sos - [{b0,b1,b2,a1,a2}, ...]
 * @returns {{b: Float64Array, a: Float64Array}} numerator and denominator polynomials
 */
export default function sos2tf (sos) {
	let b = [1]  // start with [1], multiply in each section
	let a = [1]

	for (let s of sos) {
		let nb = s.b2 !== 0 ? [s.b0, s.b1, s.b2] : (s.b1 !== 0 ? [s.b0, s.b1] : [s.b0])
		let na = s.a2 !== 0 ? [1, s.a1, s.a2] : (s.a1 !== 0 ? [1, s.a1] : [1])
		b = polymul(b, nb)
		a = polymul(a, na)
	}

	return {b: new Float64Array(b), a: new Float64Array(a)}
}

function polymul (p1, p2) {
	let n = p1.length + p2.length - 1
	let result = new Array(n).fill(0)
	for (let i = 0; i < p1.length; i++) {
		for (let j = 0; j < p2.length; j++) {
			result[i + j] += p1[i] * p2[j]
		}
	}
	return result
}
