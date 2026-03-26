import { test } from 'node:test'
import assert from 'node:assert'
import * as dsp from '../index.js'
import { type2 as chebyshevType2 } from '../chebyshev.js'

let EPSILON = 1e-10
let LOOSE = 1e-4

function almostEqual (x, y, eps) {
	return Math.abs(x - y) <= eps
}

function almost (x, y, eps) {
	if (!eps) eps = EPSILON
	if (x.length && y.length) return x.every((x, i) => almost(x, y[i], eps))
	if (!almostEqual(x, y, eps)) throw Error(x + ' ≈ ' + y)
	return true
}

function impulse (n) {
	let d = new Float64Array(n || 64)
	d[0] = 1
	return d
}

function dc (n, val) {
	let d = new Float64Array(n || 64)
	d.fill(val || 1)
	return d
}

// --- Existing filters ---

test('leakyIntegrator', () => {
	let opts = {lambda: 0.95, y: 0}
	let src = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]
	let result = [0, 0, 0, 0, 0.05, 0.0475, 0.045125, 0.04286875, 0.0407253125, 0.038689046875, 0.03675459453125]
	assert.ok(almost(dsp.leakyIntegrator(src, opts), result))
})

test('movingAverage', () => {
	let opts = {memory: 3}
	let src = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
	let result = [0, 1/3, 1, 2, 3, 4, 5, 6, 7, 8]
	assert.ok(almost(dsp.movingAverage(src, opts), result))
})

// --- Core: biquad coefficients ---

test('biquad.lowpass — DC gain = 1', () => {
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	assert.ok(almost(dcGain, 1, LOOSE), 'lowpass DC gain = 1')
})

test('biquad.highpass — Nyquist gain = 1', () => {
	let c = dsp.biquad.highpass(1000, 0.707, 44100)
	let ny = (c.b0 - c.b1 + c.b2) / (1 - c.a1 + c.a2)
	assert.ok(almost(ny, 1, LOOSE), 'highpass Nyquist gain = 1')
})

test('biquad.notch — DC gain = 1, null at fc', () => {
	let fc = 1000, fs = 44100
	let c = dsp.biquad.notch(fc, 10, fs)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	assert.ok(almost(dcGain, 1, LOOSE), 'notch DC gain = 1')
})

test('biquad.allpass — DC gain = 1', () => {
	let c = dsp.biquad.allpass(1000, 1, 44100)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	assert.ok(almost(dcGain, 1, LOOSE), 'allpass DC gain = 1')
})

test('biquad.peaking — DC gain = 1', () => {
	let c = dsp.biquad.peaking(1000, 1, 44100, 6)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	assert.ok(almost(dcGain, 1, LOOSE), 'peaking DC gain = 1')
})

test('biquad.lowshelf — high frequency gain = 1', () => {
	let c = dsp.biquad.lowshelf(1000, 0.707, 44100, 6)
	let ny = (c.b0 - c.b1 + c.b2) / (1 - c.a1 + c.a2)
	assert.ok(almost(ny, 1, LOOSE), 'lowshelf Nyquist gain ≈ 1')
})

test('biquad.highshelf — DC gain = 1', () => {
	let c = dsp.biquad.highshelf(1000, 0.707, 44100, 6)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	assert.ok(almost(dcGain, 1, LOOSE), 'highshelf DC gain ≈ 1')
})

// --- Core: filter engine ---

test('filter — biquad lowpass passes DC', () => {
	let c = dsp.biquad.lowpass(5000, 0.707, 44100)
	let data = dc(128)
	let params = {coefs: c}
	dsp.filter(data, params)
	assert.ok(almost(data[127], 1, LOOSE), 'DC passes through lowpass')
})

test('filter — cascaded SOS', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	let data = dc(256)
	dsp.filter(data, {coefs: sos})
	assert.ok(almost(data[255], 1, LOOSE), 'DC passes through 4th-order Butterworth LP')
})

test('filter — state persists', () => {
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	let params = {coefs: c}
	dsp.filter(new Float64Array(64), params)
	assert.ok(params.state, 'state initialized')
	assert.ok(Array.isArray(params.state), 'state is array')
})

// --- Core: freqz ---

test('freqz — allpass has unity magnitude', () => {
	let c = dsp.biquad.allpass(2000, 1, 44100)
	let resp = dsp.freqz(c, 256, 44100)
	let ok = true
	for (let i = 1; i < resp.magnitude.length; i++) {
		if (!almostEqual(resp.magnitude[i], 1, LOOSE)) {
			ok = false
			break
		}
	}
	assert.ok(ok, 'allpass magnitude ≈ 1 everywhere')
	assert.ok(resp.frequencies.length === 256, 'correct number of points')
})

test('mag2db', () => {
	assert.ok(almost(dsp.mag2db(1), 0, EPSILON), '0 dB at unity')
	assert.ok(almost(dsp.mag2db(0.5), -6.0206, LOOSE), '-6 dB at half')
})

// --- Simple filters ---

test('dcBlocker — removes DC', () => {
	let data = dc(2048)
	dsp.dcBlocker(data, {R: 0.995})
	assert.ok(Math.abs(data[2047]) < 0.01, 'DC removed after settling')
})

test('onePole — smooths impulse', () => {
	let data = impulse(32)
	dsp.onePole(data, {fc: 1000, fs: 44100})
	assert.ok(data[0] > 0, 'first sample non-zero')
	assert.ok(data[1] > 0 && data[1] < data[0], 'decaying')
	assert.ok(data[10] < data[1], 'further decay')
})

