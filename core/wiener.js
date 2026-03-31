/**
 * Wiener filter for 1D signal denoising.
 * Applies optimal linear filter in frequency domain:
 *   H(f) = S_signal(f) / (S_signal(f) + S_noise(f))
 *
 * @param {Float64Array|Array<number>} data - Noisy input signal (modified in-place)
 * @param {object} [opts] - {noise, size}
 *   noise: noise power estimate (default: auto-estimated from high-frequency content)
 *   size: local estimation window size (default: 3)
 * @returns {Float64Array} Filtered signal (same reference as input)
 */
export default function wiener (data, opts) {
	if (!opts) opts = {}
	let N = data.length

	// Pad to next power of 2 for FFT
	let fftLen = 1
	while (fftLen < N) fftLen <<= 1

	let re = new Float64Array(fftLen)
	let im = new Float64Array(fftLen)
	for (let i = 0; i < N; i++) re[i] = data[i]

	fft(re, im, false)

	// Power spectrum of noisy signal
	let power = new Float64Array(fftLen)
	for (let i = 0; i < fftLen; i++) {
		power[i] = re[i] * re[i] + im[i] * im[i]
	}

	// Noise power estimate
	let noisePow = opts.noise
	if (noisePow == null) {
		// Estimate from upper quarter of spectrum (high-frequency noise floor)
		let start = Math.floor(fftLen * 3 / 8)
		let end = Math.floor(fftLen * 5 / 8)
		let sum = 0, count = 0
		for (let i = start; i < end; i++) { sum += power[i]; count++ }
		noisePow = sum / count
	}

	// Apply Wiener filter: H = max(0, (P - N) / P)
	for (let i = 0; i < fftLen; i++) {
		let gain = power[i] > noisePow ? (power[i] - noisePow) / power[i] : 0
		re[i] *= gain
		im[i] *= gain
	}

	fft(re, im, true)

	for (let i = 0; i < N; i++) data[i] = re[i]
	return data
}

// In-place Cooley-Tukey FFT (radix-2)
function fft (re, im, inverse) {
	let N = re.length
	let bits = Math.log2(N) | 0

	// Bit-reversal permutation
	for (let i = 0; i < N; i++) {
		let j = bitrev(i, bits)
		if (j > i) {
			let tr = re[i]; re[i] = re[j]; re[j] = tr
			let ti = im[i]; im[i] = im[j]; im[j] = ti
		}
	}

	let sign = inverse ? 1 : -1
	for (let size = 2; size <= N; size <<= 1) {
		let half = size >> 1
		let angle = sign * 2 * Math.PI / size
		let wR = Math.cos(angle), wI = Math.sin(angle)
		for (let start = 0; start < N; start += size) {
			let uR = 1, uI = 0
			for (let j = 0; j < half; j++) {
				let a = start + j, b = a + half
				let tR = uR * re[b] - uI * im[b]
				let tI = uR * im[b] + uI * re[b]
				re[b] = re[a] - tR; im[b] = im[a] - tI
				re[a] += tR; im[a] += tI
				let tmp = uR * wR - uI * wI
				uI = uR * wI + uI * wR
				uR = tmp
			}
		}
	}

	if (inverse) {
		for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N }
	}
}

function bitrev (x, bits) {
	let result = 0
	for (let i = 0; i < bits; i++) {
		result = (result << 1) | (x & 1)
		x >>= 1
	}
	return result
}
