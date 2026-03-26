/**
 * Generate SVG plots for filter documentation.
 * Run: node docs/generate.js
 */
import * as dsp from '../index.js'
import { writeFileSync, mkdirSync } from 'node:fs'

let FS = 44100, N = 512
mkdirSync('docs/plots', { recursive: true })

// ── Palette ──
let GRID = '#e5e7eb', AXIS = '#d1d5db', TXT = '#6b7280'
let C = ['#4a90d9', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e']

// ── SVG primitives ──

function svg (w, h) { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="font-family:system-ui,-apple-system,sans-serif">\n` }

function axes (p) {
	return `  <line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y+p.h}" stroke="${AXIS}"/>\n` +
		`  <line x1="${p.x}" y1="${p.y+p.h}" x2="${p.x+p.w}" y2="${p.y+p.h}" stroke="${AXIS}"/>\n`
}

function label (p, xText, yText) {
	return `  <text x="${p.x+p.w/2}" y="${p.y+p.h+30}" text-anchor="middle" font-size="10" fill="${TXT}">${xText}</text>\n` +
		`  <text x="${p.x-38}" y="${p.y+p.h/2}" text-anchor="middle" font-size="10" fill="${TXT}" transform="rotate(-90 ${p.x-38} ${p.y+p.h/2})">${yText}</text>\n`
}

