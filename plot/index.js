/**
 * SVG plot generation for filter documentation.
 *
 * Usage:
 *   import { plotFilter, plotFir, plotCompare, theme } from 'digital-filter/plot/index.js'
 *
 *   // Single SOS filter → 4-panel SVG string
 *   let svg = plotFilter(sos, 'Butterworth order 4, fc=1kHz')
 *
 *   // Single impulse response → 4-panel SVG string
 *   let svg = plotFir(h, 'firwin lowpass, 63 taps')
 *
 *   // Multiple SOS overlaid → 4-panel SVG string
 *   let svg = plotCompare([
 *     ['Butterworth', butterworth(4, 1000, 44100)],
 *     ['Chebyshev', chebyshev(4, 1000, 44100, 1)],
 *   ], 'IIR comparison')
 *
 *   // Customize colors
 *   theme.colors = ['#e74c3c', '#2ecc71']
 *   theme.fill = false
 *
 * @module digital-filte./plot
 */
import { freqz, mag2db, groupDelay, impulseResponse } from '../index.js'

// ── Theme (customizable) ──

export let theme = {
	grid: '#e5e7eb',
	axis: '#d1d5db',
	text: '#6b7280',
	colors: ['#4a90d9', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'],
	fill: true,
	fs: 44100,
	bins: 2048,
}

// ── Layout ──

let LM = 34, TM = 16, RM = 20, GAP = 50, PW = 358, PH = 155
let W = LM + PW + GAP + PW + RM, H = TM + PH + GAP + PH + 16
let P1 = { x: LM, y: TM, w: PW, h: PH }
let P2 = { x: LM + PW + GAP, y: TM, w: PW, h: PH }
let P3 = { x: LM, y: TM + PH + GAP, w: PW, h: PH }
let P4 = { x: LM + PW + GAP, y: TM + PH + GAP, w: PW, h: PH }
let fTicks = [10, 100, 1000, 10000]

// ── SVG primitives ──

let _gradId = 0
let _defs = ''

function svgOpen () { _gradId = 0; _defs = ''; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="font-family:system-ui,-apple-system,sans-serif">\n` }

function svgClose (s) {
	if (!_defs) return '</svg>\n'
	// Inject defs right after the opening <svg> tag
	return `<defs>${_defs}  </defs>\n</svg>\n`
}

function svgWrap (s) {
	if (!_defs) return s + '</svg>\n'
	// Insert defs after first newline (after <svg ...>)
	let i = s.indexOf('\n') + 1
	return s.slice(0, i) + `  <defs>${_defs}  </defs>\n` + s.slice(i) + '</svg>\n'
}

function panel (p, xLabel, yLabel, yMin, yMax, zeroAt) {
	let axisY = (zeroAt != null && yMin != null) ?
		(p.y + p.h - (zeroAt - yMin) / (yMax - yMin) * p.h) : (p.y + p.h)
	return `  <line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y+p.h}" stroke="${theme.axis}"/>\n` +
		`  <line x1="${p.x}" y1="${axisY.toFixed(1)}" x2="${p.x+p.w}" y2="${axisY.toFixed(1)}" stroke="${theme.axis}"/>\n` +
		`  <text x="${p.x+p.w/2}" y="${p.y+p.h+26}" text-anchor="middle" font-size="9" fill="${theme.text}">${xLabel}</text>\n` +
		`  <text x="${p.x-22}" y="${p.y+p.h/2}" text-anchor="middle" font-size="9" fill="${theme.text}" transform="rotate(-90 ${p.x-22} ${p.y+p.h/2})">${yLabel}</text>\n`
}

