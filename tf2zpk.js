/**
 * Convert transfer function polynomial coefficients to zeros, poles, gain.
 * @param {Array|Float64Array} b - Numerator polynomial coefficients
 * @param {Array|Float64Array} a - Denominator polynomial coefficients
 * @returns {{zeros: Array<{re,im}>, poles: Array<{re,im}>, gain: number}}
 */
export default function tf2zpk (b, a) {
	let gain = b[0] / a[0]

	// Normalize polynomials
	let bn = Array.from(b).map(x => x / b[0])
	let an = Array.from(a).map(x => x / a[0])

	let zeros = polyRoots(bn)
	let poles = polyRoots(an)

	return { zeros, poles, gain }
}

// Find roots of polynomial p = [1, p1, p2, ...] (leading coefficient = 1)
function polyRoots (p) {
	let n = p.length - 1
	if (n === 0) return []
	if (n === 1) return [{ re: -p[1], im: 0 }]
	if (n === 2) return quadRoots(1, p[1], p[2])

	return durandKerner(p)
}

// Durand-Kerner method for polynomial roots
function durandKerner (p) {
	let n = p.length - 1

	// Initial guesses: points on a circle
	let roots = []
	for (let i = 0; i < n; i++) {
		let angle = 2 * Math.PI * i / n + 0.4
		let r = Math.pow(Math.abs(p[n]), 1 / n)
		roots.push({ re: r * Math.cos(angle), im: r * Math.sin(angle) })
	}

	for (let iter = 0; iter < 100; iter++) {
		let maxChange = 0
		for (let i = 0; i < n; i++) {
			// Evaluate p at roots[i] via Horner's method
			let pr = p[0], pi = 0
			for (let k = 1; k < p.length; k++) {
				let newR = pr * roots[i].re - pi * roots[i].im + p[k]
				let newI = pr * roots[i].im + pi * roots[i].re
				pr = newR; pi = newI
			}

			// Compute denominator: product of (roots[i] - roots[j]) for j != i
			let dr = 1, di = 0
			for (let j = 0; j < n; j++) {
				if (i === j) continue
				let diffR = roots[i].re - roots[j].re
				let diffI = roots[i].im - roots[j].im
				let newR = dr * diffR - di * diffI
				let newI = dr * diffI + di * diffR
				dr = newR; di = newI
			}

			// delta = p(z_i) / product(z_i - z_j)
			let dMag = dr * dr + di * di
			let deltaR = (pr * dr + pi * di) / dMag
			let deltaI = (pi * dr - pr * di) / dMag

			roots[i].re -= deltaR
			roots[i].im -= deltaI

			maxChange = Math.max(maxChange, Math.abs(deltaR) + Math.abs(deltaI))
		}
		if (maxChange < 1e-14) break
	}

	// Snap near-real roots to real axis
	for (let r of roots) {
		if (Math.abs(r.im) < 1e-10) r.im = 0
	}

	return roots
}

function quadRoots (a, b, c) {
	let disc = b * b - 4 * a * c
	if (disc >= 0) {
		let sq = Math.sqrt(disc)
		return [{ re: (-b + sq) / (2 * a), im: 0 }, { re: (-b - sq) / (2 * a), im: 0 }]
	}
	let sq = Math.sqrt(-disc)
	return [{ re: -b / (2 * a), im: sq / (2 * a) }, { re: -b / (2 * a), im: -sq / (2 * a) }]
}
