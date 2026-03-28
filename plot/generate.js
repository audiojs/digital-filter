#!/usr/bin/env node
/**
 * Generate SVG plots for digital-filter documentation.
 * Run: node plot/generate.js
 */
import * as dsp from '../index.js'
import { plotFilter, plotFir, plotCompare, theme } from './index.js'
import { writeFileSync, mkdirSync } from 'node:fs'

let FS = theme.fs
mkdirSync('plots', { recursive: true })

function write (name, svg) { writeFileSync(`plot/${name}.svg`, svg) }
function impulse (fn, params, n = 2048, slice = 256) {
	let data = new Float64Array(n); data[0] = 1
	fn(data, params)
	return data.slice(0, slice)
}

// ── IIR families ──

write('butterworth', plotFilter(dsp.butterworth(4, 1000, FS), 'Butterworth order 4, fc=1kHz'))
write('butterworth-hp', plotFilter(dsp.butterworth(4, 1000, FS, 'highpass'), 'Butterworth HP order 4, fc=1kHz'))
write('chebyshev', plotFilter(dsp.chebyshev(4, 1000, FS, 1), 'Chebyshev Type I order 4, 1dB ripple'))
write('chebyshev2', plotFilter(dsp.chebyshev2(4, 2000, FS, 40), 'Chebyshev Type II order 4, 40dB'))
write('elliptic', plotFilter(dsp.elliptic(4, 1000, FS, 1, 40), 'Elliptic order 4, 1dB/40dB'))
write('bessel', plotFilter(dsp.bessel(4, 1000, FS), 'Bessel order 4, fc=1kHz'))
write('legendre', plotFilter(dsp.legendre(4, 1000, FS), 'Legendre order 4, fc=1kHz'))

// Biquad types
for (let type of ['lowpass', 'highpass', 'bandpass2', 'notch', 'allpass', 'peaking', 'lowshelf', 'highshelf']) {
	let fn = dsp.biquad[type]
	let coefs = type.includes('shelf') || type === 'peaking' ? fn(1000, 0.707, FS, 6) : fn(1000, type === 'notch' ? 10 : 1, FS)
	write('biquad-' + type, plotFilter(coefs, 'Biquad ' + type + ', fc=1kHz'))
}

// Linkwitz-Riley
write('linkwitz-riley-low', plotFilter(dsp.linkwitzRiley(4, 1000, FS).low, 'Linkwitz-Riley LR4, low band'))
write('linkwitz-riley-high', plotFilter(dsp.linkwitzRiley(4, 1000, FS).high, 'Linkwitz-Riley LR4, high band'))

// One-pole as SOS
let opA = Math.exp(-2 * Math.PI * 1000 / FS)
write('one-pole', plotFilter([{b0: 1 - opA, b1: 0, b2: 0, a1: -opA, a2: 0}], 'One-pole lowpass, fc=1kHz'))

// SVF
for (let type of ['lowpass', 'highpass', 'bandpass', 'notch']) {
	write('svf-' + type, plotFir(impulse(dsp.svf, {fc: 1000, Q: 1, fs: FS, type}), 'SVF ' + type + ', fc=1kHz, Q=1'))
}

// ── FIR ──

write('firwin-lp', plotFir(dsp.firwin(63, 1000, FS), 'firwin lowpass, 63 taps, fc=1kHz'))
write('firwin-hp', plotFir(dsp.firwin(63, 1000, FS, {type: 'highpass'}), 'firwin highpass, 63 taps, fc=1kHz'))
write('firwin-bp', plotFir(dsp.firwin(127, [500, 2000], FS, {type: 'bandpass'}), 'firwin bandpass, 127 taps'))
write('firls', plotFir(dsp.firls(63, [0, 0.3, 0.4, 1], [1, 1, 0, 0]), 'firls lowpass, 63 taps'))
write('remez', plotFir(dsp.remez(63, [0, 0.3, 0.4, 1], [1, 1, 0, 0]), 'remez equiripple, 63 taps'))
write('hilbert', plotFir(dsp.hilbert(63), 'Hilbert transform, 63 taps'))
write('differentiator', plotFir(dsp.differentiator(31), 'Differentiator, 31 taps'))
write('raised-cosine', plotFir(dsp.raisedCosine(65, 0.35, 4), 'Raised cosine, β=0.35, 4 sps'))
write('gaussian-fir', plotFir(dsp.gaussianFir(33, 0.3, 4), 'Gaussian FIR, N=33, BT=0.3'))
write('minimum-phase', plotFir(dsp.minimumPhase(dsp.firwin(65, 1000, FS)), 'Minimum-phase FIR, 65 taps, fc=1kHz'))
write('firwin2', plotFir(dsp.firwin2(201, [0, 0.1, 0.2, 0.4, 0.5, 1], [0, 0, 1, 1, 0, 0]), 'firwin2 bandpass, 201 taps'))
write('matched-filter', plotFir(dsp.matchedFilter(dsp.raisedCosine(33, 0.35, 4)), 'Matched filter (raised cosine template)'))
{ let h = dsp.integrator('simpson'), p = new Float64Array(32); p.set(h); write('integrator', plotFir(p, "Integrator (Simpson's rule)")) }
write('savitzky-golay', plotFir((() => { let d = new Float64Array(31); d[15] = 1; dsp.savitzkyGolay(d, {windowSize: 11, degree: 3}); return d })(), 'Savitzky-Golay, window=11, degree=3'))

