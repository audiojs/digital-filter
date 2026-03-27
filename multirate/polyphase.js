/**
 * Decompose FIR filter into M polyphase components.
 * @param {Float64Array} h - FIR coefficients
 * @param {number} M - Number of phases (= decimation/interpolation factor)
 * @returns {Array<Float64Array>} M polyphase sub-filters
 */
export default function polyphase (h, M) {
	let N = h.length
	let phaseLen = Math.ceil(N / M)
	let phases = new Array(M)

	for (let m = 0; m < M; m++) {
		phases[m] = new Float64Array(phaseLen)
		for (let k = 0; k < phaseLen; k++) {
			let idx = m + k * M
			phases[m][k] = idx < N ? h[idx] : 0
		}
	}

	return phases
}
