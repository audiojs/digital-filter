/**
 * Matched z-transform: analog poles/zeros → digital SOS via z_k = exp(s_k / fs).
 * No frequency warping — accurate for poles near Nyquist (unlike bilinear transform).
 *
 * @param {Array}  poles     analog poles: real numbers or {re, im} complex objects
 * @param {Array}  zeros     analog zeros: real numbers or {re, im} complex objects
 * @param {number} fs        sample rate (Hz)
 * @param {number} [normFreq] normalize gain to 0 dB at this frequency (Hz)
 * @returns {Array} [{b0,b1,b2,a1,a2}, ...]
 */

let { PI, exp, cos, sin, sqrt, abs } = Math

export default function matchedZ(poles, zeros, fs, normFreq) {
	let T = 1 / fs
	let zp = poles.map(s => toZ(s, T))
	let zz = zeros.map(s => toZ(s, T))
	let sections = buildSections(zp, zz)
	if (normFreq != null) normalize(sections, 2 * PI * normFreq / fs)
	return sections
}

// s → z = exp(s/fs); accepts real number or {re, im}
function toZ(s, T) {
	let re = typeof s === 'number' ? s : s.re
	let im = typeof s === 'number' ? 0 : (s.im ?? 0)
	let r = exp(re * T)
	return { re: r * cos(im * T), im: r * sin(im * T) }
}

// Pair all z-domain points: conjugate pairs first, then real pairs, singletons last
function pairAll(pts) {
	let rem = pts.map(p => ({ re: p.re, im: p.im }))
	let pairs = []
	let used = new Uint8Array(rem.length)

	// Conjugate pairs
	for (let i = 0; i < rem.length; i++) {
		if (used[i] || abs(rem[i].im) < 1e-10) continue
		let best = -1, bestDist = Infinity
		for (let j = i + 1; j < rem.length; j++) {
			if (used[j]) continue
			let d = abs(rem[j].re - rem[i].re) + abs(rem[j].im + rem[i].im)
			if (d < bestDist) { bestDist = d; best = j }
		}
		if (best >= 0 && bestDist < 1e-6) {
			used[i] = used[best] = 1
			pairs.push([rem[i], rem[best]])
		}
	}

	// Remaining real points: pair consecutive
	let reals = rem.filter((_, i) => !used[i])
	for (let i = 0; i + 1 < reals.length; i += 2)
		pairs.push([reals[i], reals[i + 1]])
	if (reals.length % 2 === 1)
		pairs.push([reals[reals.length - 1], null])

	return pairs
}

function buildSections(poles, zeros) {
	let pp = pairAll(poles), zp = pairAll(zeros)
	let n = Math.max(pp.length, zp.length)
	let sections = []
	for (let i = 0; i < n; i++)
		sections.push(makeBiquad(pp[i] ?? null, zp[i] ?? null))
	return sections
}

// Polynomial from z-domain root pair: (1 - p1*z^-1)(1 - p2*z^-1)
//   coefs: [1, -(p1+p2).re, (p1*p2).re]
function poly([p1, p2]) {
	if (p2 === null) return [1, -p1.re, 0]
	return [1, -(p1.re + p2.re), p1.re * p2.re - p1.im * p2.im]
}

function makeBiquad(polePair, zeroPair) {
	let [b0, b1, b2] = zeroPair ? poly(zeroPair) : [1, 0, 0]
	let [,  a1, a2] = polePair  ? poly(polePair)  : [1, 0, 0]
	return { b0, b1, b2, a1, a2 }
}

function normalize(sections, w) {
	let mag = 1
	let cw = cos(w), sw = sin(w), c2w = cos(2 * w), s2w = sin(2 * w)
	for (let c of sections) {
		let br = c.b0 + c.b1 * cw + c.b2 * c2w,  bi = -(c.b1 * sw + c.b2 * s2w)
		let ar = 1   + c.a1 * cw + c.a2 * c2w,   ai = -(c.a1 * sw + c.a2 * s2w)
		mag *= sqrt((br * br + bi * bi) / (ar * ar + ai * ai))
	}
	if (mag > 1e-30) { let k = 1 / mag; sections[0].b0 *= k; sections[0].b1 *= k; sections[0].b2 *= k }
}
