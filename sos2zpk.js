let {sqrt, atan2, PI} = Math

/**
 * Convert SOS array to zeros, poles, and gain.
 * @param {Array} sos - [{b0,b1,b2,a1,a2}, ...]
 * @returns {{zeros: Array<{re,im}>, poles: Array<{re,im}>, gain: number}}
 */
export default function sos2zpk (sos) {
	let zeros = []
	let poles = []
	let gain = 1

	for (let s of sos) {
		// Numerator roots: b0*z^2 + b1*z + b2 = 0
		// z = (-b1 ± sqrt(b1^2 - 4*b0*b2)) / (2*b0)
		if (s.b0 !== 0) {
			gain *= s.b0
			let roots = quadRoots(1, s.b1 / s.b0, s.b2 / s.b0)
			zeros.push(...roots)
		} else if (s.b1 !== 0) {
			// First-order: b1*z + b2 = 0 → z = -b2/b1
			gain *= s.b1
			zeros.push({re: -s.b2 / s.b1, im: 0})
		}

		// Denominator roots: z^2 + a1*z + a2 = 0 (a0 = 1)
		if (s.a2 !== 0) {
			let roots = quadRoots(1, s.a1, s.a2)
			poles.push(...roots)
		} else if (s.a1 !== 0) {
			// First-order: z + a1 = 0 → z = -a1
			poles.push({re: -s.a1, im: 0})
		}
	}

	return {zeros, poles, gain}
}

function quadRoots (a, b, c) {
	let disc = b * b - 4 * a * c
	if (disc >= 0) {
		let sq = sqrt(disc)
		return [
			{re: (-b + sq) / (2 * a), im: 0},
			{re: (-b - sq) / (2 * a), im: 0}
		]
	}
	let sq = sqrt(-disc)
	return [
		{re: -b / (2 * a), im: sq / (2 * a)},
		{re: -b / (2 * a), im: -sq / (2 * a)}
	]
}
