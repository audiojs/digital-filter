/**
 * Least-squares optimal linear-phase FIR filter design.
 * @param {number} numtaps - Filter length (must be odd)
 * @param {Array} bands - Frequency band edges as fractions of Nyquist [0-1], e.g. [0, 0.3, 0.4, 1]
 * @param {Array} desired - Desired gain at each band edge, e.g. [1, 1, 0, 0] for lowpass
 * @param {Array} [weight] - Weight per band (default all 1)
 * @returns {Float64Array} FIR coefficients
 */
export default function firls (numtaps, bands, desired, weight) {
	let M = (numtaps - 1) / 2
	let nBands = bands.length / 2
	if (!weight) {
		weight = new Array(nBands).fill(1)
	}

	// Build the matrix Q and vector d
	let L = M + 1  // number of cosine coefficients
	let Q = new Array(L)
	for (let i = 0; i < L; i++) Q[i] = new Float64Array(L)
	let d = new Float64Array(L)

	for (let band = 0; band < nBands; band++) {
		let f1 = bands[band * 2] * Math.PI
		let f2 = bands[band * 2 + 1] * Math.PI
		let d1 = desired[band * 2]
		let d2 = desired[band * 2 + 1]
		let w = weight[band]

		// Linear interpolation of desired response within band
		// D(f) = d1 + (d2 - d1) * (f - f1) / (f2 - f1)
		let slope = (f2 > f1) ? (d2 - d1) / (f2 - f1) : 0
		let intercept = d1 - slope * f1

		for (let i = 0; i < L; i++) {
			// d_i += w * integral_{f1}^{f2} D(f)*cos(i*f) df
			d[i] += w * integrateDcos(intercept, slope, i, f1, f2)

			for (let j = i; j < L; j++) {
				// Q_ij += w * integral_{f1}^{f2} cos(i*f)*cos(j*f) df
				let val = w * integrateCoscos(i, j, f1, f2)
				Q[i][j] += val
				if (i !== j) Q[j][i] += val
			}
		}
	}

	// Solve Q*a = d via Gaussian elimination
	let a = solveLinear(Q, d)

	// Convert cosine coefficients to FIR impulse response
	let h = new Float64Array(numtaps)
	h[M] = a[0]
	for (let i = 1; i <= M; i++) {
		h[M - i] = a[i] / 2
		h[M + i] = a[i] / 2
	}

	return h
}

// integral (a + b*f)*cos(n*f) df from f1 to f2
function integrateDcos (a, b, n, f1, f2) {
	if (n === 0) {
		return a * (f2 - f1) + b * (f2 * f2 - f1 * f1) / 2
	}
	// integral a*cos(nf) df = a*sin(nf)/n
	// integral b*f*cos(nf) df = b*(cos(nf) + n*f*sin(nf))/n^2
	let n2 = n * n
	return a * (Math.sin(n * f2) - Math.sin(n * f1)) / n +
		b * ((Math.cos(n * f2) + n * f2 * Math.sin(n * f2)) -
			(Math.cos(n * f1) + n * f1 * Math.sin(n * f1))) / n2
}

// integral cos(i*f)*cos(j*f) df from f1 to f2
// = integral [cos((i-j)f) + cos((i+j)f)] / 2 df
function integrateCoscos (i, j, f1, f2) {
	let diff = i - j, sum = i + j
	let val = 0
	if (diff === 0) val += (f2 - f1)
	else val += (Math.sin(diff * f2) - Math.sin(diff * f1)) / diff
	if (sum === 0) val += (f2 - f1)
	else val += (Math.sin(sum * f2) - Math.sin(sum * f1)) / sum
	return val / 2
}

// Solve Ax = b via Gaussian elimination with partial pivoting
function solveLinear (A, b) {
	let n = b.length
	let a = A.map(row => Float64Array.from(row))
	let x = Float64Array.from(b)

	for (let k = 0; k < n; k++) {
		// Partial pivot
		let maxVal = Math.abs(a[k][k]), maxRow = k
		for (let i = k + 1; i < n; i++) {
			if (Math.abs(a[i][k]) > maxVal) { maxVal = Math.abs(a[i][k]); maxRow = i }
		}
		if (maxRow !== k) { [a[k], a[maxRow]] = [a[maxRow], a[k]]; [x[k], x[maxRow]] = [x[maxRow], x[k]] }

		for (let i = k + 1; i < n; i++) {
			let factor = a[i][k] / a[k][k]
			for (let j = k; j < n; j++) a[i][j] -= factor * a[k][j]
			x[i] -= factor * x[k]
		}
	}

	// Back substitution
	for (let k = n - 1; k >= 0; k--) {
		for (let j = k + 1; j < n; j++) x[k] -= a[k][j] * x[j]
		x[k] /= a[k][k]
	}

	return x
}
