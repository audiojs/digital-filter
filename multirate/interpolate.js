import firwin from '../fir/firwin.js'

/**
 * Interpolate signal: upsample by factor L then anti-image lowpass filter.
 * @param {Float64Array} data - Input signal
 * @param {number} factor - Interpolation factor L
 * @param {object} opts - {numtaps, fs}
 * @returns {Float64Array} interpolated signal (length = data.length * factor)
 */
export default function interpolate (data, factor, opts) {
	if (!opts) opts = {}
	let fs = opts.fs || 44100
	let numtaps = opts.numtaps || (30 * factor + 1)
	if (numtaps % 2 === 0) numtaps++

	// Upsample: insert factor-1 zeros between samples
	let upLen = data.length * factor
	let up = new Float64Array(upLen)
	for (let i = 0; i < data.length; i++) {
		up[i * factor] = data[i] * factor  // scale by factor to maintain energy
	}

	// Design anti-imaging lowpass at Nyquist/factor
	let cutoff = fs / 2  // cutoff at original Nyquist
	let newFs = fs * factor
	let h = firwin(numtaps, cutoff, newFs)

	// Apply FIR filter
	let output = new Float64Array(upLen)
	let half = (numtaps - 1) / 2
	for (let i = 0; i < upLen; i++) {
		let sum = 0
		for (let j = 0; j < numtaps; j++) {
			let idx = i - half + j
			if (idx >= 0 && idx < upLen) sum += h[j] * up[idx]
		}
		output[i] = sum
	}

	return output
}
