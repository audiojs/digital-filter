let { cos, PI } = Math

/**
 * Hamming window. Inline default — no external dependency.
 * @param {number} N - Window length
 * @returns {Float64Array}
 */
export function hamming (N) {
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) w[i] = 0.54 - 0.46 * cos(2 * PI * i / (N - 1))
	return w
}

/**
 * Resolve a window argument to a Float64Array.
 * Accepts: Float64Array/Array (pass through), function(N)→array, or nothing (default hamming).
 * @param {Float64Array|Array|Function|undefined} win
 * @param {number} N
 * @returns {Float64Array|Array}
 */
export function getWindow (win, N) {
	if (win instanceof Float64Array || Array.isArray(win)) return win
	if (typeof win === 'function') return win(N)
	return hamming(N)
}