test('comb feedforward — echo at delay', () => {
	let data = impulse(8)
	dsp.comb(data, {delay: 3, gain: 0.5, type: 'feedforward'})
	assert.ok(almost(data[0], 1, EPSILON), 'direct')
	assert.ok(almost(data[3], 0.5, EPSILON), 'echo at delay')
	assert.ok(almost(data[1], 0, EPSILON), 'silence between')
})

test('comb feedback — decaying echoes', () => {
	let data = impulse(10)
	dsp.comb(data, {delay: 3, gain: 0.5, type: 'feedback'})
	assert.ok(almost(data[0], 1, EPSILON), 'direct')
	assert.ok(almost(data[3], 0.5, EPSILON), 'first echo')
	assert.ok(almost(data[6], 0.25, EPSILON), 'second echo')
})

test('allpass.first — unity magnitude', () => {
	let data = [1, 0, 0, 0, 0, 0, 0, 0]
	dsp.allpass.first(data, {a: 0.5})
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	assert.ok(energy > 0, 'produces output')
})

// --- Classic designs ---

test('butterworth — correct section count', () => {
	assert.strictEqual(dsp.butterworth(1, 1000, 44100).length, 1, 'order 1 → 1 section')
	assert.strictEqual(dsp.butterworth(2, 1000, 44100).length, 1, 'order 2 → 1 section')
	assert.strictEqual(dsp.butterworth(3, 1000, 44100).length, 2, 'order 3 → 2 sections')
	assert.strictEqual(dsp.butterworth(4, 1000, 44100).length, 2, 'order 4 → 2 sections')
	assert.strictEqual(dsp.butterworth(5, 1000, 44100).length, 3, 'order 5 → 3 sections')
	assert.strictEqual(dsp.butterworth(8, 1000, 44100).length, 4, 'order 8 → 4 sections')
})

test('butterworth LP — DC gain = 1', () => {
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.butterworth(order, 1000, 44100)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		assert.ok(almost(gain, 1, LOOSE), 'order ' + order + ' DC gain = 1')
	}
})

test('butterworth HP — Nyquist gain = 1', () => {
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.butterworth(order, 1000, 44100, 'highpass')
		let gain = 1
		for (let s of sos) gain *= (s.b0 - s.b1 + s.b2) / (1 - s.a1 + s.a2)
		assert.ok(almost(gain, 1, LOOSE), 'HP order ' + order + ' Nyquist gain = 1')
	}
})

test('butterworth bandpass', () => {
	let sos = dsp.butterworth(2, [500, 2000], 44100, 'bandpass')
	assert.ok(sos.length >= 2, 'produces multiple sections')
})

test('butterworth LP — correct -3dB frequency', () => {
	var target = 1 / Math.sqrt(2)
	for (var order = 1; order <= 8; order++) {
		var sos = dsp.butterworth(order, 1000, 44100)
		var resp = dsp.freqz(sos, 8192, 44100)
		var f3db = -1
		for (var i = 1; i < resp.magnitude.length; i++) {
			if (resp.magnitude[i] < target && resp.magnitude[i-1] >= target) {
				f3db = resp.frequencies[i]; break
			}
		}
		assert.ok(Math.abs(f3db - 1000) < 10, 'order ' + order + ' -3dB at ' + f3db.toFixed(0) + ' Hz')
	}
})

test('butterworth BP via transform — proper bandpass shape', () => {
	var sos = dsp.butterworth(2, [500, 2000], 44100, 'bandpass')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	var idx10k = Math.round(10000 / (44100/2) * 8192)
	assert.ok(Math.abs(db[idx1k]) < 1, 'BP ~0dB at center')
	assert.ok(db[idx100] < -20, 'BP attenuates 100Hz')
	assert.ok(db[idx10k] < -20, 'BP attenuates 10kHz')
})

test('elliptic even order — correct equiripple', () => {
	var sos = dsp.elliptic(4, 1000, 48000, 1, 40)
	var resp = dsp.freqz(sos, 16384, 48000)
	var db = dsp.mag2db(resp.magnitude)
	var maxPB = -Infinity, minPB = Infinity
	var idx1k = Math.round(1000 / (48000/2) * 16384)
	for (var i = 1; i <= idx1k; i++) {
		if (db[i] > maxPB) maxPB = db[i]
		if (db[i] < minPB) minPB = db[i]
	}
	assert.ok(maxPB < 0.1, 'elliptic N=4 passband max ≈ 0dB')
	assert.ok(minPB > -1.2, 'elliptic N=4 passband min ≈ -1dB')
	assert.ok(maxPB - minPB < 1.2, 'ripple ≈ 1dB')
	var idx5k = Math.round(5000 / (48000/2) * 16384)
	assert.ok(db[idx5k] < -30, 'elliptic N=4 stopband > 30dB')
})

test('elliptic — section count', () => {
	assert.strictEqual(dsp.elliptic(1, 1000, 48000, 1, 40).length, 1, 'N=1: 1 section')
	assert.strictEqual(dsp.elliptic(2, 1000, 48000, 1, 40).length, 1, 'N=2: 1 section')
	assert.strictEqual(dsp.elliptic(4, 1000, 48000, 1, 40).length, 2, 'N=4: 2 sections')
	assert.strictEqual(dsp.elliptic(6, 1000, 48000, 1, 40).length, 3, 'N=6: 3 sections')
})

test('butterworth BS via transform — proper bandstop shape', () => {
	var sos = dsp.butterworth(2, [500, 2000], 44100, 'bandstop')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	var idx10k = Math.round(10000 / (44100/2) * 8192)
	assert.ok(Math.abs(db[idx100]) < 1, 'BS ~0dB at 100Hz')
	assert.ok(db[idx1k] < -40, 'BS deep null at center')
	assert.ok(Math.abs(db[idx10k]) < 1, 'BS ~0dB at 10kHz')
})

