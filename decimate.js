import firwin from './firwin.js'

/**
 * Decimate signal: anti-alias lowpass filter then downsample by factor M.
 * @param {Float64Array} data - Input signal
 * @param {number} factor - Decimation factor M
 * @param {object} opts - {numtaps, fs}
 *   numtaps: FIR filter length (default 30*factor+1)
 *   fs: sample rate (default 44100)
 * @returns {Float64Array} decimated signal (length = ceil(data.length / factor))
 */
export default function decimate (data, factor, opts) {
	if (!opts) opts = {}
	let fs = opts.fs || 44100
	let numtaps = opts.numtaps || (30 * factor + 1)
	if (numtaps % 2 === 0) numtaps++

	// Design anti-aliasing lowpass at Nyquist/factor
	let cutoff = fs / (2 * factor) * 0.9  // 90% of new Nyquist
	let h = firwin(numtaps, cutoff, fs)

	// Apply FIR filter
	let filtered = firFilter(data, h)

	// Downsample
	let outLen = Math.ceil(data.length / factor)
	let output = new Float64Array(outLen)
	for (let i = 0; i < outLen; i++) {
		output[i] = filtered[i * factor]
	}

	return output
}

function firFilter (data, h) {
	let N = data.length
	let M = h.length
	let half = (M - 1) / 2
	let out = new Float64Array(N)

	for (let i = 0; i < N; i++) {
		let sum = 0
		for (let j = 0; j < M; j++) {
			let idx = i - half + j
			if (idx >= 0 && idx < N) sum += h[j] * data[idx]
		}
		out[i] = sum
	}

	return out
}
