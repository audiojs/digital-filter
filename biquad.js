let {sin, cos, sqrt, pow, PI} = Math

function norm (b0, b1, b2, a0, a1, a2) {
	return { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 }
}

function intermediates (fc, Q, fs) {
	let w0 = 2 * PI * fc / fs
	let sinw = sin(w0), cosw = cos(w0)
	let alpha = sinw / (2 * Q)
	return { sinw, cosw, alpha }
}

export function lowpass (fc, Q, fs) {
	let { cosw, alpha } = intermediates(fc, Q, fs)
	return norm(
		(1 - cosw) / 2, 1 - cosw, (1 - cosw) / 2,
		1 + alpha, -2 * cosw, 1 - alpha
	)
}

export function highpass (fc, Q, fs) {
	let { cosw, alpha } = intermediates(fc, Q, fs)
	return norm(
		(1 + cosw) / 2, -(1 + cosw), (1 + cosw) / 2,
		1 + alpha, -2 * cosw, 1 - alpha
	)
}

export function bandpass (fc, Q, fs) {
	let { sinw, cosw, alpha } = intermediates(fc, Q, fs)
	return norm(
		sinw / 2, 0, -sinw / 2,
		1 + alpha, -2 * cosw, 1 - alpha
	)
}

export function bandpass2 (fc, Q, fs) {
	let { cosw, alpha } = intermediates(fc, Q, fs)
	return norm(
		alpha, 0, -alpha,
		1 + alpha, -2 * cosw, 1 - alpha
	)
}

export function notch (fc, Q, fs) {
	let { cosw, alpha } = intermediates(fc, Q, fs)
	return norm(
		1, -2 * cosw, 1,
		1 + alpha, -2 * cosw, 1 - alpha
	)
}

export function allpass (fc, Q, fs) {
	let { cosw, alpha } = intermediates(fc, Q, fs)
	return norm(
		1 - alpha, -2 * cosw, 1 + alpha,
		1 + alpha, -2 * cosw, 1 - alpha
	)
}

export function peaking (fc, Q, fs, dBgain) {
	let { cosw, alpha } = intermediates(fc, Q, fs)
	let A = pow(10, dBgain / 40)
	return norm(
		1 + alpha * A, -2 * cosw, 1 - alpha * A,
		1 + alpha / A, -2 * cosw, 1 - alpha / A
	)
}

export function lowshelf (fc, Q, fs, dBgain) {
	let { cosw, alpha } = intermediates(fc, Q, fs)
	let A = pow(10, dBgain / 40)
	let s = 2 * sqrt(A) * alpha
	return norm(
		A * ((A+1) - (A-1)*cosw + s),
		2*A * ((A-1) - (A+1)*cosw),
		A * ((A+1) - (A-1)*cosw - s),
		(A+1) + (A-1)*cosw + s,
		-2 * ((A-1) + (A+1)*cosw),
		(A+1) + (A-1)*cosw - s
	)
}

export function highshelf (fc, Q, fs, dBgain) {
	let { cosw, alpha } = intermediates(fc, Q, fs)
	let A = pow(10, dBgain / 40)
	let s = 2 * sqrt(A) * alpha
	return norm(
		A * ((A+1) + (A-1)*cosw + s),
		-2*A * ((A-1) + (A+1)*cosw),
		A * ((A+1) + (A-1)*cosw - s),
		(A+1) - (A-1)*cosw + s,
		2 * ((A-1) - (A+1)*cosw),
		(A+1) - (A-1)*cosw - s
	)
}