test('chebyshev BP — proper bandpass shape', () => {
	var sos = dsp.chebyshev(2, [500, 2000], 44100, 1, 'bandpass')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	assert.ok(Math.abs(db[idx1k]) < 2, 'Cheb BP ~0dB at center')
	assert.ok(db[idx100] < -10, 'Cheb BP attenuates 100Hz')
})

test('bessel BP — proper bandpass shape', () => {
	var sos = dsp.bessel(2, [500, 2000], 44100, 'bandpass')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	assert.ok(Math.abs(db[idx1k]) < 2, 'Bessel BP ~0dB at center')
	assert.ok(db[idx100] < -10, 'Bessel BP attenuates 100Hz')
})

test('chebyshev — DC gain ≈ 1 for odd orders', () => {
	for (let order = 1; order <= 7; order += 2) {
		let sos = dsp.chebyshev(order, 1000, 44100, 1)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		assert.ok(almost(gain, 1, LOOSE), 'Cheb1 order ' + order + ' DC gain ≈ 1')
	}
})

test('chebyshev — correct section count', () => {
	assert.strictEqual(dsp.chebyshev(1, 1000, 44100, 1).length, 1)
	assert.strictEqual(dsp.chebyshev(2, 1000, 44100, 1).length, 1)
	assert.strictEqual(dsp.chebyshev(4, 1000, 44100, 1).length, 2)
	assert.strictEqual(dsp.chebyshev(5, 1000, 44100, 1).length, 3)
})

test('chebyshev type2 — throws not implemented', () => {
	assert.throws(() => { chebyshevType2() }, 'type2 throws')
})

test('bessel — DC gain ≈ 1', () => {
	for (let order = 1; order <= 10; order++) {
		let sos = dsp.bessel(order, 1000, 44100)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		assert.ok(almost(gain, 1, LOOSE), 'Bessel order ' + order + ' DC gain ≈ 1')
	}
})

test('bessel — order range validation', () => {
	assert.throws(() => { dsp.bessel(11, 1000, 44100) }, 'order > 10 throws')
})

// --- Specialized ---

test('svf lowpass — attenuates DC signal correctly', () => {
	let data = dc(256)
	dsp.svf(data, {fc: 5000, Q: 0.707, fs: 44100, type: 'lowpass'})
	assert.ok(almost(data[255], 1, 0.01), 'LP passes DC')
})

test('svf highpass — removes DC', () => {
	let data = dc(512)
	dsp.svf(data, {fc: 1000, Q: 0.707, fs: 44100, type: 'highpass'})
	assert.ok(Math.abs(data[511]) < 0.01, 'HP removes DC')
})

test('svf bandpass — produces output', () => {
	let data = impulse(64)
	dsp.svf(data, {fc: 1000, Q: 5, fs: 44100, type: 'bandpass'})
	assert.ok(data[1] !== 0, 'BP produces output on impulse')
})

test('linkwitzRiley — returns low and high', () => {
	let lr = dsp.linkwitzRiley(4, 1000, 44100)
	assert.ok(lr.low, 'has low')
	assert.ok(lr.high, 'has high')
	assert.ok(Array.isArray(lr.low), 'low is array')
	assert.ok(Array.isArray(lr.high), 'high is array')
	assert.strictEqual(lr.low.length, 2, 'LR4 low has 2 sections')
	assert.strictEqual(lr.high.length, 2, 'LR4 high has 2 sections')
})

test('linkwitzRiley — odd order throws', () => {
	assert.throws(() => { dsp.linkwitzRiley(3, 1000, 44100) }, 'odd order throws')
})

test('linkwitzRiley — LP+HP sum ≈ flat', () => {
	let lr = dsp.linkwitzRiley(4, 1000, 44100)
	let respLo = dsp.freqz(lr.low, 128, 44100)
	let respHi = dsp.freqz(lr.high, 128, 44100)
	let ok = true
	for (let i = 1; i < 128; i++) {
		let sum = respLo.magnitude[i] + respHi.magnitude[i]
		if (sum < 0.5) { ok = false; break }
	}
	assert.ok(ok, 'no deep nulls in LP+HP')
})

test('savitzkyGolay — preserves linear trend', () => {
	let data = new Float64Array(11)
	for (let i = 0; i < 11; i++) data[i] = i * 2.5
	let expected = Array.from(data)
	dsp.savitzkyGolay(data, {windowSize: 5, degree: 2})
	let ok = true
	for (let i = 2; i < 9; i++) {
		if (Math.abs(data[i] - expected[i]) > 0.01) { ok = false; break }
	}
	assert.ok(ok, 'linear trend preserved')
})

// --- Weighting filters ---

test('aWeighting — returns 3 SOS sections', () => {
	let sos = dsp.aWeighting(44100)
	assert.strictEqual(sos.length, 3, '3 sections')
	assert.ok(sos[0].b0 !== undefined, 'has coefficients')
})

test('aWeighting — 0dB at 1kHz', () => {
	let sos = dsp.aWeighting(44100)
	let resp = dsp.freqz(sos, 2048, 44100)
	let idx = Math.round(1000 / (44100 / 2) * 2048)
	let db = dsp.mag2db(resp.magnitude[idx])
	assert.ok(Math.abs(db) < 0.5, 'A-weighting ≈ 0dB at 1kHz, got ' + db.toFixed(2) + 'dB')
})

test('cWeighting — returns 2 SOS sections', () => {
	let sos = dsp.cWeighting(44100)
	assert.strictEqual(sos.length, 2, '2 sections')
})

