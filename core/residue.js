/**
 * Partial fraction expansion of B(z)/A(z).
 * Decomposes transfer function into parallel first-order sections:
 *   H(z) = sum(r[k] / (1 - p[k]*z^-1)) + k[0] + k[1]*z^-1 + ...
 *
 * @param {Array<number>|Float64Array} b - Numerator polynomial [b0, b1, ...]
 * @param {Array<number>|Float64Array} a - Denominator polynomial [a0, a1, ...]
 * @returns {{r: Array<{re:number,im:number}>, p: Array<{re:number,im:number}>, k: Float64Array}}
 *   r: residues, p: poles, k: direct (FIR) terms
 */
export default function residue (b, a) {
	b = Array.from(b)
	a = Array.from(a)

	// Normalize by a[0]
	let a0 = a[0]
	if (a0 !== 1) {
		b = b.map(v => v / a0)
		a = a.map(v => v / a0)
	}

	// Direct terms via polynomial long division if deg(b) >= deg(a)
	let k = []
	let rem = b.slice()
	while (rem.length >= a.length) {
		let c = rem[0]
		k.push(c)
		for (let i = 0; i < a.length; i++) {
			rem[i] -= c * a[i]
		}
		rem.shift()
	}

	// Find poles of A(z)
	let poles = polyRoots(a)

	// Compute residues: r_k = (z - p_k) * B_rem(z) / A(z) evaluated at z = p_k
	// where B_rem is the remainder after long division
	let r = []
	for (let i = 0; i < poles.length; i++) {
		let pk = poles[i]
		// Evaluate rem(z) at z = p_k via Horner
		let nr = 0, ni = 0
		for (let j = 0; j < rem.length; j++) {
			let tr = nr * pk.re - ni * pk.im + rem[j]
			let ti = nr * pk.im + ni * pk.re
			nr = tr; ni = ti
		}
		// Evaluate A'(z) at z = p_k (derivative of denominator)
		// A'(z) = sum(j * a[j] * z^(n-j-1)) where n = deg(A)
		// Or equivalently: product of (z - p_j) for j != i
		let dr = 1, di = 0
		for (let j = 0; j < poles.length; j++) {
			if (i === j) continue
			let diffR = pk.re - poles[j].re
			let diffI = pk.im - poles[j].im
			let tr = dr * diffR - di * diffI
			let ti = dr * diffI + di * diffR
			dr = tr; di = ti
		}
		// r_k = rem(p_k) / A'(p_k) = rem(p_k) / product(p_k - p_j)
		let dMag = dr * dr + di * di
		if (dMag < 1e-30) {
			r.push({re: 0, im: 0})
		} else {
			r.push({
				re: (nr * dr + ni * di) / dMag,
				im: (ni * dr - nr * di) / dMag
			})
		}
	}

	return { r, p: poles, k: new Float64Array(k) }
}

// Find roots of monic polynomial [1, a1, a2, ...]
function polyRoots (p) {
	let n = p.length - 1
	if (n === 0) return []
	if (n === 1) return [{ re: -p[1], im: 0 }]
	if (n === 2) {
		let disc = p[1] * p[1] - 4 * p[2]
		if (disc >= 0) {
			let sq = Math.sqrt(disc)
			return [{ re: (-p[1] + sq) / 2, im: 0 }, { re: (-p[1] - sq) / 2, im: 0 }]
		}
		let sq = Math.sqrt(-disc)
		return [{ re: -p[1] / 2, im: sq / 2 }, { re: -p[1] / 2, im: -sq / 2 }]
	}
	return durandKerner(p)
}

function durandKerner (p) {
	let n = p.length - 1
	let roots = []
	for (let i = 0; i < n; i++) {
		let angle = 2 * Math.PI * i / n + 0.4
		let r = Math.pow(Math.abs(p[n]), 1 / n) || 1
		roots.push({ re: r * Math.cos(angle), im: r * Math.sin(angle) })
	}
	for (let iter = 0; iter < 100; iter++) {
		let maxChange = 0
		for (let i = 0; i < n; i++) {
			let pr = p[0], pi = 0
			for (let k = 1; k < p.length; k++) {
				let newR = pr * roots[i].re - pi * roots[i].im + p[k]
				let newI = pr * roots[i].im + pi * roots[i].re
				pr = newR; pi = newI
			}
			let dr = 1, di = 0
			for (let j = 0; j < n; j++) {
				if (i === j) continue
				let diffR = roots[i].re - roots[j].re
				let diffI = roots[i].im - roots[j].im
				let newR = dr * diffR - di * diffI
				let newI = dr * diffI + di * diffR
				dr = newR; di = newI
			}
			let dMag = dr * dr + di * di
			let deltaR = (pr * dr + pi * di) / dMag
			let deltaI = (pi * dr - pr * di) / dMag
			roots[i].re -= deltaR
			roots[i].im -= deltaI
			maxChange = Math.max(maxChange, Math.abs(deltaR) + Math.abs(deltaI))
		}
		if (maxChange < 1e-14) break
	}
	for (let r of roots) {
		if (Math.abs(r.im) < 1e-10) r.im = 0
	}
	return roots
}
