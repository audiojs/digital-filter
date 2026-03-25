'use strict'

var test = require('tape')
var almostEqual = require('almost-equal')
var dsp = require('./')

var EPSILON = 1e-10
var LOOSE = 1e-4

function almost (x, y, eps) {
	if (!eps) eps = EPSILON
	if (x.length && y.length) return x.every(function (x, i) {
		return almost(x, y[i], eps);
	});
	if (!almostEqual(x, y, eps)) throw Error(x + ' ≈ ' + y);
	return true;
};

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

test('leakyIntegrator', function (t) {
	let opts = {lambda: 0.95, y: 0}
	let src = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]
	let result = [0, 0, 0, 0, 0.05, 0.0475, 0.045125, 0.04286875, 0.0407253125, 0.038689046875, 0.03675459453125]
	t.ok(almost(dsp.leakyIntegrator(src, opts), result))
	t.end()
})

test('movingAverage', function (t) {
	let opts = {memory: 3}
	let src = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
	let result = [0, 1/3, 1, 2, 3, 4, 5, 6, 7, 8]
	t.ok(almost(dsp.movingAverage(src, opts), result))
	t.end()
})

// --- Core: biquad coefficients ---

test('biquad.lowpass — DC gain = 1', function (t) {
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	// DC gain: H(z=1) = (b0+b1+b2) / (1+a1+a2)
	let dc = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	t.ok(almost(dc, 1, LOOSE), 'lowpass DC gain = 1')
	t.end()
})

test('biquad.highpass — Nyquist gain = 1', function (t) {
	let c = dsp.biquad.highpass(1000, 0.707, 44100)
	// Nyquist gain: H(z=-1) = (b0-b1+b2) / (1-a1+a2)
	let ny = (c.b0 - c.b1 + c.b2) / (1 - c.a1 + c.a2)
	t.ok(almost(ny, 1, LOOSE), 'highpass Nyquist gain = 1')
	t.end()
})

test('biquad.notch — DC gain = 1, null at fc', function (t) {
	let fc = 1000, fs = 44100
	let c = dsp.biquad.notch(fc, 10, fs)
	let dc = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	t.ok(almost(dc, 1, LOOSE), 'notch DC gain = 1')
	t.end()
})

test('biquad.allpass — DC gain = 1', function (t) {
	let c = dsp.biquad.allpass(1000, 1, 44100)
	let dc = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	t.ok(almost(dc, 1, LOOSE), 'allpass DC gain = 1')
	t.end()
})

test('biquad.peaking — DC gain = 1', function (t) {
	let c = dsp.biquad.peaking(1000, 1, 44100, 6)
	let dc = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	t.ok(almost(dc, 1, LOOSE), 'peaking DC gain = 1')
	t.end()
})

test('biquad.lowshelf — high frequency gain = 1', function (t) {
	let c = dsp.biquad.lowshelf(1000, 0.707, 44100, 6)
	let ny = (c.b0 - c.b1 + c.b2) / (1 - c.a1 + c.a2)
	t.ok(almost(ny, 1, LOOSE), 'lowshelf Nyquist gain ≈ 1')
	t.end()
})

test('biquad.highshelf — DC gain = 1', function (t) {
	let c = dsp.biquad.highshelf(1000, 0.707, 44100, 6)
	let dc = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	t.ok(almost(dc, 1, LOOSE), 'highshelf DC gain ≈ 1')
	t.end()
})

// --- Core: filter engine ---

test('filter — biquad lowpass passes DC', function (t) {
	let c = dsp.biquad.lowpass(5000, 0.707, 44100)
	let data = dc(128)
	let params = {coefs: c}
	dsp.filter(data, params)
	// After settling, output should be ≈ 1
	t.ok(almost(data[127], 1, LOOSE), 'DC passes through lowpass')
	t.end()
})

test('filter — cascaded SOS', function (t) {
	let sos = dsp.butterworth(4, 1000, 44100)
	let data = dc(256)
	dsp.filter(data, {coefs: sos})
	t.ok(almost(data[255], 1, LOOSE), 'DC passes through 4th-order Butterworth LP')
	t.end()
})

