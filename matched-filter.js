/**
 * Matched filter (time-reversed template for maximum SNR detection)
 *
 * @module  digital-filter/matched-filter
 */

/**
 * @param {Float64Array|Array} template - Known signal to detect
 * @returns {Float64Array} Matched filter coefficients
 */
export default function matchedFilter (template) {
	let N = template.length
	let h = new Float64Array(N)
	for (let i = 0; i < N; i++) h[i] = template[N - 1 - i]
	// Normalize for unity peak correlation
	let energy = 0
	for (let i = 0; i < N; i++) energy += template[i] * template[i]
	if (energy > 0) for (let i = 0; i < N; i++) h[i] /= energy
	return h
}