function hGrid (p, ticks, yMin, yMax) {
	let s = ''
	for (let v of ticks) {
		let y = (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
		s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${GRID}" stroke-width="0.5"/>\n`
		s += `  <text x="${p.x-4}" y="${(+y+3).toFixed(1)}" text-anchor="end" font-size="9" fill="${TXT}">${v}</text>\n`
	}
	return s
}

function logXGrid (p, ticks, fMin, fMax) {
	let s = '', lr = Math.log10(fMax/fMin)
	for (let f of ticks) {
		let x = (p.x + Math.log10(f/fMin)/lr * p.w).toFixed(1)
		s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${GRID}" stroke-width="0.5"/>\n`
		s += `  <text x="${x}" y="${p.y+p.h+13}" text-anchor="middle" font-size="9" fill="${TXT}">${f>=1000?(f/1000)+'k':f}</text>\n`
	}
	return s
}

function linXGrid (p, ticks, xMin, xMax) {
	let s = ''
	for (let v of ticks) {
		let x = (p.x + (v-xMin)/(xMax-xMin)*p.w).toFixed(1)
		s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${GRID}" stroke-width="0.5"/>\n`
		s += `  <text x="${x}" y="${p.y+p.h+13}" text-anchor="middle" font-size="9" fill="${TXT}">${v}</text>\n`
	}
	return s
}

function logLine (p, freqs, vals, fMin, fMax, yMin, yMax, clr, w) {
	let pts = '', lr = Math.log10(fMax/fMin), lm = Math.log10(fMin)
	for (let i = 1; i < freqs.length; i++) {
		if (freqs[i] < fMin || freqs[i] > fMax) continue
		let x = p.x + (Math.log10(freqs[i])-lm)/lr * p.w
		let v = Math.max(yMin, Math.min(yMax, vals[i]))
		let y = p.y + p.h - (v-yMin)/(yMax-yMin)*p.h
		pts += ` ${x.toFixed(1)},${y.toFixed(1)}`
	}
	return `  <polyline points="${pts.trim()}" fill="none" stroke="${clr}" stroke-width="${w||1.3}" stroke-linejoin="round"/>\n`
}

function linLine (p, data, xMin, xMax, yMin, yMax, clr) {
	let pts = ''
	for (let i = 0; i < data.length; i++) {
		let x = p.x + (i-xMin)/(xMax-xMin)*p.w
		let v = Math.max(yMin, Math.min(yMax, data[i]))
		let y = p.y + p.h - (v-yMin)/(yMax-yMin)*p.h
		pts += ` ${x.toFixed(1)},${y.toFixed(1)}`
	}
	return `  <polyline points="${pts.trim()}" fill="none" stroke="${clr}" stroke-width="1.3" stroke-linejoin="round"/>\n`
}

function legend (items, y, xStart) {
	let s = ''
	for (let i = 0; i < items.length; i++) {
		let x = xStart + i * Math.min(140, 700 / items.length)
		s += `  <rect x="${x}" y="${y}" width="10" height="3" fill="${items[i][1]}" rx="1"/>\n`
		s += `  <text x="${x+14}" y="${y+4}" font-size="9" fill="${TXT}">${items[i][0]}</text>\n`
	}
	return s
}

// ── Panels ──

let LP = { x: 55, y: 12, w: 330, h: 180 }  // left panel
let RP = { x: 445, y: 12, w: 330, h: 180 }  // right panel
let FP = { x: 55, y: 12, w: 700, h: 180 }   // full width
let W = 800, legY = 210

function magPanel (p, title) {
	return axes(p) + label(p, 'Frequency (Hz)', title || 'Magnitude (dB)') +
		logXGrid(p, [100, 1000, 10000], 20, 20000) +
		hGrid(p, [0, -20, -40, -60, -80], -80, 0)
}

function magPanelWide (p, title) {
	return axes(p) + label(p, 'Frequency (Hz)', title || 'Magnitude (dB)') +
		logXGrid(p, [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000], 20, 20000) +
		hGrid(p, [0, -20, -40, -60, -80], -80, 0)
}

function plotMag (p, sos, clr) {
	let r = dsp.freqz(sos, N, FS)
	return logLine(p, r.frequencies, Array.from(dsp.mag2db(r.magnitude)), 20, 20000, -80, 0, clr)
}

function plotPhase (p, sos, clr) {
	let r = dsp.freqz(sos, N, FS)
	let phase = Array.from(r.phase).map(v => v * 180 / Math.PI)
	return logLine(p, r.frequencies, phase, 20, 20000, -200, 200, clr)
}

function plotGD (p, sos, clr) {
	let r = dsp.groupDelay(sos, N, FS)
	return logLine(p, r.frequencies, Array.from(r.delay), 20, 2000, -25, 5, clr)
}

// ── 1. IIR comparison ──
{
	let fams = [
		['Butterworth', dsp.butterworth(4,1000,FS), C[0]],
		['Chebyshev I', dsp.chebyshev(4,1000,FS,1), C[1]],
		['Elliptic',    dsp.elliptic(4,1000,FS,1,40), C[2]],
		['Bessel',      dsp.bessel(4,1000,FS), C[3]],
		['Legendre',    dsp.legendre(4,1000,FS), C[4]],
	]
	let s = svg(W, 240) + magPanel(LP) +
		axes(RP) + label(RP, 'Frequency (Hz)', 'Group delay (samples)') +
		logXGrid(RP, [100, 1000], 20, 2000) + hGrid(RP, [0, -5, -10, -15, -20], -25, 5)
	for (let [n, sos, c] of fams) { s += plotMag(LP, sos, c); s += plotGD(RP, sos, c) }
	s += legend(fams.map(f => [f[0], f[2]]), legY+10, 55)
	writeFileSync('docs/plots/iir-comparison.svg', s + '</svg>\n')
}

// ── 2. Butterworth orders ──
{
	let s = svg(W, 240) + magPanel(LP)
	let stp = axes(RP) + label(RP, 'Samples', 'Amplitude') +
		linXGrid(RP, [0, 50, 100], 0, 120) + hGrid(RP, [0, 0.5, 1], 0, 1.3)
	for (let o = 1; o <= 8; o++) {
		let sos = dsp.butterworth(o, 1000, FS)
		s += plotMag(LP, sos, C[0])
		if ([1,2,4,8].includes(o)) stp += linLine(RP, dsp.stepResponse(sos,120), 0,120, 0,1.3, C[[1,2,4,8].indexOf(o)])
	}
	s += stp + legend([[1,C[0]],[2,C[1]],[4,C[2]],[8,C[3]]].map(([o,c])=>['N='+o,c]), legY+10, 55)
	writeFileSync('docs/plots/butterworth-orders.svg', s + '</svg>\n')
}

// ── 3. Biquad types ──
{
	let types = [
		['lowpass',  dsp.biquad.lowpass(1000,.707,FS), C[0]],
		['highpass', dsp.biquad.highpass(1000,.707,FS), C[1]],
		['bandpass', dsp.biquad.bandpass2(1000,2,FS), C[2]],
		['notch',    dsp.biquad.notch(1000,10,FS), C[3]],
		['peaking',  dsp.biquad.peaking(1000,1,FS,6), C[4]],
		['lowshelf', dsp.biquad.lowshelf(1000,.707,FS,6), C[5]],
		['highshelf',dsp.biquad.highshelf(1000,.707,FS,6), C[6]],
		['allpass',  dsp.biquad.allpass(1000,1,FS), C[7]],
	]
	let s = svg(W, 240) +
		axes(LP) + label(LP, 'Frequency (Hz)', 'Magnitude (dB)') +
		logXGrid(LP, [100, 1000, 10000], 20, 20000) + hGrid(LP, [10, 0, -10, -20, -40, -60], -60, 10) +
		axes(RP) + label(RP, 'Frequency (Hz)', 'Phase (deg)') +
		logXGrid(RP, [100, 1000, 10000], 20, 20000) + hGrid(RP, [180, 0, -180], -200, 200)
	for (let [n, co, c] of types) {
		let r = dsp.freqz(co, N, FS), db = dsp.mag2db(r.magnitude)
		s += logLine(LP, r.frequencies, Array.from(db), 20, 20000, -60, 10, c)
		s += logLine(RP, r.frequencies, Array.from(r.phase).map(v=>v*180/Math.PI), 20, 20000, -200, 200, c)
	}
	s += legend(types.map(t => [t[0], t[2]]), legY+10, 30)
	writeFileSync('docs/plots/biquad-types.svg', s + '</svg>\n')
}

// ── 4. Per-filter individual plots ──
// Each: magnitude response (full width) with impulse response inset

function perFilter (name, sos, title) {
	let r = dsp.freqz(sos, N, FS)
	let db = dsp.mag2db(r.magnitude)
	let ir = dsp.impulseResponse(sos, 128)

	let IP = { x: 530, y: 20, w: 200, h: 100 }  // inset for impulse response

	let s = svg(W, 240) +
		axes(FP) + label(FP, 'Frequency (Hz)', 'Magnitude (dB)') +
		logXGrid(FP, [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000], 20, 20000) +
		hGrid(FP, [0, -20, -40, -60, -80], -80, 5) +
		logLine(FP, r.frequencies, Array.from(db), 20, 20000, -80, 5, C[0], 1.8)

	// Title
	s += `  <text x="${FP.x}" y="${FP.y+FP.h+48}" font-size="12" font-weight="600" fill="${TXT}">${title || name}</text>\n`

	// Impulse response inset
	let irMax = 0
	for (let i = 0; i < ir.length; i++) if (Math.abs(ir[i]) > irMax) irMax = Math.abs(ir[i])
	if (irMax < 1e-10) irMax = 1

	s += `  <rect x="${IP.x-1}" y="${IP.y-1}" width="${IP.w+2}" height="${IP.h+2}" fill="white" fill-opacity="0.85" rx="3"/>\n`
	s += `  <text x="${IP.x+2}" y="${IP.y+10}" font-size="8" fill="${TXT}">Impulse response</text>\n`
	s += linLine(IP, ir, 0, 128, -irMax, irMax, C[0])

	writeFileSync(`docs/plots/${name}.svg`, s + '</svg>\n')
}

// IIR families
perFilter('butterworth', dsp.butterworth(4, 1000, FS), 'Butterworth order 4, fc=1kHz')
perFilter('butterworth-hp', dsp.butterworth(4, 1000, FS, 'highpass'), 'Butterworth HP order 4, fc=1kHz')
perFilter('chebyshev', dsp.chebyshev(4, 1000, FS, 1), 'Chebyshev Type I order 4, 1dB ripple')
perFilter('chebyshev2', dsp.chebyshev2(4, 2000, FS, 40), 'Chebyshev Type II order 4, 40dB')
perFilter('elliptic', dsp.elliptic(4, 1000, FS, 1, 40), 'Elliptic order 4, 1dB/40dB')
perFilter('bessel', dsp.bessel(4, 1000, FS), 'Bessel order 4, fc=1kHz')
perFilter('legendre', dsp.legendre(4, 1000, FS), 'Legendre order 4, fc=1kHz')

// Biquad types
let bqTypes = ['lowpass','highpass','bandpass2','notch','allpass','peaking','lowshelf','highshelf']
for (let type of bqTypes) {
	let fn = dsp.biquad[type]
	let coefs = type.includes('shelf') || type === 'peaking' ? fn(1000, 0.707, FS, 6) : fn(1000, type === 'notch' ? 10 : 1, FS)
	perFilter('biquad-' + type, coefs, 'Biquad ' + type + ', fc=1kHz')
}

// Weighting
perFilter('a-weighting', dsp.aWeighting(FS), 'A-weighting (IEC 61672)')
perFilter('c-weighting', dsp.cWeighting(FS), 'C-weighting (IEC 61672)')
perFilter('k-weighting', dsp.kWeighting(48000), 'K-weighting (ITU-R BS.1770)')
perFilter('riaa', dsp.riaa(FS), 'RIAA playback equalization')

// Linkwitz-Riley
perFilter('linkwitz-riley-low', dsp.linkwitzRiley(4, 1000, FS).low, 'Linkwitz-Riley LR4, low band')
perFilter('linkwitz-riley-high', dsp.linkwitzRiley(4, 1000, FS).high, 'Linkwitz-Riley LR4, high band')

// ── FIR plots ──

function perFir (name, h, title) {
	let nf = 512
	let freqs = new Float64Array(nf)
	let mag = new Float64Array(nf)
	for (let k = 0; k < nf; k++) {
		freqs[k] = k * FS / (2 * nf)
		let re = 0, im = 0, w = Math.PI * k / nf
		for (let n = 0; n < h.length; n++) {
			re += h[n] * Math.cos(w * n)
			im -= h[n] * Math.sin(w * n)
		}
		mag[k] = 20 * Math.log10(Math.max(Math.sqrt(re * re + im * im), 1e-15))
	}

	let IP = { x: 530, y: 20, w: 200, h: 100 }

	let s = svg(W, 240) +
		axes(FP) + label(FP, 'Frequency (Hz)', 'Magnitude (dB)') +
		logXGrid(FP, [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000], 20, 20000) +
		hGrid(FP, [0, -20, -40, -60, -80], -80, 5) +
		logLine(FP, freqs, Array.from(mag), 20, 20000, -80, 5, C[0], 1.8)

	s += `  <text x="${FP.x}" y="${FP.y+FP.h+48}" font-size="12" font-weight="600" fill="${TXT}">${title || name}</text>\n`

	// Coefficients inset
	let irMax = 0
	for (let i = 0; i < h.length; i++) if (Math.abs(h[i]) > irMax) irMax = Math.abs(h[i])
	if (irMax < 1e-10) irMax = 1
	s += `  <rect x="${IP.x-1}" y="${IP.y-1}" width="${IP.w+2}" height="${IP.h+2}" fill="white" fill-opacity="0.85" rx="3"/>\n`
	s += `  <text x="${IP.x+2}" y="${IP.y+10}" font-size="8" fill="${TXT}">Coefficients</text>\n`
	s += linLine(IP, h, 0, h.length, -irMax, irMax, C[0])

	writeFileSync(`docs/plots/${name}.svg`, s + '</svg>\n')
}

// FIR filters
perFir('firwin-lp', dsp.firwin(63, 1000, FS), 'firwin lowpass, 63 taps, fc=1kHz')
perFir('firwin-hp', dsp.firwin(63, 1000, FS, {type:'highpass'}), 'firwin highpass, 63 taps, fc=1kHz')
perFir('firwin-bp', dsp.firwin(127, [500,2000], FS, {type:'bandpass'}), 'firwin bandpass, 127 taps')
perFir('firls', dsp.firls(63, [0,0.3,0.4,1], [1,1,0,0]), 'firls lowpass, 63 taps')
perFir('remez', dsp.remez(63, [0,0.3,0.4,1], [1,1,0,0]), 'remez equiripple, 63 taps')
perFir('hilbert', dsp.hilbert(63), 'Hilbert transform, 63 taps')
perFir('differentiator', dsp.differentiator(31), 'Differentiator, 31 taps')
perFir('raised-cosine', dsp.raisedCosine(65, 0.35, 4), 'Raised cosine, β=0.35, 4 sps')
perFir('savitzky-golay', (() => { let d = new Float64Array(31); d[15] = 1; dsp.savitzkyGolay(d, {windowSize:11, degree:3}); return d })(), 'Savitzky-Golay, window=11, degree=3')

// Simple IIR as SOS
let dcbR = 0.995
perFilter('dc-blocker', [{b0:1, b1:-1, b2:0, a1:-dcbR, a2:0}], 'DC Blocker (R=0.995)')

let opA = Math.exp(-2 * Math.PI * 1000 / FS)
perFilter('one-pole', [{b0:1-opA, b1:0, b2:0, a1:-opA, a2:0}], 'One-pole lowpass, fc=1kHz')

// Resonator
let rBw = 50, rFc = 1000
let rR = 1 - Math.PI * rBw / FS
let rW = 2 * Math.PI * rFc / FS
perFilter('resonator', [{b0:1-rR*rR, b1:0, b2:0, a1:-2*rR*Math.cos(rW), a2:rR*rR}], 'Resonator, fc=1kHz, bw=50Hz')

// ITU-R 468
perFilter('itu468', dsp.itu468(48000), 'ITU-R 468 noise weighting')

// Impulse-response filters (run on impulse, then compute freq response)
{
	let data = new Float64Array(2048); data[0] = 1
	dsp.gammatone(data, {fc:1000, fs:FS})
	perFir('gammatone', data, 'Gammatone, fc=1kHz, order=4')
}

for (let [name, fn, params, title] of [
	['moog-ladder', dsp.moogLadder, {fc:1000, resonance:0.5, fs:FS}, 'Moog ladder, fc=1kHz, res=0.5'],
	['diode-ladder', dsp.diodeLadder, {fc:1000, resonance:0.5, fs:FS}, 'Diode ladder, fc=1kHz, res=0.5'],
	['korg35', dsp.korg35, {fc:1000, resonance:0.3, fs:FS}, 'Korg35 lowpass, fc=1kHz, res=0.3'],
]) {
	let data = new Float64Array(2048); data[0] = 1
	fn(data, params)
	perFir(name, data, title)
}

// SVF modes
for (let type of ['lowpass', 'highpass', 'bandpass', 'notch']) {
	let data = new Float64Array(2048); data[0] = 1
	dsp.svf(data, {fc:1000, Q:1, fs:FS, type})
	perFir('svf-' + type, data, 'SVF ' + type + ', fc=1kHz, Q=1')
}

// Comb
{
	let data = new Float64Array(2048); data[0] = 1
	dsp.comb(data, {delay:100, gain:0.7, type:'feedback'})
	perFir('comb', data, 'Feedback comb, delay=100, gain=0.7')
}

console.log('SVGs generated in docs/plots/')