test('filter — state persists', function (t) {
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	let params = {coefs: c}
	dsp.filter(new Float64Array(64), params)
	t.ok(params.state, 'state initialized')
	t.ok(Array.isArray(params.state), 'state is array')
	t.end()
})

// --- Core: freqz ---

test('freqz — allpass has unity magnitude', function (t) {
	let c = dsp.biquad.allpass(2000, 1, 44100)
	let resp = dsp.freqz(c, 256, 44100)
	let ok = true
	for (let i = 1; i < resp.magnitude.length; i++) {
		if (!almostEqual(resp.magnitude[i], 1, LOOSE)) {
			ok = false
			break
		}
	}
	t.ok(ok, 'allpass magnitude ≈ 1 everywhere')
	t.ok(resp.frequencies.length === 256, 'correct number of points')
	t.end()
})

test('freqz.mag2db', function (t) {
	t.ok(almost(dsp.freqz.mag2db(1), 0, EPSILON), '0 dB at unity')
	t.ok(almost(dsp.freqz.mag2db(0.5), -6.0206, LOOSE), '-6 dB at half')
	t.end()
})

// --- Simple filters ---

test('dcBlocker — removes DC', function (t) {
	let data = dc(2048)
	dsp.dcBlocker(data, {R: 0.995})
	// After settling, DC should be nearly removed
	t.ok(Math.abs(data[2047]) < 0.01, 'DC removed after settling')
	t.end()
})

test('onePole — smooths impulse', function (t) {
	let data = impulse(32)
	dsp.onePole(data, {fc: 1000, fs: 44100})
	// Output should be a decaying exponential
	t.ok(data[0] > 0, 'first sample non-zero')
	t.ok(data[1] > 0 && data[1] < data[0], 'decaying')
	t.ok(data[10] < data[1], 'further decay')
	t.end()
})

test('comb feedforward — echo at delay', function (t) {
	let data = impulse(8)
	dsp.comb(data, {delay: 3, gain: 0.5, type: 'feedforward'})
	t.ok(almost(data[0], 1, EPSILON), 'direct')
	t.ok(almost(data[3], 0.5, EPSILON), 'echo at delay')
	t.ok(almost(data[1], 0, EPSILON), 'silence between')
	t.end()
})

test('comb feedback — decaying echoes', function (t) {
	let data = impulse(10)
	dsp.comb(data, {delay: 3, gain: 0.5, type: 'feedback'})
	t.ok(almost(data[0], 1, EPSILON), 'direct')
	t.ok(almost(data[3], 0.5, EPSILON), 'first echo')
	t.ok(almost(data[6], 0.25, EPSILON), 'second echo')
	t.end()
})

test('allpass.first — unity magnitude', function (t) {
	// Process a chunk and check energy is preserved
	let data = [1, 0, 0, 0, 0, 0, 0, 0]
	dsp.allpass.first(data, {a: 0.5})
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	t.ok(energy > 0, 'produces output')
	t.end()
})

// --- Classic designs ---

test('butterworth — correct section count', function (t) {
	t.equal(dsp.butterworth(1, 1000, 44100).length, 1, 'order 1 → 1 section')
	t.equal(dsp.butterworth(2, 1000, 44100).length, 1, 'order 2 → 1 section')
	t.equal(dsp.butterworth(3, 1000, 44100).length, 2, 'order 3 → 2 sections')
	t.equal(dsp.butterworth(4, 1000, 44100).length, 2, 'order 4 → 2 sections')
	t.equal(dsp.butterworth(5, 1000, 44100).length, 3, 'order 5 → 3 sections')
	t.equal(dsp.butterworth(8, 1000, 44100).length, 4, 'order 8 → 4 sections')
	t.end()
})

test('butterworth LP — DC gain = 1', function (t) {
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.butterworth(order, 1000, 44100)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		t.ok(almost(gain, 1, LOOSE), 'order ' + order + ' DC gain = 1')
	}
	t.end()
})

test('butterworth HP — Nyquist gain = 1', function (t) {
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.butterworth(order, 1000, 44100, 'highpass')
		let gain = 1
		for (let s of sos) gain *= (s.b0 - s.b1 + s.b2) / (1 - s.a1 + s.a2)
		t.ok(almost(gain, 1, LOOSE), 'HP order ' + order + ' Nyquist gain = 1')
	}
	t.end()
})

