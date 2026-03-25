import filter from './filter.js'

/**
 * Compute impulse response of a filter.
 * @param {Array|Object} coefs - SOS section(s)
 * @param {number} N - Number of samples (default 256)
 * @returns {Float64Array}
 */
export function impulseResponse (coefs, N) {
	if (!N) N = 256
	let data = new Float64Array(N)
	data[0] = 1
	filter(data, { coefs })
	return data
}

/**
 * Compute step response of a filter.
 * @param {Array|Object} coefs - SOS section(s)
 * @param {number} N - Number of samples (default 256)
 * @returns {Float64Array}
 */
export function stepResponse (coefs, N) {
	if (!N) N = 256
	let data = new Float64Array(N)
	data.fill(1)
	filter(data, { coefs })
	return data
}
