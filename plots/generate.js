/**
 * Generate SVG plots for filter documentation.
 * Run: node plots/generate.js
 *
 * Each filter gets a 4-panel plot:
 *   Top-left:     Magnitude response (dB vs Hz, log)
 *   Top-right:    Phase response (degrees vs Hz, log)
 *   Bottom-left:  Group delay (samples vs Hz, log)
 *   Bottom-right: Impulse response (amplitude vs samples)
 */
import * as dsp from '../index.js'
import { writeFileSync, mkdirSync } from 'node:fs'

let FS = 44100, NF = 2048  // 2048 bins → first bin at ~10.8 Hz, well below 20 Hz axis start
mkdirSync('plots', { recursive: true })

let GRID = '#e5e7eb', AXIS = '#d1d5db', TXT = '#6b7280'
let C = ['#4a90d9', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e']
let LM = 34, TM = 16, RM = 20, GAP = 36, PW = 365, PH = 155
let W = LM + PW + GAP + PW + RM, H = TM + PH + GAP + PH + 16

let P1 = { x: LM, y: TM, w: PW, h: PH }
let P2 = { x: LM + PW + GAP, y: TM, w: PW, h: PH }
let P3 = { x: LM, y: TM + PH + GAP, w: PW, h: PH }
let P4 = { x: LM + PW + GAP, y: TM + PH + GAP, w: PW, h: PH }

// ── SVG primitives ──

function svgOpen () { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="font-family:system-ui,-apple-system,sans-serif">\n` }

// dashed vertical line at fc on a log-frequency panel
function fcLine (p, fc, fMin = 10, fMax = 20000) {
	if (!fc || fc < fMin || fc > fMax) return ''
	let x = (p.x + Math.log10(fc / fMin) / Math.log10(fMax / fMin) * p.w).toFixed(1)
	return `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${AXIS}" stroke-width="1" stroke-dasharray="4 3"/>\n`
}

// extract fc from title string like "fc=1kHz" or "fc=500Hz"
function parseFc (title) {
	let m = title?.match(/fc=(\d+(?:\.\d+)?)\s*(k?)\s*Hz/i)
	if (!m) return null
	return +m[1] * (m[2].toLowerCase() === 'k' ? 1000 : 1)
}

// zeroAt: if provided, places the x-axis at this value (centered panels). Otherwise bottom.
function panel (p, xLabel, yLabel, yMin, yMax, zeroAt) {
	let axisY = (zeroAt != null && yMin != null) ?
		(p.y + p.h - (zeroAt - yMin) / (yMax - yMin) * p.h) : (p.y + p.h)
	return `  <line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y+p.h}" stroke="${AXIS}"/>\n` +
		`  <line x1="${p.x}" y1="${axisY.toFixed(1)}" x2="${p.x+p.w}" y2="${axisY.toFixed(1)}" stroke="${AXIS}"/>\n` +
		`  <text x="${p.x+p.w/2}" y="${p.y+p.h+26}" text-anchor="middle" font-size="9" fill="${TXT}">${xLabel}</text>\n` +
		`  <text x="${p.x-22}" y="${p.y+p.h/2}" text-anchor="middle" font-size="9" fill="${TXT}" transform="rotate(-90 ${p.x-22} ${p.y+p.h/2})">${yLabel}</text>\n`
}

function hTicks (p, ticks, yMin, yMax) {
	let s = ''
	for (let v of ticks) {
		let y = (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
		if (v !== 0) s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${GRID}" stroke-width="0.5"/>\n`
		s += `  <text x="${p.x-4}" y="${(+y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="${TXT}">${v}</text>\n`
	}
	return s
}

function logXTicks (p, ticks, fMin, fMax) {
	let s = '', lr = Math.log10(fMax / fMin)
	// Subgrid: lines at 2-9 within each decade (no labels)
	let decade = Math.pow(10, Math.floor(Math.log10(fMin)))
	while (decade < fMax) {
		for (let m = 2; m <= 9; m++) {
			let f = decade * m
			if (f >= fMin && f <= fMax) {
				let x = (p.x + Math.log10(f / fMin) / lr * p.w).toFixed(1)
				s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${GRID}" stroke-width="0.5"/>\n`
			}
		}
		decade *= 10
	}
	// Major ticks (decades) with labels
	for (let f of ticks) {
		let x = (p.x + Math.log10(f / fMin) / lr * p.w).toFixed(1)
		s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${GRID}" stroke-width="0.5"/>\n`
		s += `  <text x="${x}" y="${p.y+p.h+12}" text-anchor="middle" font-size="8" fill="${TXT}">${f >= 1000 ? (f/1000) + 'k' : f}</text>\n`
	}
	return s
}

function linXTicks (p, ticks, xMin, xMax) {
	let s = ''
	for (let v of ticks) {
		let x = (p.x + (v - xMin) / (xMax - xMin) * p.w).toFixed(1)
		s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${GRID}" stroke-width="0.5"/>\n`
		s += `  <text x="${x}" y="${p.y+p.h+12}" text-anchor="middle" font-size="8" fill="${TXT}">${v}</text>\n`
	}
	return s
}

let _gradId = 0

// Fill between curve and baseline with vertical gradient fading toward baseline.
// For two-sided data: two clip regions, each with gradient fading toward baseline from its side.
function _fill (p, pts, baselineY, clr) {
	if (pts.length < 2) return ''
	let by = Math.max(p.y, Math.min(p.y + p.h, baselineY))

	let hasAbove = false, hasBelow = false
	for (let pt of pts) {
		let y = +pt.split(',')[1]
		if (y < by - 0.5) hasAbove = true
		if (y > by + 0.5) hasBelow = true
	}

	let s = ''
	let x0 = pts[0].split(',')[0], xN = pts[pts.length - 1].split(',')[0]
	let bys = by.toFixed(1)
	let path = `M${pts[0]} ${pts.join(' ')} L${xN},${bys} L${x0},${bys} Z`

	if (hasAbove && hasBelow) {
		// Two gradients with userSpaceOnUse — absolute pixel coordinates
		let idA = 'g' + (_gradId++), idB = 'g' + (_gradId++)
		let clipA = 'c' + (_gradId++), clipB = 'c' + (_gradId++)

		// Above zero: gradient fades from top of panel toward baseline
		s += `  <defs><linearGradient id="${idA}" x1="0" y1="${p.y}" x2="0" y2="${bys}" gradientUnits="userSpaceOnUse">\n`
		s += `    <stop offset="0%" stop-color="${clr}" stop-opacity="0.15"/>\n`
		s += `    <stop offset="100%" stop-color="${clr}" stop-opacity="0.02"/>\n`
		s += `  </linearGradient></defs>\n`

		// Below zero: gradient fades from bottom of panel toward baseline
		s += `  <defs><linearGradient id="${idB}" x1="0" y1="${p.y + p.h}" x2="0" y2="${bys}" gradientUnits="userSpaceOnUse">\n`
		s += `    <stop offset="0%" stop-color="${clr}" stop-opacity="0.15"/>\n`
		s += `    <stop offset="100%" stop-color="${clr}" stop-opacity="0.02"/>\n`
		s += `  </linearGradient></defs>\n`

		// Clip regions
		s += `  <defs><clipPath id="${clipA}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${(by - p.y).toFixed(1)}"/></clipPath></defs>\n`
		s += `  <defs><clipPath id="${clipB}"><rect x="${p.x}" y="${bys}" width="${p.w}" height="${(p.y + p.h - by).toFixed(1)}"/></clipPath></defs>\n`

		s += `  <path d="${path}" fill="url(#${idA})" clip-path="url(#${clipA})"/>\n`
		s += `  <path d="${path}" fill="url(#${idB})" clip-path="url(#${clipB})"/>\n`
	} else {
		let id = 'g' + (_gradId++)
		let curveAbove = +pts[0].split(',')[1] < by
		// Gradient from the curve side toward the baseline
		let fromY = curveAbove ? p.y : p.y + p.h
		s += `  <defs><linearGradient id="${id}" x1="0" y1="${fromY}" x2="0" y2="${bys}" gradientUnits="userSpaceOnUse">\n`
		s += `    <stop offset="0%" stop-color="${clr}" stop-opacity="0.15"/>\n`
		s += `    <stop offset="100%" stop-color="${clr}" stop-opacity="0.02"/>\n`
		s += `  </linearGradient></defs>\n`

		s += `  <path d="${path}" fill="url(#${id})"/>\n`
	}
	return s
}

// fillBase: 'bottom' fills to yMin (for dB magnitude), 'zero' fills to value=0 (default)
function logPoly (p, freqs, vals, fMin, fMax, yMin, yMax, clr, w, fill, fillBase) {
	let fillPts = [], linePts = [], lr = Math.log10(fMax / fMin), lm = Math.log10(fMin)
	let lastPx = -Infinity
	for (let i = 0; i < freqs.length; i++) {
		if (freqs[i] <= 0 || freqs[i] < fMin || freqs[i] > fMax) continue
		let x = p.x + (Math.log10(freqs[i]) - lm) / lr * p.w
		if (x - lastPx < 0.8 && i < freqs.length - 1) continue
		lastPx = x
		// Clamped for fill
		let vc = Math.max(yMin, Math.min(yMax, vals[i]))
		let yc = p.y + p.h - (vc - yMin) / (yMax - yMin) * p.h
		fillPts.push(`${x.toFixed(1)},${yc.toFixed(1)}`)
		// Unclamped for line (let it extend beyond panel)
		let y = p.y + p.h - (vals[i] - yMin) / (yMax - yMin) * p.h
		linePts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
	}
	let s = ''
	if (fill !== false && fillPts.length > 1) {
		if (fillBase === 'down') {
			// Always fill downward from curve to panel bottom — no two-sided logic
			let id = 'g' + (_gradId++)
			s += `  <defs><linearGradient id="${id}" x1="0" y1="${p.y}" x2="0" y2="${p.y+p.h}" gradientUnits="userSpaceOnUse">\n`
			s += `    <stop offset="0%" stop-color="${clr}" stop-opacity="0.15"/>\n`
			s += `    <stop offset="100%" stop-color="${clr}" stop-opacity="0.02"/>\n`
			s += `  </linearGradient></defs>\n`
			let by = (p.y + p.h).toFixed(1)
			let x0 = fillPts[0].split(',')[0], xN = fillPts[fillPts.length-1].split(',')[0]
			s += `  <path d="M${fillPts[0]} ${fillPts.join(' ')} L${xN},${by} L${x0},${by} Z" fill="url(#${id})"/>\n`
		} else {
			let baseVal = Math.max(yMin, Math.min(yMax, 0))
			let baseY = p.y + p.h - (baseVal - yMin) / (yMax - yMin) * p.h
			s += _fill(p, fillPts, baseY, clr)
		}
	}
	// Clip the line to the panel bounds
	let clipId = 'pc' + (_gradId++)
	s += `  <defs><clipPath id="${clipId}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath></defs>\n`
	s += `  <polyline points="${linePts.join(' ')}" fill="none" stroke="${clr}" stroke-width="${w||1.3}" stroke-linejoin="round" clip-path="url(#${clipId})"/>\n`
	return s
}

function linPoly (p, data, xMin, xMax, yMin, yMax, clr, fill) {
	let fillPts = [], linePts = [], lastPx = -Infinity
	for (let i = 0; i < data.length; i++) {
		let x = p.x + (i - xMin) / (xMax - xMin) * p.w
		if (x - lastPx < 0.8 && i < data.length - 1 && i > 0) continue
		lastPx = x
		let vc = Math.max(yMin, Math.min(yMax, data[i]))
		let yc = p.y + p.h - (vc - yMin) / (yMax - yMin) * p.h
		fillPts.push(`${x.toFixed(1)},${yc.toFixed(1)}`)
		let y = p.y + p.h - (data[i] - yMin) / (yMax - yMin) * p.h
		linePts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
	}
	let s = ''
	if (fill !== false && fillPts.length > 1) {
		let baseVal = Math.max(yMin, Math.min(yMax, 0))
		let baseY = p.y + p.h - (baseVal - yMin) / (yMax - yMin) * p.h
		s += _fill(p, fillPts, baseY, clr)
	}
	let clipId = 'pc' + (_gradId++)
	s += `  <defs><clipPath id="${clipId}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath></defs>\n`
	s += `  <polyline points="${linePts.join(' ')}" fill="none" stroke="${clr}" stroke-width="1.3" stroke-linejoin="round" clip-path="url(#${clipId})"/>\n`
	return s
}

// Legend as vertical list inside the panel, 20px from left and bottom edges
function legend (items, p) {
	let s = ''
	let lh = 12
	let x = p.x + 20
	let y0 = p.y + p.h - 20 - (items.length - 1) * lh
	s += `  <rect x="${x-6}" y="${y0-8}" width="92" height="${items.length*lh+10}" fill="white" fill-opacity="0.85" rx="3"/>\n`
	for (let i = 0; i < items.length; i++) {
		let y = y0 + i * lh
		s += `  <line x1="${x}" y1="${y+3}" x2="${x+12}" y2="${y+3}" stroke="${items[i][1]}" stroke-width="2"/>\n`
		s += `  <text x="${x+16}" y="${y+6}" font-size="8" fill="${TXT}">${items[i][0]}</text>\n`
	}
	return s
}

let fTicks = [100, 1000, 10000]

// Fixed dB grid: labels at +20, 0, -20, -40, -60, -80; sublines at -10, -30, -50, -70
function dbGrid (p) {
	let yMin = -80, yMax = 20, s = ''
	let toY = v => (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
	// Sublines at +10 and -10 only (no labels)
	for (let v of [10, -10]) {
		let y = toY(v)
		s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${GRID}" stroke-width="0.5"/>\n`
	}
	// Major lines with labels (skip 0 — it's the x-axis)
	for (let v of [20, 0, -20, -40, -60, -80]) {
		let y = toY(v)
		if (v !== 0) s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${GRID}" stroke-width="0.5"/>\n`
		let label = v > 0 ? '+' + v : v
		s += `  <text x="${p.x-4}" y="${(+y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="${TXT}">${label}</text>\n`
	}
	return s
}

// Phase grid: labels at ±180 and 0, sublines at ±90 (no labels)
function phaseGrid (p) {
	let yMin = -200, yMax = 200, s = ''
	let toY = v => (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
	// Sublines at ±90 (no labels)
	for (let v of [90, -90]) {
		let y = toY(v)
		s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${GRID}" stroke-width="0.5"/>\n`
	}
	// Major lines with labels (skip 0 — it's the x-axis)
	for (let v of [180, 0, -180]) {
		let y = toY(v)
		if (v !== 0) s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${GRID}" stroke-width="0.5"/>\n`
		s += `  <text x="${p.x-4}" y="${(+y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="${TXT}">${v}</text>\n`
	}
	return s
}

// ── Per-filter 4-panel plot (SOS-based) ──

function plotFilter (name, sos, title) {
	let r = dsp.freqz(sos, NF, FS)
	let db = dsp.mag2db(r.magnitude)
	let phase = Array.from(r.phase).map(v => v * 180 / Math.PI)
	let gd = dsp.groupDelay(sos, NF, FS)
	let ir = dsp.impulseResponse(sos, 128)

	let irMax = 0
	for (let i = 0; i < ir.length; i++) if (Math.abs(ir[i]) > irMax) irMax = Math.abs(ir[i])
	if (irMax < 1e-10) irMax = 1

	let gdMin = Infinity, gdMax = -Infinity
	for (let i = 1; i < gd.delay.length; i++) {
		if (isFinite(gd.delay[i])) { if (gd.delay[i] < gdMin) gdMin = gd.delay[i]; if (gd.delay[i] > gdMax) gdMax = gd.delay[i] }
	}
	if (!isFinite(gdMin)) { gdMin = -1; gdMax = 1 }
	let gdRange = Math.max(Math.abs(gdMin), Math.abs(gdMax), 1)
	let gdLo = -Math.ceil(gdRange * 1.2), gdHi = Math.ceil(gdRange * 0.2)
	if (gdLo === gdHi) gdHi = gdLo + 2

	let fc = parseFc(title)
	let s = svgOpen()

	// Title
	s += `  <text x="${P2.x+P2.w}" y="${P2.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${TXT}">${title || name}</text>\n`

	// P1: Magnitude — fixed +20 to -80 dB, x-axis at 0dB
	s += panel(P1, 'Hz', 'dB', -80, 20, 0) + logXTicks(P1, fTicks, 10, 20000)
	s += dbGrid(P1) + fcLine(P1, fc)
	s += logPoly(P1, r.frequencies, Array.from(db), 10, 20000, -80, 20, C[0], 1.5, true, 'down')

	// P2: Phase — x-axis at 0°, centered
	s += panel(P2, 'Hz', 'Phase (deg)', -200, 200, 0) + logXTicks(P2, fTicks, 10, 20000) + phaseGrid(P2) + fcLine(P2, fc)
	s += logPoly(P2, r.frequencies, phase, 10, 20000, -200, 200, C[1], 1.5, true, 'zero')

	// P3: Group delay — x-axis at 0, centered vertically around data
	let gdMid = (gdMax + gdMin) / 2
	let gdSpan = Math.max(Math.abs(gdMax), Math.abs(gdMin), 1) * 1.3
	let gdLoCentered = -gdSpan, gdHiCentered = gdSpan
	s += panel(P3, 'Hz', 'Group delay', gdLoCentered, gdHiCentered, 0) + logXTicks(P3, fTicks, 10, 20000) + hTicks(P3, autoTicks(gdLoCentered, gdHiCentered, 4), gdLoCentered, gdHiCentered) + fcLine(P3, fc)
	s += logPoly(P3, gd.frequencies, Array.from(gd.delay), 10, 20000, gdLoCentered, gdHiCentered, C[2], 1.5, true, 'zero')

	// P4: Impulse response — x-axis at 0, centered
	s += panel(P4, 'Samples', 'Impulse response', -irMax, irMax, 0) + linXTicks(P4, [0, 32, 64, 96, 128], 0, 128) + hTicks(P4, autoTicks(-irMax, irMax, 3), -irMax, irMax)
	s += linPoly(P4, ir, 0, 128, -irMax, irMax, C[3])

	writeFileSync(`plots/${name}.svg`, s + '</svg>\n')
}

// ── Per-filter 4-panel plot (FIR / impulse-response based) ──

function plotFir (name, h, title) {
	// Compute freq response via DFT
	let freqs = new Float64Array(NF)
	let mag = new Float64Array(NF)
	let phase = new Float64Array(NF)
	for (let k = 0; k < NF; k++) {
		freqs[k] = k * FS / (2 * NF)
		let re = 0, im = 0, w = Math.PI * k / NF
		for (let n = 0; n < h.length; n++) { re += h[n] * Math.cos(w * n); im -= h[n] * Math.sin(w * n) }
		mag[k] = 20 * Math.log10(Math.max(Math.sqrt(re * re + im * im), 1e-15))
		phase[k] = Math.atan2(im, re) * 180 / Math.PI
	}

	// Group delay via numerical derivative of phase
	let gdFreqs = freqs, gdVals = new Float64Array(NF)
	for (let k = 1; k < NF - 1; k++) {
		let dp = phase[k + 1] - phase[k - 1]
		if (dp > 180) dp -= 360; if (dp < -180) dp += 360
		let dw = 2 * Math.PI / NF
		gdVals[k] = -dp / (dw * 180 / Math.PI)
	}
	gdVals[0] = gdVals[1]

	let hMax = 0
	for (let i = 0; i < h.length; i++) if (Math.abs(h[i]) > hMax) hMax = Math.abs(h[i])
	if (hMax < 1e-10) hMax = 1

	let gdMin = Infinity, gdMax = -Infinity
	for (let k = 1; k < Math.min(NF, NF * 0.8); k++) {
		if (isFinite(gdVals[k])) { if (gdVals[k] < gdMin) gdMin = gdVals[k]; if (gdVals[k] > gdMax) gdMax = gdVals[k] }
	}
	if (!isFinite(gdMin)) { gdMin = 0; gdMax = h.length }
	let gdPad = Math.max((gdMax - gdMin) * 0.1, 1)

	let fc = parseFc(title)
	let s = svgOpen()
	s += `  <text x="${P2.x+P2.w}" y="${P2.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${TXT}">${title || name}</text>\n`

	// P1: Magnitude — fixed +20 to -80 dB, x-axis at 0dB
	s += panel(P1, 'Hz', 'dB', -80, 20, 0) + logXTicks(P1, fTicks, 10, 20000)
	s += dbGrid(P1) + fcLine(P1, fc)
	s += logPoly(P1, freqs, Array.from(mag), 10, 20000, -80, 20, C[0], 1.5, true, 'down')

	// P2: Phase — x-axis at 0°, centered
	s += panel(P2, 'Hz', 'Phase (deg)', -200, 200, 0) + logXTicks(P2, fTicks, 10, 20000) + phaseGrid(P2) + fcLine(P2, fc)
	s += logPoly(P2, freqs, Array.from(phase), 10, 20000, -200, 200, C[1], 1.5, true, 'zero')

	// P3: Group delay — x-axis at 0, centered
	let gdSpan2 = Math.max(Math.abs(gdMin), Math.abs(gdMax), 1) * 1.3
	let gdLo2 = -gdSpan2, gdHi2 = gdSpan2
	s += panel(P3, 'Hz', 'Group delay', gdLo2, gdHi2, 0) + logXTicks(P3, [100, 1000, 10000], 10, 20000) + hTicks(P3, autoTicks(gdLo2, gdHi2, 4), gdLo2, gdHi2) + fcLine(P3, fc)
	s += logPoly(P3, gdFreqs, Array.from(gdVals), 10, 20000, gdLo2, gdHi2, C[2], 1.5, true, 'zero')

	// P4: Impulse response — x-axis at 0, centered
	s += panel(P4, 'Samples', 'Impulse response', -hMax, hMax, 0) + linXTicks(P4, autoTicks(0, h.length, 3).map(Math.round), 0, h.length) + hTicks(P4, autoTicks(-hMax, hMax, 3), -hMax, hMax)
	s += linPoly(P4, h, 0, h.length, -hMax, hMax, C[3])

	writeFileSync(`plots/${name}.svg`, s + '</svg>\n')
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

// ═══════════════════════════════════════
// Generate all plots
// ═══════════════════════════════════════

// ── Comparison plots (keep 2-panel for overlays) ──

let LP = { x: 55, y: 12, w: 330, h: 180 }
let RP = { x: 445, y: 12, w: 330, h: 180 }

// IIR comparison
{
	let fams = [
		['Butterworth', dsp.butterworth(4, 1000, FS), C[0]],
		['Chebyshev I', dsp.chebyshev(4, 1000, FS, 1), C[1]],
		['Elliptic', dsp.elliptic(4, 1000, FS, 1, 40), C[2]],
		['Bessel', dsp.bessel(4, 1000, FS), C[3]],
		['Legendre', dsp.legendre(4, 1000, FS), C[4]],
	]
	let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 240" style="font-family:system-ui,-apple-system,sans-serif">\n`
	s += panel(LP, 'Hz', 'dB', -80, 20, 0) + logXTicks(LP, fTicks, 10, 20000) + dbGrid(LP)
	s += panel(RP, 'Hz', 'Group delay', -25, 5, 0) + logXTicks(RP, fTicks, 10, 20000) + hTicks(RP, [0, -5, -10, -15, -20], -25, 5)
	for (let [n, sos, c] of fams) {
		let r = dsp.freqz(sos, NF, FS)
		s += logPoly(LP, r.frequencies, Array.from(dsp.mag2db(r.magnitude)), 10, 20000, -80, 20, c, 1.3, false)
		let gd = dsp.groupDelay(sos, NF, FS)
		s += logPoly(RP, gd.frequencies, Array.from(gd.delay), 10, 20000, -25, 5, c, 1.3, false)
	}
	s += legend(fams.map(f => [f[0], f[2]]), LP)
	writeFileSync('plots/iir-comparison.svg', s + '</svg>\n')
}

// Butterworth orders
{
	let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 240" style="font-family:system-ui,-apple-system,sans-serif">\n`
	s += panel(LP, 'Hz', 'dB', -80, 20, 0) + logXTicks(LP, fTicks, 10, 20000) + dbGrid(LP)
	s += panel(RP, 'Samples', 'Step response', 0, 1.3, 0) + linXTicks(RP, [0, 50, 100], 0, 120) + hTicks(RP, [0, 0.5, 1], 0, 1.3)
	for (let o = 1; o <= 8; o++) {
		let sos = dsp.butterworth(o, 1000, FS)
		let r = dsp.freqz(sos, NF, FS)
		s += logPoly(LP, r.frequencies, Array.from(dsp.mag2db(r.magnitude)), 10, 20000, -80, 20, C[0], 1.3, false)
		if ([1, 2, 4, 8].includes(o)) s += linPoly(RP, dsp.stepResponse(sos, 120), 0, 120, 0, 1.3, C[[1,2,4,8].indexOf(o)], false)
	}
	s += legend([[1,C[0]],[2,C[1]],[4,C[2]],[8,C[3]]].map(([o,c]) => ['N='+o, c]), LP)
	writeFileSync('plots/butterworth-orders.svg', s + '</svg>\n')
}

// Biquad types
{
	let types = [
		['lowpass', dsp.biquad.lowpass(1000,.707,FS), C[0]],
		['highpass', dsp.biquad.highpass(1000,.707,FS), C[1]],
		['bandpass', dsp.biquad.bandpass2(1000,2,FS), C[2]],
		['notch', dsp.biquad.notch(1000,10,FS), C[3]],
		['peaking', dsp.biquad.peaking(1000,1,FS,6), C[4]],
		['lowshelf', dsp.biquad.lowshelf(1000,.707,FS,6), C[5]],
		['highshelf', dsp.biquad.highshelf(1000,.707,FS,6), C[6]],
		['allpass', dsp.biquad.allpass(1000,1,FS), C[7]],
	]
	let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 240" style="font-family:system-ui,-apple-system,sans-serif">\n`
	s += panel(LP, 'Hz', 'dB', -80, 20, 0) + logXTicks(LP, fTicks, 10, 20000) + dbGrid(LP)
	s += panel(RP, 'Hz', 'Phase (deg)', -200, 200, 0) + logXTicks(RP, fTicks, 10, 20000) + phaseGrid(RP)
	for (let [n, co, c] of types) {
		let r = dsp.freqz(co, NF, FS)
		s += logPoly(LP, r.frequencies, Array.from(dsp.mag2db(r.magnitude)), 10, 20000, -80, 20, c, 1.3, false)
		s += logPoly(RP, r.frequencies, Array.from(r.phase).map(v => v * 180 / Math.PI), 10, 20000, -200, 200, c, 1.3, false)
	}
	s += legend(types.map(t => [t[0], t[2]]), LP)
	writeFileSync('plots/biquad-types.svg', s + '</svg>\n')
}

// ── Individual filter plots (4-panel each) ──

// IIR families
plotFilter('butterworth', dsp.butterworth(4, 1000, FS), 'Butterworth order 4, fc=1kHz')
plotFilter('butterworth-hp', dsp.butterworth(4, 1000, FS, 'highpass'), 'Butterworth HP order 4, fc=1kHz')
plotFilter('chebyshev', dsp.chebyshev(4, 1000, FS, 1), 'Chebyshev Type I order 4, 1dB ripple')
plotFilter('chebyshev2', dsp.chebyshev2(4, 2000, FS, 40), 'Chebyshev Type II order 4, 40dB')
plotFilter('elliptic', dsp.elliptic(4, 1000, FS, 1, 40), 'Elliptic order 4, 1dB/40dB')
plotFilter('bessel', dsp.bessel(4, 1000, FS), 'Bessel order 4, fc=1kHz')
plotFilter('legendre', dsp.legendre(4, 1000, FS), 'Legendre order 4, fc=1kHz')

// Biquad types
let bqTypes = ['lowpass', 'highpass', 'bandpass2', 'notch', 'allpass', 'peaking', 'lowshelf', 'highshelf']
for (let type of bqTypes) {
	let fn = dsp.biquad[type]
	let coefs = type.includes('shelf') || type === 'peaking' ? fn(1000, 0.707, FS, 6) : fn(1000, type === 'notch' ? 10 : 1, FS)
	plotFilter('biquad-' + type, coefs, 'Biquad ' + type + ', fc=1kHz')
}

// Weighting
plotFilter('a-weighting', dsp.aWeighting(FS), 'A-weighting (IEC 61672)')
plotFilter('c-weighting', dsp.cWeighting(FS), 'C-weighting (IEC 61672)')
plotFilter('k-weighting', dsp.kWeighting(48000), 'K-weighting (ITU-R BS.1770)')
plotFilter('riaa', dsp.riaa(FS), 'RIAA playback equalization')
plotFilter('itu468', dsp.itu468(48000), 'ITU-R 468 noise weighting')

// Linkwitz-Riley
plotFilter('linkwitz-riley-low', dsp.linkwitzRiley(4, 1000, FS).low, 'Linkwitz-Riley LR4, low band')
plotFilter('linkwitz-riley-high', dsp.linkwitzRiley(4, 1000, FS).high, 'Linkwitz-Riley LR4, high band')

// Simple IIR as SOS
let dcbR = 0.995
plotFilter('dc-blocker', [{b0: 1, b1: -1, b2: 0, a1: -dcbR, a2: 0}], 'DC Blocker (R=0.995)')
let opA = Math.exp(-2 * Math.PI * 1000 / FS)
plotFilter('one-pole', [{b0: 1 - opA, b1: 0, b2: 0, a1: -opA, a2: 0}], 'One-pole lowpass, fc=1kHz')
let rR = 1 - Math.PI * 50 / FS, rW = 2 * Math.PI * 1000 / FS
plotFilter('resonator', [{b0: 1 - rR * rR, b1: 0, b2: 0, a1: -2 * rR * Math.cos(rW), a2: rR * rR}], 'Resonator, fc=1kHz, bw=50Hz')

// FIR
plotFir('firwin-lp', dsp.firwin(63, 1000, FS), 'firwin lowpass, 63 taps, fc=1kHz')
plotFir('firwin-hp', dsp.firwin(63, 1000, FS, {type: 'highpass'}), 'firwin highpass, 63 taps, fc=1kHz')
plotFir('firwin-bp', dsp.firwin(127, [500, 2000], FS, {type: 'bandpass'}), 'firwin bandpass, 127 taps')
plotFir('firls', dsp.firls(63, [0, 0.3, 0.4, 1], [1, 1, 0, 0]), 'firls lowpass, 63 taps')
plotFir('remez', dsp.remez(63, [0, 0.3, 0.4, 1], [1, 1, 0, 0]), 'remez equiripple, 63 taps')
plotFir('hilbert', dsp.hilbert(63), 'Hilbert transform, 63 taps')
plotFir('differentiator', dsp.differentiator(31), 'Differentiator, 31 taps')
plotFir('raised-cosine', dsp.raisedCosine(65, 0.35, 4), 'Raised cosine, β=0.35, 4 sps')
plotFir('savitzky-golay', (() => { let d = new Float64Array(31); d[15] = 1; dsp.savitzkyGolay(d, {windowSize: 11, degree: 3}); return d })(), 'Savitzky-Golay, window=11, degree=3')

// Impulse-response based (virtual analog, psychoacoustic)
for (let [name, fn, params, title] of [
	['moog-ladder', dsp.moogLadder, {fc: 1000, resonance: 0.5, fs: FS}, 'Moog ladder ZDF, fc=1kHz, res=0.5'],
	['diode-ladder', dsp.diodeLadder, {fc: 1000, resonance: 0.5, fs: FS}, 'Diode ladder ZDF, fc=1kHz, res=0.5'],
	['korg35', dsp.korg35, {fc: 1000, resonance: 0.3, fs: FS}, 'Korg35 ZDF, fc=1kHz, res=0.3'],
]) {
	let data = new Float64Array(2048); data[0] = 1
	fn(data, params)
	plotFir(name, data.slice(0, 256), title)
}

for (let type of ['lowpass', 'highpass', 'bandpass', 'notch']) {
	let data = new Float64Array(2048); data[0] = 1
	dsp.svf(data, {fc: 1000, Q: 1, fs: FS, type})
	plotFir('svf-' + type, data.slice(0, 256), 'SVF ' + type + ', fc=1kHz, Q=1')
}

{
	let data = new Float64Array(2048); data[0] = 1
	dsp.gammatone(data, {fc: 1000, fs: FS})
	plotFir('gammatone', data.slice(0, 512), 'Gammatone, fc=1kHz, order=4')
}

{
	let data = new Float64Array(2048); data[0] = 1
	dsp.comb(data, {delay: 100, gain: 0.7, type: 'feedback'})
	plotFir('comb', data.slice(0, 512), 'Feedback comb, delay=100, gain=0.7')
}

// Smooth filters (impulse-response based)
{
	let data = new Float64Array(2048); data[0] = 1
	dsp.movingAverage(data, {memory: 8})
	plotFir('moving-average', data.slice(0, 256), 'Moving average, N=8')
}

{
	let data = new Float64Array(2048); data[0] = 1
	dsp.leakyIntegrator(data, {lambda: 0.95})
	plotFir('leaky-integrator', data.slice(0, 256), 'Leaky integrator, λ=0.95')
}

{
	let data = new Float64Array(2048); data[0] = 1
	dsp.gaussianIir(data, {sigma: 5})
	plotFir('gaussian-iir', data.slice(0, 256), 'Gaussian IIR, σ=5')
}

{
	let data = new Float64Array(2048); data[0] = 1
	dsp.dynamicSmoothing(data, {minFc: 1, maxFc: 5000, sensitivity: 1, fs: FS})
	plotFir('dynamic-smoothing', data.slice(0, 256), 'Dynamic smoothing, fc=1–5kHz')
}

// Misc filters (impulse-response based)
{
	let data = new Float64Array(2048); data[0] = 1
	dsp.allpass.first(data, {a: 0.5})
	plotFir('allpass-first', data.slice(0, 256), 'First-order allpass, a=0.5')
}

{
	let data = new Float64Array(2048); data[0] = 1
	dsp.emphasis(data, {alpha: 0.97})
	plotFir('pre-emphasis', data.slice(0, 256), 'Pre-emphasis, α=0.97')
}

{
	let data = new Float64Array(2048); data[0] = 1
	dsp.spectralTilt(data, {slope: -3, fs: FS})
	plotFir('spectral-tilt', data.slice(0, 256), 'Spectral tilt, −3 dB/oct')
}

{
	let data = new Float64Array(2048); data[0] = 1
	dsp.noiseShaping(data, {bits: 16})
	plotFir('noise-shaping', data.slice(0, 256), 'Noise shaping, 16-bit')
}

{
	let data = new Float64Array(256); data[0] = 1
	dsp.pinkNoise(data, {})
	plotFir('pink-noise', data, 'Pink noise filter, impulse')
}

{
	let data = new Float64Array(2048); data[0] = 1
	dsp.variableBandwidth(data, {fc: 1000, Q: 0.707, fs: FS, type: 'lowpass'})
	plotFir('variable-bandwidth', data.slice(0, 256), 'Variable bandwidth LP, fc=1kHz')
}

{
	let data = new Float64Array(2048); data[0] = 1
	dsp.envelope(data, {attack: 0.001, release: 0.05, fs: FS})
	plotFir('envelope', data.slice(0, 512), 'Envelope follower, atk=1ms rel=50ms')
}

{
	let data = new Float64Array(2048); data[0] = 1
	dsp.slewLimiter(data, {rise: 1000, fall: 1000, fs: FS})
	plotFir('slew-limiter', data.slice(0, 256), 'Slew limiter, rate=1000/s')
}

// FIR filters
plotFir('gaussian-fir', dsp.gaussianFir(33, 0.3, 4), 'Gaussian FIR, N=33, BT=0.3')
plotFir('minimum-phase', dsp.minimumPhase(dsp.firwin(65, 1000, FS)), 'Minimum-phase FIR, 65 taps, fc=1kHz')
plotFir('firwin2', dsp.firwin2(201, [0, 0.1, 0.2, 0.4, 0.5, 1], [0, 0, 1, 1, 0, 0]), 'firwin2 bandpass, 201 taps')
plotFir('matched-filter', dsp.matchedFilter(dsp.raisedCosine(33, 0.35, 4)), 'Matched filter (raised cosine template)')
plotFir('integrator', dsp.integrator('simpson'), "Integrator (Simpson's rule)")

{
	let {b, a} = dsp.yulewalk(8, [0, 0.2, 0.3, 0.5, 1], [1, 1, 0, 0, 0])
	let x = new Float64Array(2048); x[0] = 1
	let y = new Float64Array(2048)
	for (let n = 0; n < 2048; n++) {
		for (let k = 0; k < b.length; k++) if (n-k >= 0) y[n] += b[k] * x[n-k]
		for (let k = 1; k < a.length; k++) if (n-k >= 0) y[n] -= a[k] * y[n-k]
	}
	plotFir('yulewalk', y.slice(0, 256), 'Yule-Walker IIR, order 8')
}

console.log('SVGs generated in plots/')