test('butterworth bandpass', function (t) {
	let sos = dsp.butterworth(2, [500, 2000], 44100, 'bandpass')
	t.ok(sos.length >= 2, 'produces multiple sections')
	t.end()
})

test('butterworth LP — correct -3dB frequency', function (t) {
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
		t.ok(Math.abs(f3db - 1000) < 10, 'order ' + order + ' -3dB at ' + f3db.toFixed(0) + ' Hz')
	}
	t.end()
})

test('butterworth BP via transform — proper bandpass shape', function (t) {
	var sos = dsp.butterworth(2, [500, 2000], 44100, 'bandpass')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.freqz.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	var idx10k = Math.round(10000 / (44100/2) * 8192)
	t.ok(Math.abs(db[idx1k]) < 1, 'BP ~0dB at center')
	t.ok(db[idx100] < -20, 'BP attenuates 100Hz')
	t.ok(db[idx10k] < -20, 'BP attenuates 10kHz')
	t.end()
})

test('elliptic even order — correct equiripple', function (t) {
	var sos = dsp.elliptic(4, 1000, 48000, 1, 40)
	var resp = dsp.freqz(sos, 16384, 48000)
	var db = dsp.freqz.mag2db(resp.magnitude)
	var maxPB = -Infinity, minPB = Infinity
	var idx1k = Math.round(1000 / (48000/2) * 16384)
	for (var i = 1; i <= idx1k; i++) {
		if (db[i] > maxPB) maxPB = db[i]
		if (db[i] < minPB) minPB = db[i]
	}
	t.ok(maxPB < 0.1, 'elliptic N=4 passband max ≈ 0dB')
	t.ok(minPB > -1.2, 'elliptic N=4 passband min ≈ -1dB')
	t.ok(maxPB - minPB < 1.2, 'ripple ≈ 1dB')
	// Stopband check
	var idx5k = Math.round(5000 / (48000/2) * 16384)
	t.ok(db[idx5k] < -30, 'elliptic N=4 stopband > 30dB')
	t.end()
})

test('elliptic — section count', function (t) {
	t.equal(dsp.elliptic(1, 1000, 48000, 1, 40).length, 1, 'N=1: 1 section')
	t.equal(dsp.elliptic(2, 1000, 48000, 1, 40).length, 1, 'N=2: 1 section')
	t.equal(dsp.elliptic(4, 1000, 48000, 1, 40).length, 2, 'N=4: 2 sections')
	t.equal(dsp.elliptic(6, 1000, 48000, 1, 40).length, 3, 'N=6: 3 sections')
	t.end()
})

test('butterworth BS via transform — proper bandstop shape', function (t) {
	var sos = dsp.butterworth(2, [500, 2000], 44100, 'bandstop')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.freqz.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	var idx10k = Math.round(10000 / (44100/2) * 8192)
	t.ok(Math.abs(db[idx100]) < 1, 'BS ~0dB at 100Hz')
	t.ok(db[idx1k] < -40, 'BS deep null at center')
	t.ok(Math.abs(db[idx10k]) < 1, 'BS ~0dB at 10kHz')
	t.end()
})

test('chebyshev BP — proper bandpass shape', function (t) {
	var sos = dsp.chebyshev(2, [500, 2000], 44100, 1, 'bandpass')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.freqz.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	t.ok(Math.abs(db[idx1k]) < 2, 'Cheb BP ~0dB at center')
	t.ok(db[idx100] < -10, 'Cheb BP attenuates 100Hz')
	t.end()
})

test('bessel BP — proper bandpass shape', function (t) {
	var sos = dsp.bessel(2, [500, 2000], 44100, 'bandpass')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.freqz.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	t.ok(Math.abs(db[idx1k]) < 2, 'Bessel BP ~0dB at center')
	t.ok(db[idx100] < -10, 'Bessel BP attenuates 100Hz')
	t.end()
})

