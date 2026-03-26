import firwin from './firwin.js'

/**
 * Generate half-band FIR filter coefficients.
 * Nearly half the coefficients are zero, halving multiply count.
 * @param {number} numtaps - Filter length (should be 4k+3 form for proper half-band)
 * @returns {Float64Array}
 */
export default function halfBand (numtaps) {
	if (!numtaps) numtaps = 31
	// Half-band: cutoff at Nyquist/2, constrained symmetry
	let h = firwin(numtaps, 0.5, 2, {type: 'lowpass', window: 'kaiser'})
	// Force half-band constraint: even-indexed coefficients (except center) = 0
	let M = (numtaps - 1) / 2
	for (let i = 0; i < numtaps; i++) {
		if (i !== M && (i - M) % 2 === 0) h[i] = 0
	}
	h[M] = 0.5 // center tap
	return h
}
