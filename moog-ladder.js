/**
 * Moog 4-pole transistor ladder filter (-24 dB/oct lowpass with resonance).
 * Stilson-Smith (1996) model with nonlinear saturation.
 *
 * @module  digital-filter/moog-ladder
 */

let { PI, sin, tanh } = Math

export default function moogLadder (data, params) {
	let fc = params.fc || 1000
	let res = params.resonance != null ? params.resonance : 0
	let fs = params.fs || 44100

	let f = 2 * sin(PI * Math.min(fc, fs * 0.45) / fs)  // clamp to avoid instability near Nyquist
	let fb = 4 * res  // standard Moog feedback gain (0 = no resonance, 4 = self-oscillation)

	if (!params._s) params._s = new Float64Array(4)
	let s = params._s

	for (let i = 0, n = data.length; i < n; i++) {
		let x = data[i] - fb * s[3]
		x = tanh(x * 0.5)

		s[0] += f * (x - s[0])
		s[1] += f * (s[0] - s[1])
		s[2] += f * (s[1] - s[2])
		s[3] += f * (s[2] - s[3])

		data[i] = s[3]
	}

	return data
}
