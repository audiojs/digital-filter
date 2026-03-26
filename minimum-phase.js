/**
 * Convert linear-phase FIR to minimum-phase via cepstral method
 * Preserves magnitude response, reduces group delay by ~half.
 *
 * @module  digital-filter/minimum-phase
 */

let { cos, sin, sqrt, log, exp, PI } = Math

/**
 * @param {Float64Array} h - Linear-phase FIR coefficients
 * @returns {Float64Array} Minimum-phase FIR coefficients (same length)
 */
export default function minimumPhase (h) {
	let N = h.length
	let nfft = 1
	while (nfft < N * 4) nfft *= 2

	// Zero-pad and compute magnitude spectrum
	let mag = new Float64Array(nfft)
	for (let k = 0; k < nfft; k++) {
		let re = 0, im = 0
		for (let n = 0; n < N; n++) {
			let w = 2 * PI * k * n / nfft
			re += h[n] * cos(w)
			im -= h[n] * sin(w)
		}
		mag[k] = sqrt(re * re + im * im)
		if (mag[k] < 1e-20) mag[k] = 1e-20 // floor to avoid log(0)
	}

	// Log magnitude → real cepstrum
	let logMag = new Float64Array(nfft)
	for (let k = 0; k < nfft; k++) logMag[k] = log(mag[k])

	// IDFT → cepstrum
	let cepstrum = new Float64Array(nfft)
	for (let n = 0; n < nfft; n++) {
		let sum = 0
		for (let k = 0; k < nfft; k++) sum += logMag[k] * cos(2 * PI * k * n / nfft)
		cepstrum[n] = sum / nfft
	}

	// Fold cepstrum: keep n=0 and n=nfft/2, double n=1..nfft/2-1, zero n=nfft/2+1..nfft-1
	for (let n = 1; n < nfft / 2; n++) cepstrum[n] *= 2
	for (let n = nfft / 2 + 1; n < nfft; n++) cepstrum[n] = 0

	// DFT of folded cepstrum → exp → minimum-phase spectrum
	let mpRe = new Float64Array(nfft)
	let mpIm = new Float64Array(nfft)
	for (let k = 0; k < nfft; k++) {
		let re = 0, im = 0
		for (let n = 0; n < nfft; n++) {
			let w = 2 * PI * k * n / nfft
			re += cepstrum[n] * cos(w)
			im -= cepstrum[n] * sin(w)
		}
		let expRe = exp(re)
		mpRe[k] = expRe * cos(im)
		mpIm[k] = expRe * sin(im)
	}

	// IDFT → minimum-phase impulse response
	let out = new Float64Array(N)
	for (let n = 0; n < N; n++) {
		let sum = 0
		for (let k = 0; k < nfft; k++) {
			let w = 2 * PI * k * n / nfft
			sum += mpRe[k] * cos(w) - mpIm[k] * sin(w)
		}
		out[n] = sum / nfft
	}

	return out
}