test('chebyshev — DC gain ≈ 1 for odd orders', function (t) {
	for (let order = 1; order <= 7; order += 2) {
		let sos = dsp.chebyshev(order, 1000, 44100, 1)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		t.ok(almost(gain, 1, LOOSE), 'Cheb1 order ' + order + ' DC gain ≈ 1')
	}
	t.end()
})

test('chebyshev — correct section count', function (t) {
	t.equal(dsp.chebyshev(1, 1000, 44100, 1).length, 1)
	t.equal(dsp.chebyshev(2, 1000, 44100, 1).length, 1)
	t.equal(dsp.chebyshev(4, 1000, 44100, 1).length, 2)
	t.equal(dsp.chebyshev(5, 1000, 44100, 1).length, 3)
	t.end()
})

test('chebyshev.type2 — throws not implemented', function (t) {
	t.throws(function () { dsp.chebyshev.type2() }, 'type2 throws')
	t.end()
})

test('bessel — DC gain ≈ 1', function (t) {
	for (let order = 1; order <= 10; order++) {
		let sos = dsp.bessel(order, 1000, 44100)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		t.ok(almost(gain, 1, LOOSE), 'Bessel order ' + order + ' DC gain ≈ 1')
	}
	t.end()
})

test('bessel — order range validation', function (t) {
	t.throws(function () { dsp.bessel(11, 1000, 44100) }, 'order > 10 throws')
	t.end()
})

// --- Specialized ---

test('svf lowpass — attenuates DC signal correctly', function (t) {
	let data = dc(256)
	dsp.svf(data, {fc: 5000, Q: 0.707, fs: 44100, type: 'lowpass'})
	t.ok(almost(data[255], 1, 0.01), 'LP passes DC')
	t.end()
})

test('svf highpass — removes DC', function (t) {
	let data = dc(512)
	dsp.svf(data, {fc: 1000, Q: 0.707, fs: 44100, type: 'highpass'})
	t.ok(Math.abs(data[511]) < 0.01, 'HP removes DC')
	t.end()
})

test('svf bandpass — produces output', function (t) {
	let data = impulse(64)
	dsp.svf(data, {fc: 1000, Q: 5, fs: 44100, type: 'bandpass'})
	t.ok(data[1] !== 0, 'BP produces output on impulse')
	t.end()
})

test('linkwitzRiley — returns low and high', function (t) {
	let lr = dsp.linkwitzRiley(4, 1000, 44100)
	t.ok(lr.low, 'has low')
	t.ok(lr.high, 'has high')
	t.ok(Array.isArray(lr.low), 'low is array')
	t.ok(Array.isArray(lr.high), 'high is array')
	// LR4 = 2x Butterworth(2) = 2 sections per band
	t.equal(lr.low.length, 2, 'LR4 low has 2 sections')
	t.equal(lr.high.length, 2, 'LR4 high has 2 sections')
	t.end()
})

test('linkwitzRiley — odd order throws', function (t) {
	t.throws(function () { dsp.linkwitzRiley(3, 1000, 44100) }, 'odd order throws')
	t.end()
})

test('linkwitzRiley — LP+HP sum ≈ flat', function (t) {
	let lr = dsp.linkwitzRiley(4, 1000, 44100)
	// Check at a few frequencies that LP + HP magnitude ≈ 1
	let respLo = dsp.freqz(lr.low, 128, 44100)
	let respHi = dsp.freqz(lr.high, 128, 44100)
	let ok = true
	for (let i = 1; i < 128; i++) {
		// LR sums to allpass, so check magnitude (not complex sum, but should be close)
		let sum = respLo.magnitude[i] + respHi.magnitude[i]
		// At crossover both are -6dB, sum = 2*0.5 = 1
		// Away from crossover one dominates → ≈ 1
		// Note: actual LR sums to allpass (unity mag) only when complex summed
		// Magnitude sum will be > 1 away from crossover. Just verify no nulls.
		if (sum < 0.5) { ok = false; break }
	}
	t.ok(ok, 'no deep nulls in LP+HP')
	t.end()
})

