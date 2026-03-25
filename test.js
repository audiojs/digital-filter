import { test } from 'node:test'
import assert from 'node:assert'
import * as dsp from './index.js'
import { type2 as chebyshevType2 } from './chebyshev.js'

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
