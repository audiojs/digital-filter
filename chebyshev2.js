import { poleZerosSos } from './transform.js'

let {sin, cos, sqrt, pow, floor, sinh, cosh, asinh, PI} = Math

/**
 * Chebyshev Type II filter → cascaded SOS.
 * Flat passband, equiripple stopband.
 * @param {number} order - Filter order
 * @param {number} fc - Stopband edge frequency Hz (NOT passband edge!)
 * @param {number} fs - Sample rate (default 44100)
 * @param {number} attenuation - Stopband attenuation in dB (default 40)
 * @param {string} type - 'lowpass' (default), 'highpass', 'bandpass', 'bandstop'
 * @returns {Array<{b0,b1,b2,a1,a2}>}
 */
export default function chebyshev2 (order, fc, fs, attenuation, type) {
	if (!fs) fs = 44100
	if (!attenuation) attenuation = 40
	if (!type) type = 'lowpass'

	let N = order
	let eps = 1 / sqrt(pow(10, attenuation / 10) - 1)
	let mu = asinh(1 / eps) / N

	let L = floor(N / 2)
	let poles = []
	let zeros = []

	for (let m = 0; m < L; m++) {
		let theta = PI * (2 * m + 1) / (2 * N)

		// Type II poles = inverse of Type I poles
		let sigma1 = -sinh(mu) * sin(theta)
		let omega1 = cosh(mu) * cos(theta)
		let pmag2 = sigma1 * sigma1 + omega1 * omega1
		// Invert: p = 1/p1
		let sigma = sigma1 / pmag2
		let omega = -omega1 / pmag2
		poles.push([sigma, Math.abs(omega)])

		// Type II zeros: on jω axis at 1/cos(theta)
		let wz = 1 / cos(theta)
		zeros.push([0, wz])
	}

	// Real pole for odd order
	if (N % 2 === 1) {
		poles.push([-1 / sinh(mu), 0])
	}

	let sections = poleZerosSos(poles, zeros, fc, fs, type)

	// Normalize DC gain to 1 (Type II has flat passband)
	let dcGain = 1
	for (let s of sections) dcGain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
	if (dcGain !== 0 && dcGain !== 1) {
		let scale = 1 / dcGain
		sections[0].b0 *= scale
		sections[0].b1 *= scale
		sections[0].b2 *= scale
	}

	return sections
}
