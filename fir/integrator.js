/**
 * FIR integrator using Newton-Cotes quadrature rules
 *
 * @module  digital-filter/integrator
 */

/**
 * @param {string} rule - 'trapezoidal' (default), 'simpson', 'simpson38', 'rectangular'
 * @returns {Float64Array} FIR coefficients
 */
export default function integrator (rule) {
	if (!rule) rule = 'trapezoidal'
	if (rule === 'rectangular') return new Float64Array([1])
	if (rule === 'trapezoidal') return new Float64Array([0.5, 0.5])
	if (rule === 'simpson') return new Float64Array([1/6, 4/6, 1/6])
	if (rule === 'simpson38') return new Float64Array([1/8, 3/8, 3/8, 1/8])
	throw Error('Unknown rule: ' + rule)
}
