/**
 * Convolution of signal with impulse response.
 * Direct convolution O(N*M). For long IRs, consider FFT-based methods.
 *
 * @module  digital-filter/convolution
 */

/**
 * @param {Float64Array} signal - Input signal
 * @param {Float64Array} ir - Impulse response
 * @returns {Float64Array} Convolved output (length = signal.length + ir.length - 1)
 */
export default function convolution (signal, ir) {
	let N = signal.length, M = ir.length
	let out = new Float64Array(N + M - 1)

	for (let i = 0; i < N; i++) {
		for (let j = 0; j < M; j++) {
			out[i + j] += signal[i] * ir[j]
		}
	}

	return out
}
