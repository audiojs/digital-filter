/**
 * Convert zeros/poles/gain to second-order sections.
 * Pairs poles with nearest zeros for best numerical stability.
 * @param {{zeros: Array<{re,im}>, poles: Array<{re,im}>, gain: number}} zpk
 * @returns {Array<{b0,b1,b2,a1,a2}>}
 */
export default function zpk2sos (zpk) {
	let { zeros, poles, gain } = zpk
	let z = zeros.slice(), p = poles.slice()
	let sections = []

	// Pair conjugate poles first, then pair with nearest zeros
	let polePairs = pairConjugates(p)
	let zeroPairs = pairConjugates(z)

	// Match zero pairs to pole pairs by proximity
	let used = new Array(zeroPairs.length).fill(false)

	for (let pp of polePairs) {
		let bestIdx = -1, bestDist = Infinity
		for (let i = 0; i < zeroPairs.length; i++) {
			if (used[i]) continue
			let dist = pairDistance(pp, zeroPairs[i])
			if (dist < bestDist) { bestDist = dist; bestIdx = i }
		}

		let zp = bestIdx >= 0 ? zeroPairs[bestIdx] : null
		if (bestIdx >= 0) used[bestIdx] = true

		sections.push(makeSosSection(pp, zp))
	}

	// Handle remaining unpaired zeros
	for (let i = 0; i < zeroPairs.length; i++) {
		if (!used[i]) {
			sections.push(makeSosSection(null, zeroPairs[i]))
		}
	}

	// Apply gain to first section
	if (gain !== 1 && sections.length > 0) {
		sections[0].b0 *= gain
		sections[0].b1 *= gain
		sections[0].b2 *= gain
	}

	return sections
}

function pairConjugates (list) {
	let pairs = []
	let used = new Array(list.length).fill(false)

	for (let i = 0; i < list.length; i++) {
		if (used[i]) continue
		used[i] = true

		if (list[i].im === 0 || Math.abs(list[i].im) < 1e-12) {
			// Real: try to pair with another real
			let bestJ = -1
			for (let j = i + 1; j < list.length; j++) {
				if (used[j]) continue
				if (Math.abs(list[j].im) < 1e-12) { bestJ = j; break }
			}
			if (bestJ >= 0) {
				used[bestJ] = true
				pairs.push([list[i], list[bestJ]])
			} else {
				pairs.push([list[i], null])
			}
		} else {
			// Complex: find conjugate
			let bestJ = -1, bestDist = Infinity
			for (let j = i + 1; j < list.length; j++) {
				if (used[j]) continue
				let dist = Math.abs(list[i].re - list[j].re) + Math.abs(list[i].im + list[j].im)
				if (dist < bestDist) { bestDist = dist; bestJ = j }
			}
			if (bestJ >= 0) {
				used[bestJ] = true
				pairs.push([list[i], list[bestJ]])
			} else {
				pairs.push([list[i], null])
			}
		}
	}

	return pairs
}

function pairDistance (pp, zp) {
	let pr = (pp[0].re + (pp[1] ? pp[1].re : 0)) / 2
	let pi = Math.abs(pp[0].im)
	let zr = (zp[0].re + (zp[1] ? zp[1].re : 0)) / 2
	let zi = Math.abs(zp[0].im)
	return Math.abs(pr - zr) + Math.abs(pi - zi)
}

function makeSosSection (polePair, zeroPair) {
	let a1 = 0, a2 = 0, b0 = 1, b1 = 0, b2 = 0

	if (polePair) {
		let p1 = polePair[0], p2 = polePair[1]
		if (p2) {
			// Two poles: (z - p1)(z - p2) = z^2 - (p1+p2)z + p1*p2
			a1 = -(p1.re + p2.re)
			a2 = p1.re * p2.re - p1.im * p2.im
		} else {
			// One pole: (z - p1) = z - p1.re
			a1 = -p1.re
		}
	}

	if (zeroPair) {
		let z1 = zeroPair[0], z2 = zeroPair[1]
		if (z2) {
			b0 = 1
			b1 = -(z1.re + z2.re)
			b2 = z1.re * z2.re - z1.im * z2.im
		} else {
			b0 = 1
			b1 = -z1.re
		}
	}

	return { b0, b1, b2, a1, a2 }
}
