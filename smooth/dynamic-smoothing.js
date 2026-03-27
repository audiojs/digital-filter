/**
 * Dynamic smoothing filter. Cutoff increases when signal changes fast, decreases when stable.
 * Based on Andrew Simper's approach.
 *
 * @module  digital-filter/dynamic-smoothing
 */

let { abs, PI, tan } = Math

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { minFc, maxFc, sensitivity, fs }
 */
export default function dynamicSmoothing (data, params) {
	let minFc = params.minFc || 1
	let maxFc = params.maxFc || 5000
	let sens = params.sensitivity || 1
	let fs = params.fs || 44100

	let s1 = params._s1 || 0, s2 = params._s2 || 0
	let prev = params._prev || 0

	for (let i = 0, n = data.length; i < n; i++) {
		// Estimate speed of change
		let speed = abs(data[i] - prev)
		prev = data[i]

		// Adaptive cutoff
		let fc = minFc + (maxFc - minFc) * Math.min(speed * sens, 1)
		let g = tan(PI * fc / fs)
		let k = 2  // damping

		// SVF lowpass
		let a1 = 1 / (1 + g * (g + k))
		let a2 = g * a1
		let a3 = g * a2

		let v3 = data[i] - s2
		let v1 = a1 * s1 + a2 * v3
		let v2 = s2 + a2 * s1 + a3 * v3
		s1 = 2 * v1 - s1
		s2 = 2 * v2 - s2

		data[i] = v2  // lowpass output
	}

	params._s1 = s1; params._s2 = s2; params._prev = prev
	return data
}
