/**
 * Elliptic (Cauer) filter → cascaded SOS
 * Sharpest transition band for given order. Equiripple in both bands.
 *
 * Even orders: exact equiripple via numerical v0 solver.
 * Odd orders: approximate equiripple — peak-normalized passband, correct stopband.
 *   The numerical solver enforces edge attenuation but interior peaks may deviate
 *   slightly from ideal. Passband is normalized so no peak exceeds 0dB.
 *
 * @module  digital-filter/elliptic
 */

let {sqrt, pow, sin, cos, abs, atan, PI, floor, max} = Math
import { poleZerosSos } from './transform.js'

/**
 * Design elliptic (Cauer) filter as cascaded second-order sections.
 *
 * @param {number} order - Filter order
 * @param {number} fc - Cutoff frequency in Hz
 * @param {number} [fs=44100] - Sample rate in Hz
 * @param {number} [ripple=1] - Passband ripple in dB
 * @param {number} [attenuation=40] - Stopband attenuation in dB
 * @param {string} [type='lowpass'] - Filter type: 'lowpass', 'highpass', 'bandpass', 'bandstop'
 * @returns {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>} SOS sections
 */
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

	// Odd order: peak-normalize passband so max response = 0dB (1.0).
	// The solver gives correct edge attenuation but interior peaks may exceed 0dB
	// due to numerical interaction in the per-sample pole formula.
	if (order % 2 === 1 && order > 1) {
		let peakMag = passbandPeak(sections, fc, fs, type)
		if (peakMag > 1 + 1e-10) {
			let norm = 1 / peakMag
			sections[0].b0 *= norm
			sections[0].b1 *= norm
			sections[0].b2 *= norm
		}
	}

	return sections
}

// Evaluate combined SOS magnitude at a digital frequency
function evalMag (sections, w) {
	let cosw = cos(w), sinw = sin(w)
	let cos2w = cos(2 * w), sin2w = sin(2 * w)
	let mag = 1
	for (let i = 0; i < sections.length; i++) {
		let c = sections[i]
		let br = c.b0 + c.b1 * cosw + c.b2 * cos2w
		let bi = -c.b1 * sinw - c.b2 * sin2w
		let ar = 1 + c.a1 * cosw + c.a2 * cos2w
		let ai = -c.a1 * sinw - c.a2 * sin2w
		mag *= sqrt((br * br + bi * bi) / (ar * ar + ai * ai))
	}
	return mag
}

// Find peak magnitude in passband by dense sweep
function passbandPeak (sections, fc, fs, type) {
	let nPts = 2048
	let peak = 0

	if (type === 'lowpass' || !type) {
		// Passband: 0 to fc
		for (let i = 0; i <= nPts; i++) {
			let f = i * fc / nPts
			let w = 2 * PI * f / fs
			let m = evalMag(sections, w)
			if (m > peak) peak = m
		}
	} else if (type === 'highpass') {
		// Passband: fc to Nyquist
		let nyq = fs / 2
		for (let i = 0; i <= nPts; i++) {
			let f = fc + i * (nyq - fc) / nPts
			let w = 2 * PI * f / fs
			let m = evalMag(sections, w)
			if (m > peak) peak = m
		}
	} else if (type === 'bandpass' && Array.isArray(fc)) {
		// Passband: fc[0] to fc[1]
		for (let i = 0; i <= nPts; i++) {
			let f = fc[0] + i * (fc[1] - fc[0]) / nPts
			let w = 2 * PI * f / fs
			let m = evalMag(sections, w)
			if (m > peak) peak = m
		}
	} else if (type === 'bandstop' && Array.isArray(fc)) {
		// Passband: 0 to fc[0] and fc[1] to Nyquist
		let nyq = fs / 2
		for (let i = 0; i <= nPts; i++) {
			let f = i * fc[0] / nPts
			let w = 2 * PI * f / fs
			let m = evalMag(sections, w)
			if (m > peak) peak = m
		}
		for (let i = 0; i <= nPts; i++) {
			let f = fc[1] + i * (nyq - fc[1]) / nPts
			let w = 2 * PI * f / fs
			let m = evalMag(sections, w)
			if (m > peak) peak = m
		}
	} else {
		// Fallback: sweep full band
		for (let i = 0; i <= nPts; i++) {
			let w = i * PI / nPts
			let m = evalMag(sections, w)
			if (m > peak) peak = m
		}
	}

	return peak
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