function hTicks (p, ticks, yMin, yMax) {
	let s = ''
	for (let v of ticks) {
		let y = (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
		if (v !== 0) s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
		s += `  <text x="${p.x-4}" y="${(+y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="${theme.text}">${v}</text>\n`
	}
	return s
}

function logXTicks (p, ticks, fMin, fMax) {
	let s = '', lr = Math.log10(fMax / fMin)
	let decade = Math.pow(10, Math.floor(Math.log10(fMin)))
	while (decade < fMax) {
		for (let m = 2; m <= 9; m++) {
			let f = decade * m
			if (f >= fMin && f <= fMax) {
				let x = (p.x + Math.log10(f / fMin) / lr * p.w).toFixed(1)
				s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
			}
		}
		decade *= 10
	}
	for (let f of ticks) {
		let x = (p.x + Math.log10(f / fMin) / lr * p.w).toFixed(1)
		s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
		s += `  <text x="${x}" y="${p.y+p.h+12}" text-anchor="middle" font-size="8" fill="${theme.text}">${f >= 1000 ? (f/1000) + 'k' : f}</text>\n`
	}
	return s
}

function linXTicks (p, ticks, xMin, xMax) {
	let s = ''
	for (let v of ticks) {
		let x = (p.x + (v - xMin) / (xMax - xMin) * p.w).toFixed(1)
		s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
		s += `  <text x="${x}" y="${p.y+p.h+12}" text-anchor="middle" font-size="8" fill="${theme.text}">${v}</text>\n`
	}
	return s
}

function logPoly (p, freqs, vals, fMin, fMax, yMin, yMax, clr, w, fill, fillBase) {
	let lr = Math.log10(fMax / fMin), pts = []
	for (let i = 0; i < freqs.length; i++) {
		let f = freqs[i]
		if (f < fMin || f > fMax) continue
		let x = p.x + Math.log10(f / fMin) / lr * p.w
		let v = Math.max(yMin, Math.min(yMax, vals[i]))
		let y = p.y + p.h - (v - yMin) / (yMax - yMin) * p.h
		if (isFinite(x) && isFinite(y)) pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
	}
	if (pts.length < 2) return ''
	let s = ''
	if (fill && fillBase) {
		let baseY = fillBase === 'down' ? (p.y + p.h) : fillBase === 'zero' ?
			(p.y + p.h - (0 - yMin) / (yMax - yMin) * p.h) : (p.y + p.h)
		let id = 'g' + (++_gradId)
		// Find the curve's topmost y (lowest pixel value) for gradient start
		let minY = p.y + p.h
		for (let pt of pts) { let y = +pt.split(',')[1]; if (y < minY) minY = y }
		_defs += `\n    <linearGradient id="${id}" x1="0" y1="${minY.toFixed(0)}" x2="0" y2="${baseY.toFixed(0)}" gradientUnits="userSpaceOnUse">` +
			`<stop offset="0%" stop-color="${clr}" stop-opacity="0.18"/>` +
			`<stop offset="100%" stop-color="${clr}" stop-opacity="0.02"/>` +
			`</linearGradient>\n`
		s += `  <polygon points="${pts[0].split(',')[0]},${baseY.toFixed(1)} ${pts.join(' ')} ${pts[pts.length-1].split(',')[0]},${baseY.toFixed(1)}" fill="url(#${id})"/>\n`
	}
	s += `  <polyline points="${pts.join(' ')}" fill="none" stroke="${clr}" stroke-width="${w}" stroke-linejoin="round"/>\n`
	return s
}

function linPoly (p, data, xMin, xMax, yMin, yMax, clr, fill) {
	let pts = []
	let N = typeof data.length !== 'undefined' ? data.length : 0
	for (let i = 0; i < N; i++) {
		let x = p.x + (xMin + i * (xMax - xMin) / N - xMin) / (xMax - xMin) * p.w
		let v = Math.max(yMin, Math.min(yMax, data[i]))
		let y = p.y + p.h - (v - yMin) / (yMax - yMin) * p.h
		pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
	}
	if (pts.length < 2) return ''
	let s = ''
	if (fill) {
		let baseY = p.y + p.h - (0 - yMin) / (yMax - yMin) * p.h
		let id = 'g' + (++_gradId)
		let minY = p.y + p.h
		for (let pt of pts) { let y = +pt.split(',')[1]; if (y < minY) minY = y }
		_defs += `\n    <linearGradient id="${id}" x1="0" y1="${minY.toFixed(0)}" x2="0" y2="${baseY.toFixed(0)}" gradientUnits="userSpaceOnUse">` +
			`<stop offset="0%" stop-color="${clr}" stop-opacity="0.18"/>` +
			`<stop offset="100%" stop-color="${clr}" stop-opacity="0.02"/>` +
			`</linearGradient>\n`
		s += `  <polygon points="${pts[0].split(',')[0]},${baseY.toFixed(1)} ${pts.join(' ')} ${pts[pts.length-1].split(',')[0]},${baseY.toFixed(1)}" fill="url(#${id})"/>\n`
	}
	s += `  <polyline points="${pts.join(' ')}" fill="none" stroke="${clr}" stroke-width="1.2" stroke-linejoin="round"/>\n`
	return s
}

function dbGrid (p) {
	let yMin = -80, yMax = 20, s = ''
	let toY = v => (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
	for (let v of [-60, -40, -20, 20]) {
		let y = toY(v)
		s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
	}
	for (let v of [-60, -40, -20, 0, 20]) {
		s += `  <text x="${p.x-4}" y="${(+toY(v)+3).toFixed(1)}" text-anchor="end" font-size="8" fill="${theme.text}">${v}</text>\n`
	}
	return s
}

function phaseGrid (p) {
	let yMin = -180, yMax = 180, s = ''
	let toY = v => (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
	for (let v of [90, -90]) {
		let y = toY(v)
		s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
	}
	for (let v of [180, 0, -180]) {
		let y = toY(v)
		if (v !== 0) s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
		s += `  <text x="${p.x-4}" y="${(+y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="${theme.text}">${v}</text>\n`
	}
	return s
}

function fcLine (p, fc, fMin = 10, fMax = 20000) {
	if (!fc || fc < fMin || fc > fMax) return ''
	let x = (p.x + Math.log10(fc / fMin) / Math.log10(fMax / fMin) * p.w).toFixed(1)
	return `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${theme.axis}" stroke-width="1" stroke-dasharray="4 3"/>\n`
}

/**
 * Render inline legend.
 * @param {Array} items - [[name, color], ...]
 * @param {object} [pos] - { x, y } starting position. Defaults to title line (top-left of P1).
 */
export function legend (items, pos) {
	let s = '', x = pos?.x ?? P1.x, y = pos?.y ?? (P1.y - 5)
	for (let [name, clr] of items) {
		s += `  <line x1="${x}" y1="${y}" x2="${x+12}" y2="${y}" stroke="${clr}" stroke-width="2"/>\n`
		s += `  <text x="${x+15}" y="${(y+3).toFixed(1)}" font-size="8" fill="${theme.text}">${name}</text>\n`
		x += 15 + name.length * 5.2 + 10
	}
	return s
}

function parseFc (title) {
	let m = title?.match(/fc=(\d+(?:\.\d+)?)\s*(k?)\s*Hz/i)
	if (!m) return null
	return +m[1] * (m[2].toLowerCase() === 'k' ? 1000 : 1)
}

function autoTicks (lo, hi, n) {
	let range = hi - lo
	if (range === 0) return [lo]
	let step = range / n
	let mag = Math.pow(10, Math.floor(Math.log10(step)))
	step = Math.ceil(step / mag) * mag
	let ticks = []
	let start = Math.ceil(lo / step) * step
	for (let v = start; v <= hi + step * 0.01; v += step) ticks.push(Math.round(v * 1000) / 1000)
	return ticks
}

// ── Public API ──

/**
 * Generate 4-panel SVG for an SOS (biquad cascade) filter.
 * @param {Array} sos - SOS coefficient array [{b0,b1,b2,a1,a2}, ...]
 * @param {string} [title] - Plot title
 * @param {object} [opts] - Options: { fs, bins, color, fill }
 * @returns {string} SVG markup
 */
export function plotFilter (sos, title, opts = {}) {
	let fs = opts.fs || theme.fs, NF = opts.bins || theme.bins
	let clr = opts.color || theme.colors
	let doFill = opts.fill ?? theme.fill

	let r = freqz(sos, NF, fs)
	let db = mag2db(r.magnitude)
	let phase = Array.from(r.phase).map(v => v * 180 / Math.PI)
	let gd = groupDelay(sos, NF, fs)
	let ir = impulseResponse(sos, 128)

	let irMax = 0
	for (let i = 0; i < ir.length; i++) if (Math.abs(ir[i]) > irMax) irMax = Math.abs(ir[i])
	if (irMax < 1e-10) irMax = 1

	let gdMin = Infinity, gdMax = -Infinity
	for (let i = 1; i < gd.delay.length; i++) {
		if (isFinite(gd.delay[i])) { if (gd.delay[i] < gdMin) gdMin = gd.delay[i]; if (gd.delay[i] > gdMax) gdMax = gd.delay[i] }
	}
	if (!isFinite(gdMin)) { gdMin = -1; gdMax = 1 }
	let gdSpan = Math.max(Math.abs(gdMax), Math.abs(gdMin), 1) * 1.3
	let gdLo = -gdSpan, gdHi = gdSpan

	let fc = parseFc(title)
	let s = svgOpen()
	if (title) s += `  <text x="${P2.x+P2.w}" y="${P2.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${theme.text}">${title}</text>\n`

	s += panel(P1, 'Hz', 'dB', -80, 20, 0) + logXTicks(P1, fTicks, 10, 20000) + dbGrid(P1) + fcLine(P1, fc)
	s += logPoly(P1, r.frequencies, Array.from(db), 10, 20000, -80, 20, clr[0], 1.5, doFill, 'down')

	s += panel(P2, 'Hz', 'Phase (deg)', -180, 180, 0) + logXTicks(P2, fTicks, 10, 20000) + phaseGrid(P2) + fcLine(P2, fc)
	s += logPoly(P2, r.frequencies, phase, 10, 20000, -180, 180, clr[1], 1.5, doFill, 'zero')

	s += panel(P3, 'Hz', 'Group delay', gdLo, gdHi, 0) + logXTicks(P3, fTicks, 10, 20000) + hTicks(P3, autoTicks(gdLo, gdHi, 4), gdLo, gdHi) + fcLine(P3, fc)
	s += logPoly(P3, gd.frequencies, Array.from(gd.delay), 10, 20000, gdLo, gdHi, clr[2], 1.5, doFill, 'zero')

	s += panel(P4, 'Samples', 'Impulse', -irMax, irMax, 0) + linXTicks(P4, [0, 32, 64, 96, 128], 0, 128) + hTicks(P4, autoTicks(-irMax, irMax, 3), -irMax, irMax)
	s += linPoly(P4, ir, 0, 128, -irMax, irMax, clr[3], doFill)

	return svgWrap(s)
}

/**
 * Generate 4-panel SVG for an impulse response (FIR or processed buffer).
 * @param {Float64Array|Array} h - Impulse response samples
 * @param {string} [title] - Plot title
 * @param {object} [opts] - Options: { fs, bins, color, fill }
 * @returns {string} SVG markup
 */
export function plotFir (h, title, opts = {}) {
	let fs = opts.fs || theme.fs, NF = opts.bins || theme.bins
	let clr = opts.color || theme.colors
	let doFill = opts.fill ?? theme.fill

	let freqs = new Float64Array(NF)
	let mag = new Float64Array(NF)
	let phase = new Float64Array(NF)
	for (let k = 0; k < NF; k++) {
		freqs[k] = k * fs / (2 * NF)
		let re = 0, im = 0, w = Math.PI * k / NF
		for (let n = 0; n < h.length; n++) { re += h[n] * Math.cos(w * n); im -= h[n] * Math.sin(w * n) }
		mag[k] = 20 * Math.log10(Math.max(Math.sqrt(re * re + im * im), 1e-15))
		phase[k] = Math.atan2(im, re) * 180 / Math.PI
	}

	let gdFreqs = freqs, gdVals = new Float64Array(NF)
	for (let k = 1; k < NF - 1; k++) {
		let dp = phase[k + 1] - phase[k - 1]
		if (dp > 180) dp -= 360; if (dp < -180) dp += 360
		gdVals[k] = -dp / (2 * Math.PI / NF * 180 / Math.PI)
	}
	gdVals[0] = gdVals[1]

	let hMax = 0
	for (let i = 0; i < h.length; i++) if (Math.abs(h[i]) > hMax) hMax = Math.abs(h[i])
	if (hMax < 1e-10) hMax = 1

	let gdMin = Infinity, gdMax = -Infinity
	for (let k = 1; k < NF * 0.8; k++) {
		if (isFinite(gdVals[k])) { if (gdVals[k] < gdMin) gdMin = gdVals[k]; if (gdVals[k] > gdMax) gdMax = gdVals[k] }
	}
	if (!isFinite(gdMin)) { gdMin = 0; gdMax = h.length }

	let gdSpan = Math.max(Math.abs(gdMin), Math.abs(gdMax), 1) * 1.3
	let gdLo = -gdSpan, gdHi = gdSpan

	let fc = parseFc(title)
	let s = svgOpen()
	if (title) s += `  <text x="${P2.x+P2.w}" y="${P2.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${theme.text}">${title}</text>\n`

	s += panel(P1, 'Hz', 'dB', -80, 20, 0) + logXTicks(P1, fTicks, 10, 20000) + dbGrid(P1) + fcLine(P1, fc)
	s += logPoly(P1, freqs, Array.from(mag), 10, 20000, -80, 20, clr[0], 1.5, doFill, 'down')

	s += panel(P2, 'Hz', 'Phase (deg)', -180, 180, 0) + logXTicks(P2, fTicks, 10, 20000) + phaseGrid(P2) + fcLine(P2, fc)
	s += logPoly(P2, freqs, Array.from(phase), 10, 20000, -180, 180, clr[1], 1.5, doFill, 'zero')

	s += panel(P3, 'Hz', 'Group delay', gdLo, gdHi, 0) + logXTicks(P3, [100, 1000, 10000], 10, 20000) + hTicks(P3, autoTicks(gdLo, gdHi, 4), gdLo, gdHi) + fcLine(P3, fc)
	s += logPoly(P3, gdFreqs, Array.from(gdVals), 10, 20000, gdLo, gdHi, clr[2], 1.5, doFill, 'zero')

	s += panel(P4, 'Samples', 'Impulse', -hMax, hMax, 0) + linXTicks(P4, autoTicks(0, h.length, 3).map(Math.round), 0, h.length) + hTicks(P4, autoTicks(-hMax, hMax, 3), -hMax, hMax)
	s += linPoly(P4, h, 0, h.length, -hMax, hMax, clr[3], doFill)

	return svgWrap(s)
}

/**
 * Generate 4-panel SVG comparing multiple SOS filters overlaid.
 * @param {Array} filters - Array of [name, sos] or [name, sos, color]
 * @param {string} [title] - Plot title
 * @param {object} [opts] - Options: { fs, bins, irLength }
 * @returns {string} SVG markup
 */
export function plotCompare (filters, title, opts = {}) {
	let fs = opts.fs || theme.fs, NF = opts.bins || theme.bins
	let irLen = opts.irLength || 128

	let s = svgOpen()
	if (title) s += `  <text x="${P2.x+P2.w}" y="${P2.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${theme.text}">${title}</text>\n`

	let fc = parseFc(title)
	s += panel(P1, 'Hz', 'dB', -80, 20, 0) + logXTicks(P1, fTicks, 10, 20000) + dbGrid(P1) + fcLine(P1, fc)
	s += panel(P2, 'Hz', 'Phase (deg)', -180, 180, 0) + logXTicks(P2, fTicks, 10, 20000) + phaseGrid(P2) + fcLine(P2, fc)

	let gdLo = opts.gdMin ?? -25, gdHi = opts.gdMax ?? 5
	s += panel(P3, 'Hz', 'Group delay', gdLo, gdHi, 0) + logXTicks(P3, fTicks, 10, 20000) + hTicks(P3, autoTicks(gdLo, gdHi, 4), gdLo, gdHi) + fcLine(P3, fc)

	let irMax = opts.irMax ?? 0.35
	s += panel(P4, 'Samples', 'Impulse', -irMax, irMax, 0) + linXTicks(P4, autoTicks(0, irLen, 3).map(Math.round), 0, irLen) + hTicks(P4, autoTicks(-irMax, irMax, 3), -irMax, irMax)

	for (let i = 0; i < filters.length; i++) {
		let [name, sos, c] = filters[i]
		c = c || theme.colors[i % theme.colors.length]
		let r = freqz(sos, NF, fs)
		let db = Array.from(mag2db(r.magnitude))
		let phase = Array.from(r.phase).map(v => v * 180 / Math.PI)
		let gd = groupDelay(sos, NF, fs)
		let ir = impulseResponse(sos, irLen)
		s += logPoly(P1, r.frequencies, db, 10, 20000, -80, 20, c, 1.3, false)
		s += logPoly(P2, r.frequencies, phase, 10, 20000, -180, 180, c, 1.3, false)
		s += logPoly(P3, gd.frequencies, Array.from(gd.delay), 10, 20000, gdLo, gdHi, c, 1.3, false)
		s += linPoly(P4, ir, 0, irLen, -irMax, irMax, c)
	}

	s += legend(filters.map((f, i) => [f[0], f[2] || theme.colors[i % theme.colors.length]]), P1)
	return svgWrap(s)
}