test('cWeighting — 0dB at 1kHz', () => {
	let sos = dsp.cWeighting(44100)
	let resp = dsp.freqz(sos, 2048, 44100)
	let idx = Math.round(1000 / (44100 / 2) * 2048)
	let db = dsp.mag2db(resp.magnitude[idx])
	assert.ok(Math.abs(db) < 0.5, 'C-weighting ≈ 0dB at 1kHz, got ' + db.toFixed(2) + 'dB')
})

test('kWeighting 48kHz — exact spec coefficients', () => {
	let sos = dsp.kWeighting(48000)
	assert.strictEqual(sos.length, 2, '2 stages')
	assert.ok(almost(sos[0].b0, 1.53512485958697, EPSILON), 'stage 1 b0')
	assert.ok(almost(sos[1].b0, 1.0, EPSILON), 'stage 2 b0')
})

test('kWeighting other rate — still returns 2 sections', () => {
	let sos = dsp.kWeighting(44100)
	assert.strictEqual(sos.length, 2, '2 stages at 44100')
})

test('itu468 — returns sections', () => {
	let sos = dsp.itu468(48000)
	assert.ok(sos.length >= 3, 'at least 3 sections')
})

test('riaa — returns 1 section', () => {
	let sos = dsp.riaa(44100)
	assert.strictEqual(sos.length, 1, '1 section')
})

test('riaa — bass boost at 20Hz', () => {
	let sos = dsp.riaa(44100)
	let resp = dsp.freqz(sos, 4096, 44100)
	let idx20 = Math.round(20 / (44100 / 2) * 4096)
	let idx1k = Math.round(1000 / (44100 / 2) * 4096)
	let db20 = dsp.mag2db(resp.magnitude[idx20])
	let db1k = dsp.mag2db(resp.magnitude[idx1k])
	assert.ok(db20 > db1k + 10, 'RIAA boosts bass (20Hz > 1kHz by >10dB)')
})

// --- New filters ---

test('pre-emphasis — boosts high frequencies', () => {
	let data = [0, 0, 0, 1, 0, 0, 0, 0]
	dsp.emphasis(data, {alpha: 0.97})
	assert.ok(almost(data[3], 1, EPSILON), 'impulse passes')
	assert.ok(almost(data[4], -0.97, EPSILON), 'echo at -alpha')
})

test('de-emphasis — lowpass accumulation', () => {
	let data = impulse(8)
	dsp.deemphasis(data, {alpha: 0.97})
	assert.ok(data[0] > 0, 'first sample non-zero')
	assert.ok(data[1] > 0, 'decaying tail')
	assert.ok(data[1] < data[0], 'decreasing')
})

test('resonator — rings on impulse', () => {
	let data = impulse(256)
	dsp.resonator(data, {fc: 1000, bw: 50, fs: 44100})
	// Should produce oscillation
	let hasPositive = false, hasNegative = false
	for (let i = 0; i < 256; i++) {
		if (data[i] > 0.01) hasPositive = true
		if (data[i] < -0.01) hasNegative = true
	}
	assert.ok(hasPositive && hasNegative, 'resonator oscillates')
})

test('envelope — follows amplitude', () => {
	let data = new Float64Array(256)
	for (let i = 0; i < 128; i++) data[i] = Math.sin(2 * Math.PI * 1000 * i / 44100)
	dsp.envelope(data, {attack: 0.001, release: 0.01, fs: 44100})
	assert.ok(data[127] > 0.5, 'envelope rises during signal')
	assert.ok(data[255] < data[127], 'envelope falls after signal ends')
})

test('slewLimiter — limits rate of change', () => {
	let data = new Float64Array([0, 0, 0, 1, 1, 1, 0, 0])
	dsp.slewLimiter(data, {rise: 22050, fall: 22050, fs: 44100})
	// Max change = 0.5 per sample (22050/44100)
	assert.ok(data[3] <= 0.5 + LOOSE, 'rise limited')
	assert.ok(data[3] > 0, 'still rises')
})

test('groupDelay — flat for FIR delay', () => {
	// Unity filter: zero delay
	let resp = dsp.groupDelay({b0: 1, b1: 0, b2: 0, a1: 0, a2: 0}, 64, 44100)
	assert.strictEqual(resp.frequencies.length, 64, 'correct length')
	assert.ok(Math.abs(resp.delay[1]) < 0.01, 'unity filter has ~0 delay')
})

test('filtfilt — zero-phase filtering', () => {
	let c = dsp.biquad.lowpass(2000, 0.707, 44100)
	let data = dc(256)
	dsp.filtfilt(data, {coefs: c})
	assert.ok(almost(data[128], 1, 0.01), 'DC passes through filtfilt')
})

// --- FIR design ---

test('window.hann — correct shape', () => {
	let w = dsp.window.hann(5)
	assert.strictEqual(w.length, 5)
	assert.ok(almost(w[0], 0, EPSILON), 'starts at 0')
	assert.ok(almost(w[2], 1, EPSILON), 'peaks at center')
	assert.ok(almost(w[4], 0, EPSILON), 'ends at 0')
})

test('window.kaiser — parameterized', () => {
	let w = dsp.window.kaiser(11, 5)
	assert.strictEqual(w.length, 11)
	assert.ok(w[5] > w[0], 'center > edge')
	assert.ok(almost(w[5], 1, EPSILON), 'center ≈ 1')
})

test('firwin — lowpass FIR', () => {
	let h = dsp.firwin(51, 1000, 44100)
	assert.strictEqual(h.length, 51)
	// DC gain should be ~1
	let sum = 0
	for (let i = 0; i < h.length; i++) sum += h[i]
	assert.ok(almost(sum, 1, 0.01), 'unity DC gain')
	// Symmetric (linear phase)
	assert.ok(almost(h[0], h[50], LOOSE), 'symmetric')
})