{
	let {b, a} = dsp.yulewalk(8, [0, 0.2, 0.3, 0.5, 1], [1, 1, 0, 0, 0])
	let x = new Float64Array(2048); x[0] = 1; let y = new Float64Array(2048)
	for (let n = 0; n < 2048; n++) {
		for (let k = 0; k < b.length; k++) if (n-k >= 0) y[n] += b[k] * x[n-k]
		for (let k = 1; k < a.length; k++) if (n-k >= 0) y[n] -= a[k] * y[n-k]
	}
	write('yulewalk', plotFir(y.slice(0, 256), 'Yule-Walker IIR, order 8'))
}

// ── Smooth ──

write('moving-average', plotFir(impulse(dsp.movingAverage, {memory: 8}), 'Moving average, N=8'))
write('leaky-integrator', plotFir(impulse(dsp.leakyIntegrator, {lambda: 0.95}), 'Leaky integrator, λ=0.95'))
write('gaussian-iir', plotFir(impulse(dsp.gaussianIir, {sigma: 5}), 'Gaussian IIR, σ=5'))
write('dynamic-smoothing', plotFir(impulse(dsp.dynamicSmoothing, {minFc: 1, maxFc: 5000, sensitivity: 1, fs: FS}), 'Dynamic smoothing, fc=1–5kHz'))

// ── Multirate ──

write('decimate', plotFir(dsp.firwin(121, 0.9 * FS / 8, FS), 'Decimate anti-alias filter, factor 4'))
write('interpolate', plotFir(dsp.firwin(121, FS / 2, FS * 4), 'Interpolate anti-image filter, factor 4'))
write('half-band', plotFir(dsp.halfBand(31), 'Half-band FIR, 31 taps'))
write('cic', plotFir((() => { let d = new Float64Array(2048); d[0] = 1; return dsp.cic(d, 8, 3).slice(0, 64) })(), 'CIC decimator, R=8, N=3'))
write('polyphase', plotFir(dsp.polyphase(dsp.firwin(64, 0.25 * FS, FS), 4)[0], 'Polyphase component 0 of 4'))
write('farrow', plotFir((() => { let d = new Float64Array(2048); d[256] = 1; dsp.farrow(d, {delay: 3.7, order: 3}); return d.slice(240, 280) })(), 'Farrow fractional delay, d=3.7'))
write('oversample', plotFir((() => { let d = new Float64Array(64); d[0] = 1; return dsp.oversample(d, 4).slice(0, 256) })(), 'Oversample 4x'))

{
	let {b, a} = dsp.thiran(3.5, 3)
	let x = new Float64Array(2048); x[0] = 1; let y = new Float64Array(2048)
	for (let n = 0; n < 2048; n++) {
		for (let k = 0; k < b.length; k++) if (n-k >= 0) y[n] += b[k] * x[n-k]
		for (let k = 1; k < a.length; k++) if (n-k >= 0) y[n] -= a[k] * y[n-k]
	}
	write('thiran', plotFir(y.slice(0, 64), 'Thiran allpass delay, d=3.5'))
}

// ── Adaptive ──

{
	let sys = new Float64Array([0.5, -0.3, 0.2, -0.1]), N = 2048
	let input = new Float64Array(N)
	for (let i = 0; i < N; i++) input[i] = Math.random() * 2 - 1
	let desired = new Float64Array(N)
	for (let n = 0; n < N; n++)
		for (let k = 0; k < sys.length; k++)
			if (n - k >= 0) desired[n] += sys[k] * input[n - k]

	let lp = {order: 8, mu: 0.05}; dsp.lms(input, desired, lp)
	write('lms', plotFir(lp.error.slice(0, 512), 'LMS convergence, μ=0.05'))

	let np = {order: 8, mu: 0.5}; dsp.nlms(input, desired, np)
	write('nlms', plotFir(np.error.slice(0, 512), 'NLMS convergence, μ=0.5'))

	let rp = {order: 8, lambda: 0.99, delta: 100}; dsp.rls(input, desired, rp)
	write('rls', plotFir(rp.error.slice(0, 512), 'RLS convergence, λ=0.99'))
}

// ── Comparison plots ──

write('iir-comparison', plotCompare([
	['Butterworth', dsp.butterworth(4, 1000, FS)],
	['Chebyshev I', dsp.chebyshev(4, 1000, FS, 1)],
	['Elliptic', dsp.elliptic(4, 1000, FS, 1, 40)],
	['Bessel', dsp.bessel(4, 1000, FS)],
	['Legendre', dsp.legendre(4, 1000, FS)],
], 'IIR families, order 4, fc=1kHz'))

write('butterworth-orders', plotCompare([
	['N=1', dsp.butterworth(1, 1000, FS)],
	['N=2', dsp.butterworth(2, 1000, FS)],
	['N=4', dsp.butterworth(4, 1000, FS)],
	['N=8', dsp.butterworth(8, 1000, FS)],
], 'Butterworth orders 1–8, fc=1kHz'))

write('biquad-types', plotCompare([
	['lowpass', dsp.biquad.lowpass(1000, .707, FS)],
	['highpass', dsp.biquad.highpass(1000, .707, FS)],
	['bandpass', dsp.biquad.bandpass2(1000, 2, FS)],
	['notch', dsp.biquad.notch(1000, 10, FS)],
	['peaking', dsp.biquad.peaking(1000, 1, FS, 6)],
	['lowshelf', dsp.biquad.lowshelf(1000, .707, FS, 6)],
	['highshelf', dsp.biquad.highshelf(1000, .707, FS, 6)],
	['allpass', dsp.biquad.allpass(1000, 1, FS)],
], 'Biquad types, fc=1kHz', { irLength: 64, irMax: 0.6, gdMin: -10, gdMax: 5 }))

console.log('SVGs generated in plot/')
