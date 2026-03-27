/**
 * Legendre/Papoulis optimal monotonic filter → cascaded SOS
 * Steepest rolloff without ripple (between Butterworth and Chebyshev I).
 *
 * Reference: C.R. Bond, "Optimum 'L' Filters" (2004)
 *
 * @module  digital-filter/legendre
 */

import { polesSos } from '../core/transform.js'

// Exact Papoulis/Legendre poles, normalized to -3dB at ω=1 rad/s.
// Source: Bond (2004), verified by endolith (mpmath) and independent recomputation.
// Orders 1-2 are identical to Butterworth (unique monotonic solution).
let POLES = {
	1: [[-1.0, 0]],
	2: [[-0.70710678118655, 0.70710678118655]],
	3: [[-0.34518561903120, 0.90086563551838], [-0.62033181713012, 0]],
	4: [[-0.54974342384548, 0.35857181622501], [-0.23168872267885, 0.94551066390267]],
	5: [[-0.38813985178489, 0.58863233806816], [-0.15358673760304, 0.96814640778343], [-0.46808987558460, 0]],
	6: [[-0.43890154955988, 0.23998135208806], [-0.30896088530599, 0.69816746281444], [-0.11519267902622, 0.97792223447143]],
	7: [[-0.34923178487246, 0.42899611671749], [-0.23743975723792, 0.77830089224057], [-0.08620854829124, 0.98436980671134], [-0.38210331509996, 0]],
	8: [[-0.36717631012214, 0.18087919953769], [-0.30028400490128, 0.54104224539113], [-0.19427588132916, 0.82476672454114], [-0.06894215761926, 0.98797096806030]]
}

export default function legendre (order, fc, fs, type) {
	if (!type) type = 'lowpass'
	if (!fs) fs = 44100
	let poles = POLES[order]
	if (!poles) throw Error('Legendre filter order must be 1-8')
	return polesSos(poles, fc, fs, type)
}
