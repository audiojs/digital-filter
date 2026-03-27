/**
 * Levinson-Durbin recursion: solve Toeplitz system for LPC coefficients.
 * Given autocorrelation sequence R[0..order], compute prediction coefficients.
 * @param {Float64Array|Array} R - Autocorrelation values R[0], R[1], ..., R[order]
 * @param {number} order - LPC order (default R.length - 1)
 * @returns {{a: Float64Array, error: number, k: Float64Array}} Coefficients, prediction error, reflection coefficients
 */
export default function levinson (R, order) {
	if (order == null) order = R.length - 1

	let a = new Float64Array(order + 1)
	let k = new Float64Array(order) // reflection coefficients
	a[0] = 1
	let E = R[0]

	for (let i = 1; i <= order; i++) {
		// Compute reflection coefficient
		let lambda = 0
		for (let j = 1; j < i; j++) lambda += a[j] * R[i - j]
		k[i - 1] = (R[i] - lambda) / E

		// Update coefficients
		let prev = Float64Array.from(a)
		a[i] = k[i - 1]
		for (let j = 1; j < i; j++) a[j] = prev[j] - k[i - 1] * prev[i - j]

		// Update error
		E *= (1 - k[i - 1] * k[i - 1])
	}

	return { a, error: E, k }
}
