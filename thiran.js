/**
 * Thiran allpass fractional delay filter coefficients.
 * Unity magnitude, maximally flat group delay.
 * @param {number} delay - Fractional delay in samples (e.g. 3.7)
 * @param {number} order - Filter order (default: ceil(delay))
 * @returns {{b: Float64Array, a: Float64Array}} Allpass coefficients
 */
export default function thiran (delay, order) {
	if (order == null) order = Math.ceil(delay)
	let N = order

	// Thiran allpass coefficients
	let a = new Float64Array(N + 1)
	a[0] = 1

	for (let k = 1; k <= N; k++) {
		let prod = 1
		for (let n = 0; n <= N; n++) {
			prod *= (delay - N + n) / (delay - N + k + n)
		}
		a[k] = Math.pow(-1, k) * _binomial(N, k) * prod
	}

	// Allpass: b = reverse(a)
	let b = new Float64Array(N + 1)
	for (let i = 0; i <= N; i++) b[i] = a[N - i]

	return { b, a }
}

function _binomial (n, k) {
	if (k === 0 || k === n) return 1
	let r = 1
	for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1)
	return r
}
