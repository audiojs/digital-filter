/**
 * Simple leaky integrator
 *
 * @module  digital-filter/leaky-integrator
 */

export default function leaky (data, params) {
	let y = params.y || 0
	let λ = params.lambda
	if (λ == null) λ = .95

	for (let i = 0, l = data.length; i < l; i++) {
		y = λ * y + (1 - λ) * data[i]
		data[i] = y
	}

	params.y = y

	return data
}
