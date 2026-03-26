/**
 * Diode ladder filter (Roland TB-303 style).
 * Per-stage saturation preserves bass at high resonance.
 *
 * @module  digital-filter/diode-ladder
 */

let { PI, sin, tanh } = Math

export default function diodeLadder (data, params) {
	let fc = params.fc || 1000
	let res = params.resonance != null ? params.resonance : 0
	let fs = params.fs || 44100

	let f = 2 * sin(PI * fc / fs)
	let fb = res * 4

	if (!params._s) params._s = new Float64Array(4)
	let s = params._s

	for (let i = 0, n = data.length; i < n; i++) {
		let x = data[i] - fb * tanh(s[3])

		s[0] += f * (tanh(x) - tanh(s[0]))
		s[1] += f * (tanh(s[0]) - tanh(s[1]))
		s[2] += f * (tanh(s[1]) - tanh(s[2]))
		s[3] += f * (tanh(s[2]) - tanh(s[3]))

		data[i] = s[3]
	}

	return data
}
