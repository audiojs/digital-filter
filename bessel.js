/**
 * Bessel/Thomson filter → cascaded SOS
 * Maximally flat group delay
 *
 * @module  digital-filter/bessel
 */

import { polesSos } from './transform.js'

// Normalized Bessel poles for -3dB cutoff at w=1 rad/s
// Each entry: [sigma, omega] where pole = sigma ± j*omega
let POLES = {
	1: [[-1.00000000000, 0]],
	2: [[-1.10160133059, 0.63600982475]],
	3: [[-1.04740916101, 0.99926489744], [-1.32267579991, 0]],
	4: [[-0.99520874822, 1.25710573945], [-1.37006783055, 0.41024971567]],
	5: [[-0.95767654372, 1.47112432073], [-1.38087732586, 0.71790631401], [-1.50231627145, 0]],
	6: [[-0.93065652093, 1.66186326894], [-1.38185809760, 0.97147189514], [-1.57149040362, 0.32089637279]],
	7: [[-0.90986778880, 1.83645135304], [-1.37890321680, 1.19156677780], [-1.61203876622, 0.58924451517], [-1.68436817927, 0]],
	8: [[-0.89267554053, 1.99832584364], [-1.37384121764, 1.38835657588], [-1.63693941813, 0.82279563638], [-1.75740840040, 0.27267129872]],
	9: [[-0.87811569344, 2.14926408807], [-1.36758830979, 1.56773371224], [-1.65239648458, 1.03138956699], [-1.80717053496, 0.51223835200], [-1.85660766555, 0]],
	10: [[-0.86555260092, 2.29129220984], [-1.36069227838, 1.73350574267], [-1.66181024140, 1.22110217983], [-1.84219624443, 0.72726806897], [-1.92761969309, 0.24127112354]]
}

/**
 * Design Bessel/Thomson filter as cascaded second-order sections.
 *
 * @param {number} order - Filter order (1-10)
 * @param {number} fc - Cutoff frequency in Hz
 * @param {number} [fs=44100] - Sample rate in Hz
 * @param {string} [type='lowpass'] - Filter type: 'lowpass', 'highpass', 'bandpass', 'bandstop'
 * @returns {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>} SOS sections
 */
export default function bessel (order, fc, fs, type) {
	if (!type) type = 'lowpass'
	if (!fs) fs = 44100

	let poles = POLES[order]
	if (!poles) throw Error('Bessel filter order must be 1-10')

	return polesSos(poles, fc, fs, type)
}
