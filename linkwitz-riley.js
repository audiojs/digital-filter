/**
 * Linkwitz-Riley crossover filter — two cascaded Butterworth filters.
 * LP + HP sum to flat (allpass). LR-N = 2× Butterworth(N/2).
 *
 * @module  digital-filter/linkwitz-riley
 */
import butterworth from './iir/butterworth.js'

export default function linkwitzRiley(order, fc, fs) {
	if (!fs) fs = 44100
	if (order % 2) throw Error('Linkwitz-Riley order must be even')

	let halfOrder = order / 2

	// Two cascaded Butterworth of half order
	let lpSections = butterworth(halfOrder, fc, fs, 'lowpass')
	let hpSections = butterworth(halfOrder, fc, fs, 'highpass')

	// LR = two cascaded, so duplicate the sections
	return {
		low: lpSections.concat(lpSections.map(s => ({...s}))),
		high: hpSections.concat(hpSections.map(s => ({...s})))
	}
}
