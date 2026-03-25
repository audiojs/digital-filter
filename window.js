let {cos, sin, sqrt, exp, PI, pow, abs, log} = Math

// Rectangular (trivial, included for completeness)
export function rectangular (N) {
	let w = new Float64Array(N)
	w.fill(1)
	return w
}

// Hann (raised cosine)
export function hann (N) {
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) w[i] = 0.5 * (1 - cos(2 * PI * i / (N - 1)))
	return w
}

// Hamming
export function hamming (N) {
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) w[i] = 0.54 - 0.46 * cos(2 * PI * i / (N - 1))
	return w
}

// Blackman
export function blackman (N) {
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		w[i] = 0.42 - 0.5 * cos(2 * PI * i / (N - 1)) + 0.08 * cos(4 * PI * i / (N - 1))
	}
	return w
}

// Kaiser (parameterized by beta)
// Uses modified Bessel function I0
export function kaiser (N, beta) {
	if (beta == null) beta = 8.6
	let w = new Float64Array(N)
	let denom = bessel_i0(beta)
	for (let i = 0; i < N; i++) {
		let x = 2 * i / (N - 1) - 1  // -1 to 1
		w[i] = bessel_i0(beta * sqrt(1 - x * x)) / denom
	}
	return w
}

// Blackman-Harris (4-term)
export function blackmanHarris (N) {
	let a0 = 0.35875, a1 = 0.48829, a2 = 0.14128, a3 = 0.01168
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		w[i] = a0 - a1 * cos(2*PI*i/(N-1)) + a2 * cos(4*PI*i/(N-1)) - a3 * cos(6*PI*i/(N-1))
	}
	return w
}

// Flat-top (maximum amplitude accuracy)
export function flattop (N) {
	let a0 = 0.21557895, a1 = 0.41663158, a2 = 0.277263158, a3 = 0.083578947, a4 = 0.006947368
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		w[i] = a0 - a1*cos(2*PI*i/(N-1)) + a2*cos(4*PI*i/(N-1)) - a3*cos(6*PI*i/(N-1)) + a4*cos(8*PI*i/(N-1))
	}
	return w
}

// Tukey (tapered cosine, alpha=0→rectangular, alpha=1→hann)
export function tukey (N, alpha) {
	if (alpha == null) alpha = 0.5
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		if (i < alpha * (N-1) / 2) {
			w[i] = 0.5 * (1 - cos(2 * PI * i / (alpha * (N-1))))
		} else if (i > (N-1) * (1 - alpha/2)) {
			w[i] = 0.5 * (1 - cos(2 * PI * (N-1-i) / (alpha * (N-1))))
		} else {
			w[i] = 1
		}
	}
	return w
}

// Gaussian
export function gaussian (N, sigma) {
	if (sigma == null) sigma = 0.4
	let w = new Float64Array(N)
	let half = (N - 1) / 2
	for (let i = 0; i < N; i++) {
		let x = (i - half) / (sigma * half)
		w[i] = exp(-0.5 * x * x)
	}
	return w
}

// Bartlett (triangular with zeros at endpoints)
export function bartlett (N) {
	let w = new Float64Array(N)
	let half = (N - 1) / 2
	for (let i = 0; i < N; i++) {
		w[i] = 1 - abs((i - half) / half)
	}
	return w
}

// Nuttall (4-term, continuous first derivative)
export function nuttall (N) {
	let a0 = 0.355768, a1 = 0.487396, a2 = 0.144232, a3 = 0.012604
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		w[i] = a0 - a1*cos(2*PI*i/(N-1)) + a2*cos(4*PI*i/(N-1)) - a3*cos(6*PI*i/(N-1))
	}
	return w
}

// Modified Bessel function I0 (for Kaiser window)
function bessel_i0 (x) {
	let sum = 1, term = 1
	for (let k = 1; k <= 25; k++) {
		term *= (x / (2 * k)) * (x / (2 * k))
		sum += term
		if (term < 1e-15 * sum) break
	}
	return sum
}
