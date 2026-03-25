/**
 * Elliptic (Cauer) filter → cascaded SOS
 * Sharpest transition band for given order. Equiripple in both bands.
 *
 * @module  digital-filter/elliptic
 */

let {sqrt, pow, sin, cos, abs, atan, PI, floor, max} = Math
import { poleZerosSos } from './transform.js'

export default function elliptic (order, fc, fs, ripple, attenuation, type) {
	if (!fs) fs = 44100
	if (!ripple) ripple = 1
	if (!attenuation) attenuation = 40
	if (!type) type = 'lowpass'

	let proto = ellipticPrototype(order, ripple, attenuation)
	let sections = poleZerosSos(proto.poles, proto.zeros, fc, fs, type)

	// Normalize gain: compute actual DC and correct to target
	// Odd order: DC = 0dB (max). Even order: DC = -Rp dB (min).
	let dcGain = 1
	for (let i = 0; i < sections.length; i++) {
		let s = sections[i]
		dcGain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
	}

	let eps = sqrt(pow(10, ripple / 10) - 1)
	let target = order % 2 === 0 ? 1 / sqrt(1 + eps * eps) : 1
	let scale = target / dcGain

	sections[0].b0 *= scale
	sections[0].b1 *= scale
	sections[0].b2 *= scale

	return sections
}

function ellipticPrototype (N, Rp, Rs) {
	let eps = sqrt(pow(10, Rp / 10) - 1)

	if (N === 1) {
		// First-order: single real pole, no zeros
		return { poles: [[-1 / eps, 0]], zeros: [] }
	}

	let epsS = sqrt(pow(10, Rs / 10) - 1)
	let k1 = eps / epsS

	// Selectivity k from degree equation: K(k)/K'(k) = N * K(k1)/K'(k1)
	let Kk1 = ellipk(k1 * k1)
	let Kk1p = ellipk(1 - k1 * k1)
	let ratio = N * Kk1 / Kk1p
	let m = solveM(ratio)
	let k = sqrt(m)
	let Km = ellipk(m)

	let L = floor(N / 2)
	let zeros = []
	let poles = []

	// Zeros on jω axis: ±j/(k * sn(u_i, m))
	for (let i = 1; i <= L; i++) {
		let ui = (2 * i - 1) * Km / N
		let {sn} = ellipj(ui, m)
		zeros.push([0, 1 / (k * sn)])
	}

	// Pole shift v0
	// Even order: numerical search for equiripple (peak/DC = 1+ε²)
	// Odd order: analytical formula, then correct with numerical refinement
	let Kp = ellipk(1 - m)
	let zf = zeros.map(function (z) { return z[1] })
	let w = solveV0(N, L, m, k, eps, zf, Kp)

	// Evaluate Jacobi functions at the shift parameter
	let {sn: sv, cn: cv, dn: dv} = ellipj(w, 1 - m)

	// Poles from cd(u_i - jv0K, m) via real-valued expansion
	for (let i = 1; i <= L; i++) {
		let ui = (2 * i - 1) * Km / N
		let {sn: su, cn: cu, dn: du} = ellipj(ui, m)

		// cn(u-jv, m) and dn(u-jv, m) via addition formulas
		// cn(u-jv) = (c*c' + j*s*d*s'*d') / D
		// dn(u-jv) = (d*c'*d' + j*m*s*c*s') / D
		let D = cv * cv + m * su * su * sv * sv

		let cnR = cu * cv / D
		let cnI = su * du * sv * dv / D
		let dnR = du * cv * dv / D
		let dnI = m * su * cu * sv / D

		// cd = cn/dn (complex division)
		let dMag2 = dnR * dnR + dnI * dnI
		let cdR = (cnR * dnR + cnI * dnI) / dMag2
		let cdI = (cnI * dnR - cnR * dnI) / dMag2

		// p = j * cd → sigma = -cdI, omega = cdR
		poles.push([-cdI, cdR])
	}

	// Odd order: real pole at -sv/cv
	if (N % 2 === 1) {
		poles.push([-sv / cv, 0])
	}

	return { poles, zeros }
}

// ────── Elliptic integrals via Carlson R_F ──────

// Carlson's symmetric elliptic integral of the first kind
function carlsonRF (x, y, z) {
	for (let i = 0; i < 100; i++) {
		let lam = sqrt(x * y) + sqrt(y * z) + sqrt(z * x)
		x = (x + lam) / 4
		y = (y + lam) / 4
		z = (z + lam) / 4
		let A = (x + y + z) / 3
		let dx = 1 - x / A, dy = 1 - y / A, dz = 1 - z / A
		if (max(abs(dx), abs(dy), abs(dz)) < 3e-8) {
			let E2 = dx * dy + dy * dz + dz * dx
			let E3 = dx * dy * dz
			return (1 - E2 / 10 + E3 / 14 + E2 * E2 / 24 - 3 * E2 * E3 / 44) / sqrt(A)
		}
	}
	return 1 / sqrt((x + y + z) / 3)
}