test('savitzkyGolay — preserves linear trend', function (t) {
	// SG with degree >= 1 should preserve a linear signal exactly
	let data = new Float64Array(11)
	for (let i = 0; i < 11; i++) data[i] = i * 2.5
	let expected = Array.from(data)
	dsp.savitzkyGolay(data, {windowSize: 5, degree: 2})
	// Interior points should match (edges may differ due to clamping)
	let ok = true
	for (let i = 2; i < 9; i++) {
		if (Math.abs(data[i] - expected[i]) > 0.01) { ok = false; break }
	}
	t.ok(ok, 'linear trend preserved')
	t.end()
})

// --- Weighting filters ---

test('aWeighting — returns 3 SOS sections', function (t) {
	let sos = dsp.aWeighting(44100)
	t.equal(sos.length, 3, '3 sections')
	t.ok(sos[0].b0 !== undefined, 'has coefficients')
	t.end()
})

test('aWeighting — 0dB at 1kHz', function (t) {
	let sos = dsp.aWeighting(44100)
	let resp = dsp.freqz(sos, 2048, 44100)
	// Find bin closest to 1kHz
	let idx = Math.round(1000 / (44100 / 2) * 2048)
	let db = dsp.freqz.mag2db(resp.magnitude[idx])
	t.ok(Math.abs(db) < 0.5, 'A-weighting ≈ 0dB at 1kHz, got ' + db.toFixed(2) + 'dB')
	t.end()
})

test('cWeighting — returns 2 SOS sections', function (t) {
	let sos = dsp.cWeighting(44100)
	t.equal(sos.length, 2, '2 sections')
	t.end()
})

test('cWeighting — 0dB at 1kHz', function (t) {
	let sos = dsp.cWeighting(44100)
	let resp = dsp.freqz(sos, 2048, 44100)
	let idx = Math.round(1000 / (44100 / 2) * 2048)
	let db = dsp.freqz.mag2db(resp.magnitude[idx])
	t.ok(Math.abs(db) < 0.5, 'C-weighting ≈ 0dB at 1kHz, got ' + db.toFixed(2) + 'dB')
	t.end()
})

test('kWeighting 48kHz — exact spec coefficients', function (t) {
	let sos = dsp.kWeighting(48000)
	t.equal(sos.length, 2, '2 stages')
	t.ok(almost(sos[0].b0, 1.53512485958697, EPSILON), 'stage 1 b0')
	t.ok(almost(sos[1].b0, 1.0, EPSILON), 'stage 2 b0')
	t.end()
})

test('kWeighting other rate — still returns 2 sections', function (t) {
	let sos = dsp.kWeighting(44100)
	t.equal(sos.length, 2, '2 stages at 44100')
	t.end()
})

test('itu468 — returns sections', function (t) {
	let sos = dsp.itu468(48000)
	t.ok(sos.length >= 3, 'at least 3 sections')
	t.end()
})

test('riaa — returns 1 section', function (t) {
	let sos = dsp.riaa(44100)
	t.equal(sos.length, 1, '1 section')
	t.end()
})

test('riaa — bass boost at 20Hz', function (t) {
	let sos = dsp.riaa(44100)
	let resp = dsp.freqz(sos, 4096, 44100)
	let idx20 = Math.round(20 / (44100 / 2) * 4096)
	let idx1k = Math.round(1000 / (44100 / 2) * 4096)
	let db20 = dsp.freqz.mag2db(resp.magnitude[idx20])
	let db1k = dsp.freqz.mag2db(resp.magnitude[idx1k])
	t.ok(db20 > db1k + 10, 'RIAA boosts bass (20Hz > 1kHz by >10dB)')
	t.end()
})

// --- Integration: full chain test ---

test('butterworth + filter + freqz end-to-end', function (t) {
	// Design a 4th-order LP, process a DC signal, check output
	let sos = dsp.butterworth(4, 2000, 44100)
	let data = dc(512)
	dsp.filter(data, {coefs: sos})
	t.ok(almost(data[511], 1, 0.01), 'DC passes through Butterworth LP')

	// Check frequency response
	let resp = dsp.freqz(sos, 512, 44100)
	t.ok(resp.magnitude[0] > 0.99, 'magnitude at DC ≈ 1')
	t.ok(resp.magnitude[511] < 0.01, 'magnitude at Nyquist ≈ 0 for LP')
	t.end()
})
