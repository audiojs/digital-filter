/**
 * IIR filter design matching arbitrary frequency response (Yule-Walker method)
 *
 * @module  digital-filter/yulewalk
 */

let { cos, sin, sqrt, PI } = Math

/**
 * @param {number} order - Filter order (number of poles = number of zeros)
 * @param {Array} frequencies - Frequency points [0-1] where 1 = Nyquist
 * @param {Array} magnitudes - Desired magnitude at each frequency point
 * @returns {{b: Float64Array, a: Float64Array}} Numerator and denominator coefficients
 */
export default function yulewalk (order, frequencies, magnitudes) {
	let N = 512

	// Interpolate desired magnitude to dense grid
	let H = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		let f = i / N
		let j = 0
		while (j < frequencies.length - 1 && frequencies[j + 1] < f) j++
		if (j >= frequencies.length - 1) { H[i] = magnitudes[magnitudes.length - 1]; continue }
		let t = (f - frequencies[j]) / (frequencies[j + 1] - frequencies[j])
		H[i] = magnitudes[j] + t * (magnitudes[j + 1] - magnitudes[j])
	}

	// Autocorrelation of desired response via IDFT
	let R = new Float64Array(order + 1)
	for (let k = 0; k <= order; k++) {
		let sum = 0
		for (let i = 0; i < N; i++) sum += H[i] * H[i] * cos(2 * PI * k * i / N)
		R[k] = sum / N
	}

	// Solve Yule-Walker equations via Levinson-Durbin
	let a = levinsonDurbin(R, order)

	// Compute numerator by matching spectral envelope
	let b = new Float64Array(order + 1)
	for (let k = 0; k <= order; k++) {
		let sum = 0
		for (let i = 0; i < N; i++) {
			let w = 2 * PI * i / N
			let ar = 1, ai = 0
			for (let j = 1; j <= order; j++) {
				ar += a[j] * cos(j * w)
				ai -= a[j] * sin(j * w)
			}
			let Amag = sqrt(ar * ar + ai * ai)
			sum += H[i] * Amag * cos(k * w)
		}
		b[k] = sum / N
	}

	return { b: Float64Array.from(b), a: Float64Array.from([1, ...a.slice(1)]) }
}

function levinsonDurbin (R, order) {
	let a = new Float64Array(order + 1)
	a[0] = 1
	let E = R[0]

	for (let i = 1; i <= order; i++) {
		let lambda = 0
		for (let j = 1; j < i; j++) lambda += a[j] * R[i - j]
		lambda = (R[i] - lambda) / E

		let prev = Float64Array.from(a)
		a[i] = lambda
		for (let j = 1; j < i; j++) a[j] = prev[j] - lambda * prev[i - j]

		E *= (1 - lambda * lambda)
	}

	return a
}
