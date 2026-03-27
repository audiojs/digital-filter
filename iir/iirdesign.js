import butterworth from './butterworth.js'
import chebyshev from './chebyshev.js'
import elliptic from './elliptic.js'

/**
 * Automatically design an IIR filter from specifications.
 * Picks the filter type that gives the minimum order.
 *
 * @param {number} fpass - Passband edge frequency Hz
 * @param {number} fstop - Stopband edge frequency Hz
 * @param {number} rp - Passband ripple dB (default 1)
 * @param {number} rs - Stopband attenuation dB (default 40)
 * @param {number} fs - Sample rate (default 44100)
 * @returns {{sos: Array, order: number, type: string}}
 */
export default function iirdesign (fpass, fstop, rp, rs, fs) {
	if (!rp) rp = 1
	if (!rs) rs = 40
	if (!fs) fs = 44100

	let type = fpass < fstop ? 'lowpass' : 'highpass'
	let fc = fpass

	// Estimate minimum order for each filter family
	let bestOrder = Infinity, bestSos = null, bestName = ''

	// Butterworth order estimate
	let nBW = butterworthOrder(fpass, fstop, rp, rs, fs)
	if (nBW < bestOrder) {
		bestOrder = nBW
		bestSos = butterworth(nBW, fc, fs, type)
		bestName = 'butterworth'
	}

	// Chebyshev I — typically lower order than Butterworth
	let nCh = chebyshevOrder(fpass, fstop, rp, rs, fs)
	if (nCh < bestOrder) {
		bestOrder = nCh
		bestSos = chebyshev(nCh, fc, fs, rp, type)
		bestName = 'chebyshev'
	}

	// Elliptic — lowest order
	let nEl = ellipticOrder(fpass, fstop, rp, rs, fs)
	if (nEl < bestOrder) {
		bestOrder = nEl
		bestSos = elliptic(nEl, fc, fs, rp, rs, type)
		bestName = 'elliptic'
	}

	return { sos: bestSos, order: bestOrder, type: bestName }
}

function butterworthOrder (fp, fs_, rp, rs, fs) {
	let wp = Math.tan(Math.PI * fp / fs)
	let ws = Math.tan(Math.PI * fs_ / fs)
	let ratio = ws / wp
	if (ratio < 1) ratio = 1 / ratio
	let N = Math.ceil(Math.log10((Math.pow(10, rs/10) - 1) / (Math.pow(10, rp/10) - 1)) / (2 * Math.log10(ratio)))
	return Math.max(N, 1)
}

function chebyshevOrder (fp, fs_, rp, rs, fs) {
	let wp = Math.tan(Math.PI * fp / fs)
	let ws = Math.tan(Math.PI * fs_ / fs)
	let ratio = ws / wp
	if (ratio < 1) ratio = 1 / ratio
	let eps = Math.sqrt(Math.pow(10, rp/10) - 1)
	let N = Math.ceil(Math.acosh(Math.sqrt((Math.pow(10, rs/10) - 1) / (eps * eps))) / Math.acosh(ratio))
	return Math.max(N, 1)
}

function ellipticOrder (fp, fs_, rp, rs, fs) {
	// Rough estimate — elliptic is typically about half the Chebyshev order
	let n = chebyshevOrder(fp, fs_, rp, rs, fs)
	return Math.max(Math.ceil(n * 0.6), 1)
}