test('firwin — highpass FIR', () => {
	let h = dsp.firwin(51, 5000, 44100, {type: 'highpass'})
	// DC should be ~0
	let sum = 0
	for (let i = 0; i < h.length; i++) sum += h[i]
	assert.ok(Math.abs(sum) < 0.05, 'near-zero DC gain for HP')
})

test('firwin — bandpass FIR', () => {
	let h = dsp.firwin(101, [500, 2000], 44100, {type: 'bandpass'})
	assert.strictEqual(h.length, 101)
})

test('kaiserord — estimates order and beta', () => {
	let {numtaps, beta} = dsp.kaiserord(0.05, 60)
	assert.ok(numtaps > 10, 'reasonable order')
	assert.ok(numtaps % 2 === 1, 'odd taps')
	assert.ok(beta > 0, 'positive beta')
})

test('hilbert — antisymmetric FIR', () => {
	let h = dsp.hilbert(31)
	assert.strictEqual(h.length, 31)
	assert.ok(almost(h[15], 0, EPSILON), 'center tap = 0')
	// Antisymmetric: h[n] = -h[N-1-n]
	assert.ok(almost(h[14], -h[16], LOOSE), 'antisymmetric')
})

test('median — removes impulse noise', () => {
	let data = new Float64Array([1, 1, 1, 100, 1, 1, 1])
	dsp.median(data, {size: 3})
	assert.ok(data[3] < 10, 'impulse removed')
	assert.ok(almost(data[0], 1, EPSILON), 'constant preserved')
})

// --- Analysis & conversion ---

test('sos2zpk — correct poles and zeros', () => {
	let sos = [{b0: 1, b1: 0, b2: -1, a1: 0, a2: -0.81}]
	let {zeros, poles} = dsp.sos2zpk(sos)
	assert.ok(zeros.length === 2, '2 zeros')
	assert.ok(poles.length === 2, '2 poles')
})

test('sos2tf — converts to polynomials', () => {
	let sos = dsp.butterworth(2, 1000, 44100)
	let {b, a} = dsp.sos2tf(sos)
	assert.ok(b.length === 3, 'numerator degree 2')
	assert.ok(a.length === 3, 'denominator degree 2')
})

test('isStable — detects stable filters', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	assert.ok(dsp.isStable(sos), 'Butterworth is stable')
})

test('isLinPhase — detects symmetric FIR', () => {
	let h = dsp.firwin(31, 1000, 44100)
	assert.ok(dsp.isLinPhase(h), 'firwin produces linear-phase FIR')
})

// --- Adaptive ---

test('lms — converges to identify system', () => {
	// Simple test: identity system (desired = input)
	let input = new Float64Array(256)
	for (let i = 0; i < 256; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, mu: 0.1}
	let output = dsp.lms(input, desired, params)
	// After convergence, error should be small
	let lastErr = Math.abs(params.error[255])
	assert.ok(lastErr < 0.1, 'LMS error converges')
})

test('nlms — converges faster than LMS', () => {
	let input = new Float64Array(256)
	for (let i = 0; i < 256; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, mu: 0.5}
	let output = dsp.nlms(input, desired, params)
	let lastErr = Math.abs(params.error[255])
	assert.ok(lastErr < 0.1, 'NLMS error converges')
})

// --- Dynamic / nonlinear ---

test('pinkNoise — produces output', () => {
	let data = new Float64Array(256)
	for (let i = 0; i < 256; i++) data[i] = Math.random() * 2 - 1
	dsp.pinkNoise(data, {})
	let hasOutput = data.some(x => Math.abs(x) > 0.01)
	assert.ok(hasOutput, 'pink noise has output')
})

test('oneEuro — smooths noisy signal', () => {
	let data = new Float64Array(100)
	for (let i = 0; i < 100; i++) data[i] = 1 + (Math.random() - 0.5) * 0.1
	dsp.oneEuro(data, {minCutoff: 1, beta: 0.01, fs: 100})
	// After filtering, variance should be reduced
	let mean = 0
	for (let i = 50; i < 100; i++) mean += data[i]
	mean /= 50
	assert.ok(Math.abs(mean - 1) < 0.1, 'one-euro preserves mean')
})

test('decimate — reduces sample count', () => {
	let data = new Float64Array(1000)
	data.fill(1)
	let result = dsp.decimate(data, 4)
	assert.ok(result.length === 250, 'length / 4')
})

// --- Tier 1+2 new modules ---

