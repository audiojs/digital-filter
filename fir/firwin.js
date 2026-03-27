import * as windows from '../window.js'

/**
 * Design FIR filter using the window method.
 *
 * @param {number} numtaps - Filter length (must be odd for type I)
 * @param {number|Array<number>} cutoff - Cutoff frequency(ies) in Hz. Scalar for LP/HP, [low,high] for BP/BS.
 * @param {number} [fs=44100] - Sample rate in Hz
 * @param {{type?: 'lowpass'|'highpass'|'bandpass'|'bandstop', window?: string|Float64Array|function(number):Float64Array}} [opts] - Options
 * @returns {Float64Array} FIR filter coefficients
 */
export default function firwin (numtaps, cutoff, fs, opts) {
	if (!fs) fs = 44100
	if (!opts) opts = {}
	let type = opts.type || 'lowpass'

	// Normalize cutoff to [0, 1] where 1 = Nyquist
	let nyq = fs / 2
	let fc = Array.isArray(cutoff) ? cutoff.map(f => f / nyq) : [cutoff / nyq]

	// Get window
	let win = getWindow(opts.window || 'hamming', numtaps)

	// Compute ideal sinc impulse response
	let h = new Float64Array(numtaps)
	let M = (numtaps - 1) / 2

	if (type === 'lowpass') {
		let wc = fc[0] * Math.PI
		for (let i = 0; i < numtaps; i++) {
			let n = i - M
			if (n === 0) h[i] = fc[0]
			else h[i] = Math.sin(wc * n) / (Math.PI * n)
		}
	} else if (type === 'highpass') {
		let wc = fc[0] * Math.PI
		for (let i = 0; i < numtaps; i++) {
			let n = i - M
			if (n === 0) h[i] = 1 - fc[0]
			else h[i] = -Math.sin(wc * n) / (Math.PI * n)
		}
	} else if (type === 'bandpass') {
		let wc1 = fc[0] * Math.PI, wc2 = fc[1] * Math.PI
		for (let i = 0; i < numtaps; i++) {
			let n = i - M
			if (n === 0) h[i] = fc[1] - fc[0]
			else h[i] = (Math.sin(wc2 * n) - Math.sin(wc1 * n)) / (Math.PI * n)
		}
	} else if (type === 'bandstop') {
		let wc1 = fc[0] * Math.PI, wc2 = fc[1] * Math.PI
		for (let i = 0; i < numtaps; i++) {
			let n = i - M
			if (n === 0) h[i] = 1 - (fc[1] - fc[0])
			else h[i] = (Math.sin(wc1 * n) - Math.sin(wc2 * n)) / (Math.PI * n)
		}
	}

	// Apply window
	for (let i = 0; i < numtaps; i++) h[i] *= win[i]

	// Normalize for unity gain at DC (lowpass/bandstop) or center (bandpass) or Nyquist (highpass)
	let sum = 0
	if (type === 'lowpass' || type === 'bandstop') {
		for (let i = 0; i < numtaps; i++) sum += h[i]
		if (sum !== 0) for (let i = 0; i < numtaps; i++) h[i] /= sum
	} else if (type === 'highpass') {
		for (let i = 0; i < numtaps; i++) sum += h[i] * (i % 2 === 0 ? 1 : -1)
		if (sum !== 0) for (let i = 0; i < numtaps; i++) h[i] /= Math.abs(sum)
	} else if (type === 'bandpass') {
		let center = (fc[0] + fc[1]) / 2 * Math.PI
		let re = 0, im = 0
		for (let i = 0; i < numtaps; i++) {
			re += h[i] * Math.cos(center * i)
			im -= h[i] * Math.sin(center * i)
		}
		let mag = Math.sqrt(re * re + im * im)
		if (mag !== 0) for (let i = 0; i < numtaps; i++) h[i] /= mag
	}

	return h
}

function getWindow (win, N) {
	if (win instanceof Float64Array || Array.isArray(win)) return win
	if (typeof win === 'function') return win(N)
	if (typeof win === 'string' && windows[win]) return windows[win](N)
	return windows.hamming(N)
}
