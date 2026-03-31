/**
 * State-space conversions: tf2ss and ss2tf.
 * Uses controllable canonical form.
 *
 * @module digital-filter/core/statespace
 */

/**
 * Transfer function to state-space (controllable canonical form).
 *
 * @param {Array<number>|Float64Array} b - Numerator polynomial [b0, b1, ..., bM]
 * @param {Array<number>|Float64Array} a - Denominator polynomial [a0, a1, ..., aN]
 * @returns {{A: Float64Array[], B: Float64Array, C: Float64Array, D: number}}
 *   A: N×N state matrix (array of rows), B: N×1 input vector,
 *   C: 1×N output vector, D: scalar feedthrough
 */
export function tf2ss (b, a) {
	b = Array.from(b)
	a = Array.from(a)

	// Normalize by a[0]
	let a0 = a[0]
	b = b.map(v => v / a0)
	a = a.map(v => v / a0)

	let N = a.length - 1
	if (N === 0) return { A: [], B: new Float64Array(0), C: new Float64Array(0), D: b[0] || 0 }

	// Pad b to same length as a
	while (b.length < a.length) b.push(0)

	// Feedthrough
	let D = b[0]

	// Controllable canonical form
	// A: companion matrix
	let A = []
	for (let i = 0; i < N; i++) {
		let row = new Float64Array(N)
		if (i < N - 1) {
			row[i + 1] = 1  // superdiagonal
		}
		A.push(row)
	}
	// Last row: -a[N], -a[N-1], ..., -a[1]
	for (let j = 0; j < N; j++) {
		A[N - 1][j] = -a[N - j]
	}

	// B: [0, 0, ..., 1]
	let B = new Float64Array(N)
	B[N - 1] = 1

	// C: [b[N] - a[N]*D, b[N-1] - a[N-1]*D, ..., b[1] - a[1]*D]
	let C = new Float64Array(N)
	for (let j = 0; j < N; j++) {
		C[j] = b[N - j] - a[N - j] * D
	}

	return { A, B, C, D }
}

/**
 * State-space to transfer function.
 *
 * @param {Float64Array[]|number[][]} A - N×N state matrix
 * @param {Float64Array|number[]} B - N×1 input vector
 * @param {Float64Array|number[]} C - 1×N output vector
 * @param {number} D - Scalar feedthrough
 * @returns {{b: Float64Array, a: Float64Array}} Transfer function polynomials
 */
export function ss2tf (A, B, C, D) {
	let N = A.length
	if (N === 0) return { b: new Float64Array([D || 0]), a: new Float64Array([1]) }

	// a(z) = det(zI - A) via characteristic polynomial
	// Use Faddeev-LeVerrier algorithm:
	// c_0 = 1, M_1 = I
	// c_k = -tr(A * M_k) / k
	// M_{k+1} = A * M_k + c_k * I
	let M = identity(N)
	let coeffs = [1]

	for (let k = 1; k <= N; k++) {
		let AM = matmul(A, M, N)
		let tr = 0
		for (let i = 0; i < N; i++) tr += AM[i][i]
		let ck = -tr / k
		coeffs.push(ck)

		if (k < N) {
			// M = AM + ck * I
			M = AM
			for (let i = 0; i < N; i++) M[i][i] += ck
		}
	}

	let aCoeffs = new Float64Array(coeffs)

	// b(z) = D * a(z) + C * adj(zI - A) * B
	// Using the M matrices from Faddeev-LeVerrier:
	// b_k = D * a_k + C * M_k * B  (where M matrices are accumulated during Faddeev-LeVerrier)

	// Recompute with M tracking for numerator
	M = identity(N)
	let bCoeffs = [D]

	for (let k = 1; k <= N; k++) {
		// b_k = D * a_k + C * M * B
		let CMB = 0
		for (let i = 0; i < N; i++) {
			let MBi = 0
			for (let j = 0; j < N; j++) MBi += M[i][j] * B[j]
			CMB += C[i] * MBi
		}
		bCoeffs.push(D * coeffs[k] + CMB)

		if (k < N) {
			let AM = matmul(A, M, N)
			for (let i = 0; i < N; i++) AM[i][i] += coeffs[k]
			M = AM
		}
	}

	return { b: new Float64Array(bCoeffs), a: aCoeffs }
}

function identity (N) {
	let I = []
	for (let i = 0; i < N; i++) {
		let row = new Float64Array(N)
		row[i] = 1
		I.push(row)
	}
	return I
}

function matmul (A, B, N) {
	let C = []
	for (let i = 0; i < N; i++) {
		let row = new Float64Array(N)
		for (let j = 0; j < N; j++) {
			let sum = 0
			for (let k = 0; k < N; k++) sum += A[i][k] * B[k][j]
			row[j] = sum
		}
		C.push(row)
	}
	return C
}