// Complete elliptic integral K(m) where m = k²
function ellipk (m) {
	if (m >= 1) return Infinity
	if (m <= 0) return PI / 2
	return carlsonRF(0, 1 - m, 1)
}

// Incomplete elliptic integral F(phi, m)
function ellipticF (phi, m) {
	if (abs(phi) < 1e-15) return 0
	if (abs(m) < 1e-15) return phi
	if (abs(phi - PI / 2) < 1e-15) return ellipk(m)
	let s = sin(phi), c = cos(phi)
	return s * carlsonRF(c * c, 1 - m * s * s, 1)
}

// ────── Jacobi elliptic functions via AGM ──────

function ellipj (u, m) {
	if (m < 1e-15) return { sn: sin(u), cn: cos(u), dn: 1 }
	if (m > 1 - 1e-15) return { sn: Math.tanh(u), cn: 1 / Math.cosh(u), dn: 1 / Math.cosh(u) }

	// AGM descending: compute sequences
	let a = [1], b = [sqrt(1 - m)], c = [sqrt(m)]
	while (abs(c[c.length - 1]) > 1e-15 && a.length < 50) {
		let n = a.length - 1
		a.push((a[n] + b[n]) / 2)
		c.push((a[n] - b[n]) / 2)
		b.push(sqrt(a[n] * b[n]))
	}

	// Forward: phi_N = 2^N * a_N * u
	let n = a.length - 1
	let phi = pow(2, n) * a[n] * u

	// Backward recurrence
	for (let i = n; i > 0; i--) {
		phi = (phi + Math.asin(c[i] / a[i] * sin(phi))) / 2
	}

	let sn = sin(phi), cn = cos(phi)
	return { sn, cn, dn: sqrt(1 - m * sn * sn) }
}

// ────── Solve for v0 numerically ──────

function solveV0 (N, L, m, k, eps, zeroFreqs, Kp) {
	let Km = ellipk(m)

	function computePoles (v0) {
		let {sn: sv, cn: cv, dn: dv} = ellipj(v0, 1 - m)
		let poles = []
		for (let i = 1; i <= L; i++) {
			let ui = (2 * i - 1) * Km / N
			let {sn: su, cn: cu, dn: du} = ellipj(ui, m)
			let D = cv * cv + m * su * su * sv * sv
			let cnR = cu * cv / D, cnI = su * du * sv * dv / D
			let dnR = du * cv * dv / D, dnI = m * su * cu * sv / D
			let dM2 = dnR * dnR + dnI * dnI
			poles.push({s: -(cnI * dnR - cnR * dnI) / dM2, w: (cnR * dnR + cnI * dnI) / dM2})
		}
		if (N % 2 === 1) poles.push({s: -sv / cv, w: 0})
		return poles
	}

	function evalH2at (poles, w) {
		let num = 1, den = 1
		for (let wz of zeroFreqs) num *= (wz * wz - w * w) * (wz * wz - w * w)
		for (let p of poles) {
			if (p.w === 0) den *= p.s * p.s + w * w
			else {
				let pm2 = p.s * p.s + p.w * p.w, bs = -2 * p.s
				den *= (pm2 - w * w) * (pm2 - w * w) + bs * bs * w * w
			}
		}
		return num / den
	}

	if (N % 2 === 0) {
		// Even: H²(peak)/H²(0) decreases with v0, target = 1+ε²
		let {cn: cp, dn: dp} = ellipj(Km / N, m)
		let wPeak = cp / dp
		let target = 1 + eps * eps
		let lo = 1e-10, hi = Kp - 1e-10
		for (let i = 0; i < 200; i++) {
			let mid = (lo + hi) / 2
			let poles = computePoles(mid)
			let ratio = evalH2at(poles, wPeak) / evalH2at(poles, 0)
			if (ratio > target) lo = mid
			else hi = mid
			if (hi - lo < 1e-14) break
		}
		return (lo + hi) / 2
	}

	// Odd: H²(1)/H²(0) increases with v0, target = 1/(1+ε²)
	let target = 1 / (1 + eps * eps)
	let lo = 1e-10, hi = Kp - 1e-10
	for (let i = 0; i < 200; i++) {
		let mid = (lo + hi) / 2
		let poles = computePoles(mid)
		let ratio = evalH2at(poles, 1) / evalH2at(poles, 0)
		if (ratio < target) lo = mid
		else hi = mid
		if (hi - lo < 1e-14) break
	}
	return (lo + hi) / 2
}

// ────── Solve K(m)/K(1-m) = ratio for m ──────

function solveM (ratio) {
	let lo = 1e-15, hi = 1 - 1e-15
	for (let i = 0; i < 100; i++) {
		let mid = (lo + hi) / 2
		let r = ellipk(mid) / ellipk(1 - mid)
		if (r < ratio) lo = mid
		else hi = mid
		if (hi - lo < 1e-15) break
	}
	return (lo + hi) / 2
}
