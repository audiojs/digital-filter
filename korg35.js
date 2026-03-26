/**
 * Korg MS-20 style filter (Korg35).
 * 2-pole lowpass/highpass with nonlinear feedback.
 *
 * @module  digital-filter/korg35
 */

let { PI, sin, tanh } = Math

export default function korg35 (data, params) {
	let fc = params.fc || 1000
	let res = params.resonance != null ? params.resonance : 0
	let fs = params.fs || 44100
	let hp = params.type === 'highpass'

	let g = 2 * sin(PI * fc / fs)
	let k = 2 * res

	if (!params._s) params._s = new Float64Array(2)
	let s = params._s

	for (let i = 0, n = data.length; i < n; i++) {
		let x = data[i]

		let y1 = s[0] + g * (tanh(x - k * s[1]) - tanh(s[0]))
		let y2 = s[1] + g * (tanh(y1) - tanh(s[1]))

		s[0] = y1
		s[1] = y2

		data[i] = hp ? x - y2 : y2
	}

	return data
}
