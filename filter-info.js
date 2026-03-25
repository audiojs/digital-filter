import sos2zpk from './sos2zpk.js'

/**
 * Check if filter is stable (all poles inside unit circle).
 */
export function isStable (sos) {
	let {poles} = sos2zpk(sos)
	return poles.every(p => p.re * p.re + p.im * p.im < 1)
}

/**
 * Check if filter is minimum phase (all zeros inside or on unit circle).
 */
export function isMinPhase (sos) {
	let {zeros} = sos2zpk(sos)
	return zeros.every(z => z.re * z.re + z.im * z.im <= 1 + 1e-10)
}

/**
 * Check if filter is FIR (all poles at origin, i.e., a1=a2=0).
 */
export function isFir (sos) {
	return sos.every(s => s.a1 === 0 && s.a2 === 0)
}

/**
 * Check if FIR coefficients have linear phase (symmetric or antisymmetric).
 */
export function isLinPhase (h) {
	if (!(h instanceof Float64Array || Array.isArray(h))) return false
	let N = h.length
	// Check symmetric (Type I/II)
	let sym = true, antisym = true
	for (let i = 0; i < Math.floor(N / 2); i++) {
		if (Math.abs(h[i] - h[N - 1 - i]) > 1e-10) sym = false
		if (Math.abs(h[i] + h[N - 1 - i]) > 1e-10) antisym = false
	}
	return sym || antisym
}