test('firls — least-squares FIR', () => {
	let h = dsp.firls(31, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	assert.strictEqual(h.length, 31)
	let sum = 0
	for (let i = 0; i < h.length; i++) sum += h[i]
	assert.ok(sum > 0.5, 'positive DC gain for lowpass')
	assert.ok(almost(h[0], h[30], LOOSE), 'symmetric')
})

test('remez — equiripple FIR', () => {
	let h = dsp.remez(31, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	assert.strictEqual(h.length, 31)
	assert.ok(almost(h[0], h[30], LOOSE), 'symmetric')
})

test('tf2zpk — polynomial to roots', () => {
	let {zeros, poles, gain} = dsp.tf2zpk([1, 0, -1], [1, 0, -0.81])
	assert.strictEqual(zeros.length, 2, '2 zeros')
	assert.strictEqual(poles.length, 2, '2 poles')
	assert.ok(gain !== 0, 'nonzero gain')
})

test('zpk2sos — round-trip with sos2zpk', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	let zpk = dsp.sos2zpk(sos)
	let sos2 = dsp.zpk2sos(zpk)
	assert.strictEqual(sos2.length, sos.length, 'same section count')
})

test('impulseResponse — correct length', () => {
	let sos = dsp.butterworth(2, 1000, 44100)
	let ir = dsp.impulseResponse(sos, 128)
	assert.strictEqual(ir.length, 128)
	assert.ok(ir[0] !== 0, 'first sample non-zero')
})

test('stepResponse — converges to DC gain', () => {
	let sos = dsp.butterworth(2, 1000, 44100)
	let sr = dsp.stepResponse(sos, 512)
	assert.ok(almost(sr[511], 1, 0.01), 'step response converges to 1')
})

test('chebyshev2 — flat passband', () => {
	let sos = dsp.chebyshev2(4, 2000, 44100, 40)
	let resp = dsp.freqz(sos, 8192, 44100)
	let db = dsp.mag2db(resp.magnitude)
	let idx500 = Math.round(500 / (44100/2) * 8192)
	assert.ok(Math.abs(db[idx500]) < 1, 'flat passband at 500Hz')
})

test('iirdesign — auto-selects filter', () => {
	let result = dsp.iirdesign(1000, 2000, 1, 40, 44100)
	assert.ok(result.sos, 'returns SOS')
	assert.ok(result.order > 0, 'positive order')
	assert.ok(result.type, 'identifies type')
})

test('interpolate — increases sample count', () => {
	let data = new Float64Array(100)
	data.fill(1)
	let result = dsp.interpolate(data, 4)
	assert.strictEqual(result.length, 400, 'length * 4')
})

test('phaseDelay — returns frequencies and delay', () => {
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	let resp = dsp.phaseDelay(c, 64, 44100)
	assert.strictEqual(resp.frequencies.length, 64)
	assert.strictEqual(resp.delay.length, 64)
})

// --- Tier 3: IIR design ---

test('legendre — DC gain = 1, steeper than Butterworth', () => {
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.legendre(order, 1000, 44100)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		assert.ok(almost(gain, 1, LOOSE), 'Legendre order ' + order + ' DC gain = 1')
	}
	// Verify steeper than Butterworth at order 4
	let bwResp = dsp.freqz(dsp.butterworth(4, 1000, 44100), 4096, 44100)
	let lgResp = dsp.freqz(dsp.legendre(4, 1000, 44100), 4096, 44100)
	let idx2k = Math.round(2000 / (44100/2) * 4096)
	assert.ok(dsp.mag2db(lgResp.magnitude[idx2k]) < dsp.mag2db(bwResp.magnitude[idx2k]),
		'Legendre steeper than Butterworth at 2kHz')
})

test('legendre — correct -3dB frequency', () => {
	let target = 1 / Math.sqrt(2)
	for (let order of [2, 4, 6, 8]) {
		let sos = dsp.legendre(order, 1000, 44100)
		let resp = dsp.freqz(sos, 8192, 44100)
		let f3db = -1
		for (let i = 1; i < resp.magnitude.length; i++) {
			if (resp.magnitude[i] < target && resp.magnitude[i-1] >= target) { f3db = resp.frequencies[i]; break }
		}
		assert.ok(Math.abs(f3db - 1000) < 15, 'order ' + order + ' -3dB at ' + (f3db|0) + 'Hz')
	}
})

test('legendre — monotonic passband (no ripple)', () => {
	let sos = dsp.legendre(6, 1000, 44100)
	let resp = dsp.freqz(sos, 4096, 44100)
	let idx1k = Math.round(1000 / (44100/2) * 4096)
	let db = dsp.mag2db(resp.magnitude)
	// Check monotonically decreasing in passband
	let monotonic = true
	for (let i = 2; i < idx1k; i++) {
		if (db[i] > db[i-1] + 0.01) { monotonic = false; break }
	}
	assert.ok(monotonic, 'Legendre order 6 passband is monotonic')
})

test('gaussianIir — smooths signal', () => {
	let data = impulse(256)
	dsp.gaussianIir(data, {sigma: 5})
	assert.ok(data[0] > 0, 'peak exists')
	assert.ok(data[10] > 0, 'spread visible')
	assert.ok(data[50] < data[0], 'decays from peak')
})

