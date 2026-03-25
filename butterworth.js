/**
 * Nth-order Butterworth filter → cascaded SOS
 * Maximally flat magnitude response
 *
 * @module  digital-filter/butterworth
 */

let {sin, floor, PI} = Math
import { polesSos } from './transform.js'

export default function butterworth (order, fc, fs, type) {
	if (!type) type = 'lowpass'
	if (!fs) fs = 44100

	return polesSos(butterworthPoles(order), fc, fs, type)
}

// Butterworth prototype poles (normalized LP at 1 rad/s, unit circle)
function butterworthPoles (N) {
	let poles = []
	for (let m = 0; m < floor(N / 2); m++) {
		let theta = PI * (2 * m + 1) / (2 * N)
		poles.push([-sin(theta), Math.cos(theta)])
	}
	if (N % 2 === 1) poles.push([-1, 0])
	return poles
}

export { butterworthPoles as poles }
