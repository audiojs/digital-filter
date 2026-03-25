/**
 * Parks-McClellan equiripple FIR filter design (Remez exchange).
 * @param {number} numtaps - Filter length (must be odd for type I)
 * @param {Array} bands - Band edges as fractions of Nyquist [0-1], e.g. [0, 0.3, 0.4, 1]
 * @param {Array} desired - Desired gain at each band edge, e.g. [1, 1, 0, 0]
 * @param {Array} [weight] - Weight per band (default all 1)
 * @param {number} [maxiter] - Maximum iterations (default 40)
 * @returns {Float64Array} FIR coefficients
 */
export default function remez (numtaps, bands, desired, weight, maxiter) {
	if (!maxiter) maxiter = 40
	let M = (numtaps - 1) / 2
	let L = M + 1
	let nBands = bands.length / 2
	if (!weight) weight = new Array(nBands).fill(1)

	// Dense frequency grid for error evaluation
	let gridSize = 16 * L
	let grid = []
	let desiredGrid = []
	let weightGrid = []

	for (let band = 0; band < nBands; band++) {
		let f1 = bands[band * 2], f2 = bands[band * 2 + 1]
		let d1 = desired[band * 2], d2 = desired[band * 2 + 1]
		let w = weight[band]
		let nPoints = Math.max(Math.round(gridSize * (f2 - f1)), 4)

		for (let i = 0; i < nPoints; i++) {
			let f = f1 + (f2 - f1) * i / (nPoints - 1)
			grid.push(f * Math.PI)
			desiredGrid.push(d1 + (d2 - d1) * i / (nPoints - 1))
			weightGrid.push(w)
		}
	}

	let nGrid = grid.length

	// Initialize extremal frequencies uniformly
	let nExtr = L + 1
	let extr = new Array(nExtr)
	for (let i = 0; i < nExtr; i++) {
		extr[i] = Math.round(i * (nGrid - 1) / (nExtr - 1))
	}

	// Remez exchange iteration
	for (let iter = 0; iter < maxiter; iter++) {
		// Compute delta (equiripple error) via Lagrange interpolation
		let x = extr.map(i => Math.cos(grid[i]))
		let y = extr.map(i => desiredGrid[i])
		let w = extr.map(i => weightGrid[i])

		// Compute barycentric weights
		let bary = new Float64Array(nExtr)
		for (let i = 0; i < nExtr; i++) {
			bary[i] = 1
			for (let j = 0; j < nExtr; j++) {
				if (i !== j) bary[i] *= (x[i] - x[j])
			}
			bary[i] = 1 / bary[i]
		}

		// Compute delta
		let num = 0, den = 0
		for (let i = 0; i < nExtr; i++) {
			let sign = (i % 2 === 0) ? 1 : -1
			num += bary[i] * y[i]
			den += bary[i] * sign / w[i]
		}
		let delta = num / den

		// Adjusted desired values (remove error from desired)
		let adjDesired = new Float64Array(nExtr)
		for (let i = 0; i < nExtr; i++) {
			let sign = (i % 2 === 0) ? 1 : -1
			adjDesired[i] = y[i] - sign * delta / w[i]
		}

		// Evaluate polynomial on entire grid via barycentric interpolation
		let A = new Float64Array(nGrid)
		for (let k = 0; k < nGrid; k++) {
			let xk = Math.cos(grid[k])
			let numVal = 0, denVal = 0
			let exact = -1
			for (let i = 0; i < nExtr; i++) {
				let diff = xk - x[i]
				if (Math.abs(diff) < 1e-15) { exact = i; break }
				let term = bary[i] / diff
				numVal += term * adjDesired[i]
				denVal += term
			}
			A[k] = exact >= 0 ? adjDesired[exact] : numVal / denVal
		}

		// Compute error on grid
		let error = new Float64Array(nGrid)
		for (let k = 0; k < nGrid; k++) {
			error[k] = weightGrid[k] * (A[k] - desiredGrid[k])
		}

		// Find new extremal frequencies: peaks of |error|
		let newExtr = []
		for (let k = 1; k < nGrid - 1; k++) {
			if ((error[k] > error[k - 1] && error[k] > error[k + 1]) ||
				(error[k] < error[k - 1] && error[k] < error[k + 1])) {
				newExtr.push(k)
			}
		}
		// Include endpoints if they're extrema
		if (Math.abs(error[0]) >= Math.abs(error[1])) newExtr.unshift(0)
		if (Math.abs(error[nGrid - 1]) >= Math.abs(error[nGrid - 2])) newExtr.push(nGrid - 1)

		// Keep only nExtr largest |error| peaks
		newExtr.sort((a, b) => Math.abs(error[b]) - Math.abs(error[a]))
		newExtr = newExtr.slice(0, nExtr)
		newExtr.sort((a, b) => a - b)

		// Check convergence
		let changed = false
		for (let i = 0; i < nExtr; i++) {
			if (newExtr[i] !== extr[i]) { changed = true; break }
		}

		extr = newExtr
		if (!changed) break
	}

	// Final: compute filter coefficients from last interpolation
	let x = extr.map(i => Math.cos(grid[i]))

	// Recompute barycentric from final extremals
	let bary = new Float64Array(nExtr)
	for (let i = 0; i < nExtr; i++) {
		bary[i] = 1
		for (let j = 0; j < nExtr; j++) {
			if (i !== j) bary[i] *= (x[i] - x[j])
		}
		bary[i] = 1 / bary[i]
	}

	let num = 0, den = 0
	for (let i = 0; i < nExtr; i++) {
		let sign = (i % 2 === 0) ? 1 : -1
		num += bary[i] * desiredGrid[extr[i]]
		den += bary[i] * sign / weightGrid[extr[i]]
	}
	let delta = num / den

	let adjDesired = new Float64Array(nExtr)
	for (let i = 0; i < nExtr; i++) {
		let sign = (i % 2 === 0) ? 1 : -1
		adjDesired[i] = desiredGrid[extr[i]] - sign * delta / weightGrid[extr[i]]
	}

	// Sample A(omega) at uniformly-spaced points and IDFT to get cosine coefficients
	let nSample = 4 * L
	let samples = new Float64Array(nSample)

	for (let k = 0; k < nSample; k++) {
		let omega = Math.PI * k / nSample
		let xk = Math.cos(omega)
		let numVal = 0, denVal = 0
		let exact = -1
		for (let i = 0; i < nExtr; i++) {
			let diff = xk - x[i]
			if (Math.abs(diff) < 1e-15) { exact = i; break }
			let term = bary[i] / diff
			numVal += term * adjDesired[i]
			denVal += term
		}
		samples[k] = exact >= 0 ? adjDesired[exact] : numVal / denVal
	}

	// IDFT to get cosine coefficients
	let a = new Float64Array(L)
	for (let k = 0; k < L; k++) {
		let sum = 0
		for (let n = 0; n < nSample; n++) {
			sum += samples[n] * Math.cos(k * Math.PI * n / nSample)
		}
		a[k] = sum / nSample * (k === 0 ? 1 : 2)
	}

	// Convert to impulse response
	let h = new Float64Array(numtaps)
	h[M] = a[0]
	for (let i = 1; i <= M; i++) {
		h[M - i] = a[i] / 2
		h[M + i] = a[i] / 2
	}

	return h
}
