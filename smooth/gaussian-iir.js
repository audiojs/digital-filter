/**
 * Gaussian IIR filter (Young-van Vliet recursive approximation)
 * Approximates Gaussian smoothing with O(N) cost regardless of sigma.
 * Forward-backward 3rd-order IIR for zero-phase.
 *
 * @module  digital-filter/gaussian-iir
 */

let { sqrt } = Math

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { sigma: standard deviation in samples (default 5) }
 * @returns {Float64Array}
 */
export default function gaussianIir (data, params) {
	let sigma = params.sigma || 5

	// Young-van Vliet coefficients for 3rd-order recursive Gaussian
	let q
	if (sigma >= 2.5) q = 0.98711 * sigma - 0.96330
	else q = 3.97156 - 4.14554 * sqrt(1 - 0.26891 * sigma)

	let q2 = q * q, q3 = q * q2
	let b0 = 1.57825 + 2.44413 * q + 1.4281 * q2 + 0.422205 * q3
	let b1 = 2.44413 * q + 2.85619 * q2 + 1.26661 * q3
	let b2 = -(1.4281 * q2 + 1.26661 * q3)
	let b3 = 0.422205 * q3
	let B = 1 - (b1 + b2 + b3) / b0

	let n = data.length

	// Forward pass
	for (let i = 3; i < n; i++) {
		data[i] = B * data[i] + (b1 * data[i-1] + b2 * data[i-2] + b3 * data[i-3]) / b0
	}

	// Backward pass (zero-phase)
	for (let i = n - 4; i >= 0; i--) {
		data[i] = B * data[i] + (b1 * data[i+1] + b2 * data[i+2] + b3 * data[i+3]) / b0
	}

	return data
}