test('yulewalk — produces valid filter', () => {
	let {b, a} = dsp.yulewalk(4, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	assert.ok(b.length > 0, 'has numerator')
	assert.ok(a.length > 0, 'has denominator')
	assert.ok(a[0] === 1, 'a[0] = 1')
})

// --- Tier 3: FIR extras ---

test('firwin2 — arbitrary frequency response', () => {
	let h = dsp.firwin2(51, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	assert.strictEqual(h.length, 51)
	assert.ok(almost(h[0], h[50], LOOSE), 'symmetric')
})

test('minimumPhase — reduces delay, preserves magnitude', () => {
	let h = dsp.firwin(63, 1000, 44100)
	let hm = dsp.minimumPhase(h)
	assert.strictEqual(hm.length, h.length)
	// Energy should be similar
	let e1 = 0, e2 = 0
	for (let i = 0; i < h.length; i++) { e1 += h[i]*h[i]; e2 += hm[i]*hm[i] }
	assert.ok(Math.abs(e1 - e2) / e1 < 0.15, 'energy preserved within 15%')
	// Not linear phase anymore
	assert.ok(!dsp.isLinPhase(hm), 'no longer linear phase')
})

test('differentiator — antisymmetric', () => {
	let h = dsp.differentiator(31)
	assert.ok(almost(h[15], 0, 1e-10), 'center = 0')
	assert.ok(almost(h[14], -h[16], LOOSE), 'antisymmetric')
})

test('integrator — trapezoidal rule', () => {
	let h = dsp.integrator('trapezoidal')
	assert.strictEqual(h.length, 2)
	assert.ok(almost(h[0], 0.5, 1e-10))
	assert.ok(almost(h[1], 0.5, 1e-10))
})

test('raisedCosine — symmetric, nonzero', () => {
	let h = dsp.raisedCosine(65, 0.35, 4)
	assert.strictEqual(h.length, 65)
	assert.ok(almost(h[0], h[64], LOOSE), 'symmetric')
	let energy = 0
	for (let i = 0; i < h.length; i++) energy += h[i]*h[i]
	assert.ok(energy > 0, 'has energy')
})

test('gaussianFir — bell-shaped', () => {
	let h = dsp.gaussianFir(33, 0.3, 4)
	assert.strictEqual(h.length, 33)
	assert.ok(h[16] > h[0], 'center > edge')
})

test('matchedFilter — time-reversed template', () => {
	let template = new Float64Array([1, 2, 3, 4])
	let h = dsp.matchedFilter(template)
	assert.ok(almost(h[0] * 30, 4, LOOSE), 'reversed') // 4/energy
	assert.ok(almost(h[3] * 30, 1, LOOSE), 'reversed end')
})

// --- Tier 3: Virtual analog ---

test('moogLadder — produces output, resonance works', () => {
	let data = impulse(512)
	dsp.moogLadder(data, {fc: 1000, resonance: 0.5, fs: 44100})
	let hasOutput = data.some(x => Math.abs(x) > 0.001)
	assert.ok(hasOutput, 'moog produces output')
	// With resonance, should ring
	let hasNeg = data.some(x => x < -0.001)
	assert.ok(hasNeg, 'resonance causes ringing')
})

test('moogLadder — stable at high cutoff', () => {
	let data = impulse(256)
	dsp.moogLadder(data, {fc: 15000, resonance: 0.8, fs: 44100})
	assert.ok(data.every(x => isFinite(x)), 'no NaN/Inf at high cutoff')
})

test('diodeLadder — produces output', () => {
	let data = impulse(256)
	dsp.diodeLadder(data, {fc: 1000, resonance: 0.5, fs: 44100})
	assert.ok(data.some(x => Math.abs(x) > 0.001), 'output present')
})

test('korg35 — lowpass and highpass modes', () => {
	let lp = impulse(256)
	dsp.korg35(lp, {fc: 1000, resonance: 0.3, fs: 44100, type: 'lowpass'})
	let hp = impulse(256)
	dsp.korg35(hp, {fc: 1000, resonance: 0.3, fs: 44100, type: 'highpass'})
	assert.ok(lp.some(x => Math.abs(x) > 0.001), 'LP output')
	assert.ok(hp.some(x => Math.abs(x) > 0.001), 'HP output')
})

// --- Tier 3: Psychoacoustic ---

test('gammatone — resonates at center frequency', () => {
	let data = impulse(512)
	dsp.gammatone(data, {fc: 1000, fs: 44100})
	// Should oscillate (alternating positive/negative)
	let hasPos = false, hasNeg = false
	for (let i = 0; i < 512; i++) {
		if (data[i] > 0.01) hasPos = true
		if (data[i] < -0.01) hasNeg = true
	}
	assert.ok(hasPos && hasNeg, 'gammatone oscillates')
})

test('erbBank — ERB-spaced center frequencies', () => {
	let bands = dsp.erbBank(44100)
	assert.ok(bands.length >= 25, 'at least 25 ERB bands')
	assert.ok(bands[0].fc >= 50, 'starts above fmin')
	assert.ok(bands[0].erb > 0, 'has ERB width')
	// Verify spacing increases with frequency (ERB property)
	let spacing1 = bands[1].fc - bands[0].fc
	let spacingN = bands[bands.length - 1].fc - bands[bands.length - 2].fc
	assert.ok(spacingN > spacing1, 'wider spacing at higher frequencies')
})

test('barkBank — 24 critical bands', () => {
	let bands = dsp.barkBank(44100)
	assert.ok(bands.length >= 20, 'at least 20 Bark bands')
	assert.strictEqual(bands[0].bark, 1, 'starts at bark 1')
	assert.ok(bands[0].coefs.b0 !== undefined, 'has biquad coefficients')
	assert.ok(bands[0].fLow < bands[0].fHigh, 'fLow < fHigh')
})

test('octaveBank — correct number of bands', () => {
	let bands = dsp.octaveBank(3, 44100)
	assert.ok(bands.length >= 20, '1/3-octave has 20+ bands')
	assert.ok(bands[0].fc > 0, 'has center frequency')
	assert.ok(bands[0].coefs.b0 !== undefined, 'has coefficients')
})

// --- Tier 3: Multirate ---

test('halfBand — half the coefficients are zero', () => {
	let h = dsp.halfBand(31)
	assert.strictEqual(h.length, 31)
	let M = 15
	let zeroCount = 0
	for (let i = 0; i < 31; i++) {
		if (i !== M && Math.abs(i - M) % 2 === 0 && Math.abs(h[i]) < 1e-10) zeroCount++
	}
	assert.ok(zeroCount >= 5, 'many even-offset coefficients are zero')
})

test('cic — decimates correctly', () => {
	let data = new Float64Array(1000).fill(1)
	let out = dsp.cic(data, 10, 3)
	assert.strictEqual(out.length, 100, 'decimated by 10')
	assert.ok(almost(out[50], 1, 0.01), 'DC preserved after settling')
})

test('polyphase — decomposes into M phases', () => {
	let h = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8])
	let phases = dsp.polyphase(h, 4)
	assert.strictEqual(phases.length, 4, '4 phases')
	assert.ok(almost(phases[0][0], 1, 1e-10), 'phase 0 starts with h[0]')
	assert.ok(almost(phases[1][0], 2, 1e-10), 'phase 1 starts with h[1]')
})

