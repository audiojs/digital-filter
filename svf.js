let {tan, PI} = Math

let types = {
	lowpass:  (v0, v1, v2, k) => v2,
	highpass: (v0, v1, v2, k) => v0 - k * v1 - v2,
	bandpass: (v0, v1, v2, k) => v1,
	notch:    (v0, v1, v2, k) => v0 - k * v1,
	peak:     (v0, v1, v2, k) => v0 - k * v1 - 2 * v2,
	allpass:  (v0, v1, v2, k) => v0 - 2 * k * v1
}

export default function svf (data, params) {
	if (!params.type) params.type = 'lowpass'
	if (!params.Q) params.Q = .707
	if (!params.fs) params.fs = 44100
	if (params.ic1eq == null) params.ic1eq = 0
	if (params.ic2eq == null) params.ic2eq = 0

	let fc = params.fc, Q = params.Q, fs = params.fs

	// recompute coefficients when params change
	if (params._fc !== fc || params._Q !== Q || params._fs !== fs) {
		let g = tan(PI * fc / fs)
		let k = 1 / Q
		params._a1 = 1 / (1 + g * (g + k))
		params._a2 = g * params._a1
		params._a3 = g * params._a2
		params._k = k
		params._fc = fc
		params._Q = Q
		params._fs = fs
	}

	let a1 = params._a1, a2 = params._a2, a3 = params._a3, k = params._k
	let ic1eq = params.ic1eq, ic2eq = params.ic2eq
	let out = types[params.type]

	for (let i = 0, l = data.length; i < l; i++) {
		let v0 = data[i]
		let v3 = v0 - ic2eq
		let v1 = a1 * ic1eq + a2 * v3
		let v2 = ic2eq + a2 * ic1eq + a3 * v3
		ic1eq = 2 * v1 - ic1eq
		ic2eq = 2 * v2 - ic2eq
		data[i] = out(v0, v1, v2, k)
	}

	params.ic1eq = ic1eq
	params.ic2eq = ic2eq

	return data
}
