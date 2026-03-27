let { floor } = Math

/**
 * Farrow fractional delay filter.
 * Implements variable fractional delay using polynomial interpolation.
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { delay: fractional delay in samples (e.g. 3.7), order: polynomial order (default 3) }
 * @returns {Float64Array}
 */
export default function farrow (data, params) {
	let delay = params.delay || 0
	let order = params.order || 3

	let intDelay = floor(delay)
	let frac = delay - intDelay
	let N = data.length

	let input = Float64Array.from(data)

	for (let i = 0; i < N; i++) {
		let idx = i - intDelay

		// Lagrange interpolation of order `order`
		let sum = 0
		for (let k = 0; k <= order; k++) {
			let srcIdx = idx - k + floor(order / 2)
			if (srcIdx < 0 || srcIdx >= N) continue

			let basis = 1
			for (let j = 0; j <= order; j++) {
				if (j !== k) basis *= (frac - j + floor(order / 2)) / (k - j)
			}
			sum += input[srcIdx] * basis
		}

		data[i] = sum
	}

	return data
}