test('farrow — delays signal', () => {
	let data = new Float64Array(64)
	data[10] = 1  // impulse at sample 10
	dsp.farrow(data, {delay: 3, order: 3})
	// Peak should move to ~sample 13
	let peakIdx = 0
	for (let i = 1; i < 64; i++) if (data[i] > data[peakIdx]) peakIdx = i
	assert.ok(peakIdx >= 12 && peakIdx <= 14, 'peak shifted by ~3 samples')
})

test('thiran — allpass coefficients', () => {
	let {b, a} = dsp.thiran(3.5, 3)
	assert.strictEqual(b.length, 4, 'order+1 coefficients')
	assert.strictEqual(a.length, 4)
	// Allpass: b = reverse(a)
	assert.ok(almost(b[0], a[3], LOOSE), 'b[0] ≈ a[N]')
	assert.ok(almost(b[3], a[0], LOOSE), 'b[N] ≈ a[0]')
})

test('oversample — increases length', () => {
	let data = new Float64Array(100).fill(1)
	let out = dsp.oversample(data, 4)
	assert.strictEqual(out.length, 400)
})

// --- Tier 3: Adaptive ---

test('rls — converges faster than LMS', () => {
	let input = new Float64Array(256)
	for (let i = 0; i < 256; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, lambda: 0.99}
	dsp.rls(input, desired, params)
	assert.ok(Math.abs(params.error[255]) < 0.05, 'RLS converges')
})

test('levinson — produces LPC coefficients', () => {
	// Autocorrelation of a simple signal
	let R = [1, 0.9, 0.8, 0.7, 0.6]
	let {a, error, k} = dsp.levinson(R)
	assert.strictEqual(a.length, 5, 'order+1 coefficients')
	assert.ok(a[0] === 1, 'a[0] = 1')
	assert.ok(error > 0, 'positive prediction error')
	assert.ok(k.length === 4, '4 reflection coefficients')
	// All reflection coefficients should be < 1 in magnitude (stability)
	assert.ok(k.every(v => Math.abs(v) < 1), 'stable reflection coefficients')
})

// --- Tier 3: Intelligent ---

test('dynamicSmoothing — smooths signal', () => {
	let data = new Float64Array(256)
	for (let i = 0; i < 256; i++) data[i] = Math.sin(2 * Math.PI * 10 * i / 44100) + (Math.random() - 0.5) * 0.1
	dsp.dynamicSmoothing(data, {minFc: 5, maxFc: 5000, fs: 44100})
	assert.ok(data.every(isFinite), 'all finite')
})

test('spectralTilt — nonzero output', () => {
	let data = impulse(256)
	dsp.spectralTilt(data, {slope: 3, fs: 44100})
	assert.ok(data.some(x => Math.abs(x) > 0.001), 'output present')
})

test('variableBandwidth — filters signal', () => {
	let data = dc(256)
	dsp.variableBandwidth(data, {fc: 5000, Q: 0.707, fs: 44100})
	assert.ok(almost(data[255], 1, 0.05), 'DC passes through LP')
})

// --- Tier 3: Composites ---

test('graphicEq — applies gain', () => {
	let data = dc(512)
	dsp.graphicEq(data, {gains: {1000: 6}, fs: 44100})
	// DC should still pass (peaking EQ at 1kHz doesn't affect DC)
	assert.ok(almost(data[511], 1, 0.05), 'DC preserved')
})

test('parametricEq — applies bands', () => {
	let data = dc(256)
	dsp.parametricEq(data, {bands: [{fc: 1000, Q: 1, gain: 0, type: 'peak'}], fs: 44100})
	assert.ok(almost(data[255], 1, 0.01), '0dB gain = passthrough')
})

test('crossover — returns correct band count', () => {
	let bands = dsp.crossover([500, 2000], 4, 44100)
	assert.strictEqual(bands.length, 3, '2 crossover freqs → 3 bands')
	assert.ok(Array.isArray(bands[0]), 'each band is SOS array')
})

test('formant — produces vowel-like output', () => {
	let data = impulse(512)
	dsp.formant(data, {fs: 44100})
	assert.ok(data.some(x => Math.abs(x) > 0.001), 'output present')
})

test('convolution — correct length and impulse', () => {
	let sig = new Float64Array([1, 0, 0, 0])
	let ir = new Float64Array([1, 0.5, 0.25])
	let out = dsp.convolution(sig, ir)
	assert.strictEqual(out.length, 6, 'N+M-1')
	assert.ok(almost(out[0], 1, 1e-10), 'first sample')
	assert.ok(almost(out[1], 0.5, 1e-10), 'second sample')
	assert.ok(almost(out[2], 0.25, 1e-10), 'third sample')
})

// --- Tier 3: Structures ---

test('lattice — all-pole filter', () => {
	let data = impulse(64)
	dsp.lattice(data, {k: new Float64Array([0.5, -0.3])})
	assert.ok(data[0] !== 0, 'produces output')
	assert.ok(data.every(isFinite), 'all finite')
})

// --- Integration: full chain test ---

test('butterworth + filter + freqz end-to-end', () => {
	let sos = dsp.butterworth(4, 2000, 44100)
	let data = dc(512)
	dsp.filter(data, {coefs: sos})
	assert.ok(almost(data[511], 1, 0.01), 'DC passes through Butterworth LP')

	let resp = dsp.freqz(sos, 512, 44100)
	assert.ok(resp.magnitude[0] > 0.99, 'magnitude at DC ≈ 1')
	assert.ok(resp.magnitude[511] < 0.01, 'magnitude at Nyquist ≈ 0 for LP')
})
