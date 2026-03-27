/**
 * Re-export window functions from window-function package,
 * adapted to batch API: fn(N, ...params) → Float64Array.
 *
 * @module digital-filter/window
 */
import * as wf from 'window-function'

let { generate } = wf

// Wrap per-sample fn(i, N, ...params) into batch fn(N, ...params) → Float64Array
function batch (fn) { return (N, ...params) => generate(fn, N, ...params) }

export let rectangular = batch(wf.rectangular)
export let triangular = batch(wf.triangular)
export let bartlett = batch(wf.bartlett)
export let welch = batch(wf.welch)
export let connes = batch(wf.connes)
export let hann = batch(wf.hann)
export let hamming = batch(wf.hamming)
export let cosine = batch(wf.cosine)
export let blackman = batch(wf.blackman)
export let exactBlackman = batch(wf.exactBlackman)
export let nuttall = batch(wf.nuttall)
export let blackmanNuttall = batch(wf.blackmanNuttall)
export let blackmanHarris = batch(wf.blackmanHarris)
export let flatTop = batch(wf.flatTop)
export let flattop = flatTop
export let bartlettHann = batch(wf.bartlettHann)
export let lanczos = batch(wf.lanczos)
export let parzen = batch(wf.parzen)
export let bohman = batch(wf.bohman)
export let powerOfSine = batch(wf.powerOfSine)
export let kaiser = batch(wf.kaiser)
export let gaussian = batch(wf.gaussian)
export let generalizedNormal = batch(wf.generalizedNormal)
export let tukey = batch(wf.tukey)
export let planckTaper = batch(wf.planckTaper)
export let exponential = batch(wf.exponential)
export let hannPoisson = batch(wf.hannPoisson)
export let cauchy = batch(wf.cauchy)
export let rifeVincent = batch(wf.rifeVincent)
export let confinedGaussian = batch(wf.confinedGaussian)
export let kaiserBesselDerived = batch(wf.kaiserBesselDerived)
export let dolphChebyshev = batch(wf.dolphChebyshev)
export let taylor = batch(wf.taylor)
export let dpss = batch(wf.dpss)
export let ultraspherical = batch(wf.ultraspherical)
