/**
 * Zero-phase forward-backward filtering
 * Eliminates phase distortion by filtering forward then backward.
 *
 * @module  digital-filter/filtfilt
 */

import filter from './filter.js'

export default function filtfilt (data, params) {
	// Forward pass
	let fwd = { coefs: params.coefs }
	filter(data, fwd)

	// Reverse
	data.reverse()

	// Backward pass (fresh state)
	let bwd = { coefs: params.coefs }
	filter(data, bwd)

	// Reverse back to original order
	data.reverse()

	return data
}
