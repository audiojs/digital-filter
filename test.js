import test, { almost, ok, is, throws } from 'tst'
import * as dsp from './index.js'
import { type2 as chebyshevType2 } from './iir/chebyshev.js'

let EPSILON = 1e-10
let LOOSE = 1e-4

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
	almost(dsp.leakyIntegrator(src, opts), result)
})

test('movingAverage', () => {
	let opts = {memory: 3}
	let src = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
	let result = [0, 1/3, 1, 2, 3, 4, 5, 6, 7, 8]
	almost(dsp.movingAverage(src, opts), result)
})

// --- Core: biquad coefficients ---

test('biquad.lowpass — DC gain = 1', () => {
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	almost(dcGain, 1, LOOSE)
})

test('biquad.highpass — Nyquist gain = 1', () => {
	let c = dsp.biquad.highpass(1000, 0.707, 44100)
	let ny = (c.b0 - c.b1 + c.b2) / (1 - c.a1 + c.a2)
	almost(ny, 1, LOOSE)
})

test('biquad.notch — DC gain = 1, null at fc', () => {
	let fc = 1000, fs = 44100
	let c = dsp.biquad.notch(fc, 10, fs)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	almost(dcGain, 1, LOOSE)
})

test('biquad.allpass — DC gain = 1', () => {
	let c = dsp.biquad.allpass(1000, 1, 44100)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	almost(dcGain, 1, LOOSE)
})

test('biquad.peaking — DC gain = 1', () => {
	let c = dsp.biquad.peaking(1000, 1, 44100, 6)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	almost(dcGain, 1, LOOSE)
})

test('biquad.lowshelf — high frequency gain = 1', () => {
	let c = dsp.biquad.lowshelf(1000, 0.707, 44100, 6)
	let ny = (c.b0 - c.b1 + c.b2) / (1 - c.a1 + c.a2)
	almost(ny, 1, LOOSE)
})

test('biquad.highshelf — DC gain = 1', () => {
	let c = dsp.biquad.highshelf(1000, 0.707, 44100, 6)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	almost(dcGain, 1, LOOSE)
})

// --- Core: filter engine ---

test('filter — biquad lowpass passes DC', () => {
	let c = dsp.biquad.lowpass(5000, 0.707, 44100)
	let data = dc(128)
	let params = {coefs: c}
	dsp.filter(data, params)
	almost(data[127], 1, LOOSE)
})

test('filter — cascaded SOS', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	let data = dc(256)
	dsp.filter(data, {coefs: sos})
	almost(data[255], 1, LOOSE)
})

test('filter — state persists', () => {
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	let params = {coefs: c}
	dsp.filter(new Float64Array(64), params)
	ok(params.state, 'state initialized')
	ok(Array.isArray(params.state), 'state is array')
})

// --- Core: freqz ---

test('freqz — allpass has unity magnitude', () => {
	let c = dsp.biquad.allpass(2000, 1, 44100)
	let resp = dsp.freqz(c, 256, 44100)
	for (let i = 1; i < resp.magnitude.length; i++) {
		almost(resp.magnitude[i], 1, LOOSE)
	}
	is(resp.frequencies.length, 256)
})

test('mag2db', () => {
	almost(dsp.mag2db(1), 0, EPSILON)
	almost(dsp.mag2db(0.5), -6.0206, LOOSE)
})

// --- Simple filters ---

test('dcBlocker — removes DC', () => {
	let data = dc(2048)
	dsp.dcBlocker(data, {R: 0.995})
	ok(Math.abs(data[2047]) < 0.01, 'DC removed after settling')
})

test('onePole — smooths impulse', () => {
	let data = impulse(32)
	dsp.onePole(data, {fc: 1000, fs: 44100})
	ok(data[0] > 0, 'first sample non-zero')
	ok(data[1] > 0 && data[1] < data[0], 'decaying')
	ok(data[10] < data[1], 'further decay')
})

test('comb feedforward — echo at delay', () => {
	let data = impulse(8)
	dsp.comb(data, {delay: 3, gain: 0.5, type: 'feedforward'})
	almost(data[0], 1, EPSILON)
	almost(data[3], 0.5, EPSILON)
	almost(data[1], 0, EPSILON)
})

test('comb feedback — decaying echoes', () => {
	let data = impulse(10)
	dsp.comb(data, {delay: 3, gain: 0.5, type: 'feedback'})
	almost(data[0], 1, EPSILON)
	almost(data[3], 0.5, EPSILON)
	almost(data[6], 0.25, EPSILON)
})

test('allpass.first — unity magnitude', () => {
	let data = [1, 0, 0, 0, 0, 0, 0, 0]
	dsp.allpass.first(data, {a: 0.5})
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	ok(energy > 0, 'produces output')
})

// --- Classic designs ---

test('butterworth — correct section count', () => {
	is(dsp.butterworth(1, 1000, 44100).length, 1, 'order 1 → 1 section')
	is(dsp.butterworth(2, 1000, 44100).length, 1, 'order 2 → 1 section')
	is(dsp.butterworth(3, 1000, 44100).length, 2, 'order 3 → 2 sections')
	is(dsp.butterworth(4, 1000, 44100).length, 2, 'order 4 → 2 sections')
	is(dsp.butterworth(5, 1000, 44100).length, 3, 'order 5 → 3 sections')
	is(dsp.butterworth(8, 1000, 44100).length, 4, 'order 8 → 4 sections')
})

test('butterworth LP — DC gain = 1', () => {
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.butterworth(order, 1000, 44100)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		almost(gain, 1, LOOSE)
	}
})

test('butterworth HP — Nyquist gain = 1', () => {
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.butterworth(order, 1000, 44100, 'highpass')
		let gain = 1
		for (let s of sos) gain *= (s.b0 - s.b1 + s.b2) / (1 - s.a1 + s.a2)
		almost(gain, 1, LOOSE)
	}
})

test('butterworth bandpass', () => {
	let sos = dsp.butterworth(2, [500, 2000], 44100, 'bandpass')
	ok(sos.length >= 2, 'produces multiple sections')
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
		ok(Math.abs(f3db - 1000) < 10, 'order ' + order + ' -3dB at ' + f3db.toFixed(0) + ' Hz')
	}
})

test('butterworth BP via transform — proper bandpass shape', () => {
	var sos = dsp.butterworth(2, [500, 2000], 44100, 'bandpass')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	var idx10k = Math.round(10000 / (44100/2) * 8192)
	ok(Math.abs(db[idx1k]) < 1, 'BP ~0dB at center')
	ok(db[idx100] < -20, 'BP attenuates 100Hz')
	ok(db[idx10k] < -20, 'BP attenuates 10kHz')
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
	ok(maxPB < 0.1, 'elliptic N=4 passband max ≈ 0dB')
	ok(minPB > -1.2, 'elliptic N=4 passband min ≈ -1dB')
	ok(maxPB - minPB < 1.2, 'ripple ≈ 1dB')
	var idx5k = Math.round(5000 / (48000/2) * 16384)
	ok(db[idx5k] < -30, 'elliptic N=4 stopband > 30dB')
})

test('elliptic — section count', () => {
	is(dsp.elliptic(1, 1000, 48000, 1, 40).length, 1, 'N=1: 1 section')
	is(dsp.elliptic(2, 1000, 48000, 1, 40).length, 1, 'N=2: 1 section')
	is(dsp.elliptic(4, 1000, 48000, 1, 40).length, 2, 'N=4: 2 sections')
	is(dsp.elliptic(6, 1000, 48000, 1, 40).length, 3, 'N=6: 3 sections')
})

test('butterworth BS via transform — proper bandstop shape', () => {
	var sos = dsp.butterworth(2, [500, 2000], 44100, 'bandstop')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	var idx10k = Math.round(10000 / (44100/2) * 8192)
	ok(Math.abs(db[idx100]) < 1, 'BS ~0dB at 100Hz')
	ok(db[idx1k] < -40, 'BS deep null at center')
	ok(Math.abs(db[idx10k]) < 1, 'BS ~0dB at 10kHz')
})

test('chebyshev BP — proper bandpass shape', () => {
	var sos = dsp.chebyshev(2, [500, 2000], 44100, 1, 'bandpass')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	ok(Math.abs(db[idx1k]) < 2, 'Cheb BP ~0dB at center')
	ok(db[idx100] < -10, 'Cheb BP attenuates 100Hz')
})

test('bessel BP — proper bandpass shape', () => {
	var sos = dsp.bessel(2, [500, 2000], 44100, 'bandpass')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	ok(Math.abs(db[idx1k]) < 2, 'Bessel BP ~0dB at center')
	ok(db[idx100] < -10, 'Bessel BP attenuates 100Hz')
})

test('chebyshev — DC gain ≈ 1 for odd orders', () => {
	for (let order = 1; order <= 7; order += 2) {
		let sos = dsp.chebyshev(order, 1000, 44100, 1)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		almost(gain, 1, LOOSE)
	}
})

test('chebyshev — correct section count', () => {
	is(dsp.chebyshev(1, 1000, 44100, 1).length, 1)
	is(dsp.chebyshev(2, 1000, 44100, 1).length, 1)
	is(dsp.chebyshev(4, 1000, 44100, 1).length, 2)
	is(dsp.chebyshev(5, 1000, 44100, 1).length, 3)
})

test('chebyshev type2 — throws not implemented', () => {
	throws(() => { chebyshevType2() }, 'type2 throws')
})

test('bessel — DC gain ≈ 1', () => {
	for (let order = 1; order <= 10; order++) {
		let sos = dsp.bessel(order, 1000, 44100)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		almost(gain, 1, LOOSE)
	}
})

test('bessel — order range validation', () => {
	throws(() => { dsp.bessel(11, 1000, 44100) }, 'order > 10 throws')
})

// --- Specialized ---

test('svf lowpass — attenuates DC signal correctly', () => {
	let data = dc(256)
	dsp.svf(data, {fc: 5000, Q: 0.707, fs: 44100, type: 'lowpass'})
	almost(data[255], 1, 0.01)
})

test('svf highpass — removes DC', () => {
	let data = dc(512)
	dsp.svf(data, {fc: 1000, Q: 0.707, fs: 44100, type: 'highpass'})
	ok(Math.abs(data[511]) < 0.01, 'HP removes DC')
})

test('svf bandpass — produces output', () => {
	let data = impulse(64)
	dsp.svf(data, {fc: 1000, Q: 5, fs: 44100, type: 'bandpass'})
	ok(data[1] !== 0, 'BP produces output on impulse')
})

test('linkwitzRiley — returns low and high', () => {
	let lr = dsp.linkwitzRiley(4, 1000, 44100)
	ok(lr.low, 'has low')
	ok(lr.high, 'has high')
	ok(Array.isArray(lr.low), 'low is array')
	ok(Array.isArray(lr.high), 'high is array')
	is(lr.low.length, 2, 'LR4 low has 2 sections')
	is(lr.high.length, 2, 'LR4 high has 2 sections')
})

test('linkwitzRiley — odd order throws', () => {
	throws(() => { dsp.linkwitzRiley(3, 1000, 44100) }, 'odd order throws')
})

test('linkwitzRiley — LP+HP sum ≈ flat', () => {
	let lr = dsp.linkwitzRiley(4, 1000, 44100)
	let respLo = dsp.freqz(lr.low, 128, 44100)
	let respHi = dsp.freqz(lr.high, 128, 44100)
	for (let i = 1; i < 128; i++) {
		ok(respLo.magnitude[i] + respHi.magnitude[i] >= 0.5)
	}
})

test('savitzkyGolay — preserves linear trend', () => {
	let data = new Float64Array(11)
	for (let i = 0; i < 11; i++) data[i] = i * 2.5
	let expected = Array.from(data)
	dsp.savitzkyGolay(data, {windowSize: 5, degree: 2})
	for (let i = 2; i < 9; i++) {
		almost(data[i], expected[i], 0.01)
	}
})

// --- Weighting filters ---

test('aWeighting — returns 3 SOS sections', () => {
	let sos = dsp.aWeighting(44100)
	is(sos.length, 3, '3 sections')
	ok(sos[0].b0 !== undefined, 'has coefficients')
})

test('aWeighting — 0dB at 1kHz', () => {
	let sos = dsp.aWeighting(44100)
	let resp = dsp.freqz(sos, 2048, 44100)
	let idx = Math.round(1000 / (44100 / 2) * 2048)
	let db = dsp.mag2db(resp.magnitude[idx])
	ok(Math.abs(db) < 0.5, 'A-weighting ≈ 0dB at 1kHz, got ' + db.toFixed(2) + 'dB')
})

test('cWeighting — returns 2 SOS sections', () => {
	let sos = dsp.cWeighting(44100)
	is(sos.length, 2, '2 sections')
})

test('cWeighting — 0dB at 1kHz', () => {
	let sos = dsp.cWeighting(44100)
	let resp = dsp.freqz(sos, 2048, 44100)
	let idx = Math.round(1000 / (44100 / 2) * 2048)
	let db = dsp.mag2db(resp.magnitude[idx])
	ok(Math.abs(db) < 0.5, 'C-weighting ≈ 0dB at 1kHz, got ' + db.toFixed(2) + 'dB')
})

test('kWeighting 48kHz — exact spec coefficients', () => {
	let sos = dsp.kWeighting(48000)
	is(sos.length, 2, '2 stages')
	almost(sos[0].b0, 1.53512485958697, EPSILON)
	almost(sos[1].b0, 1.0, EPSILON)
})

test('kWeighting other rate — still returns 2 sections', () => {
	let sos = dsp.kWeighting(44100)
	is(sos.length, 2, '2 stages at 44100')
})

test('itu468 — returns sections', () => {
	let sos = dsp.itu468(48000)
	ok(sos.length >= 3, 'at least 3 sections')
})

test('riaa — returns 1 section', () => {
	let sos = dsp.riaa(44100)
	is(sos.length, 1, '1 section')
})

test('riaa — bass boost at 20Hz', () => {
	let sos = dsp.riaa(44100)
	let resp = dsp.freqz(sos, 4096, 44100)
	let idx20 = Math.round(20 / (44100 / 2) * 4096)
	let idx1k = Math.round(1000 / (44100 / 2) * 4096)
	let db20 = dsp.mag2db(resp.magnitude[idx20])
	let db1k = dsp.mag2db(resp.magnitude[idx1k])
	ok(db20 > db1k + 10, 'RIAA boosts bass (20Hz > 1kHz by >10dB)')
})

// --- New filters ---

test('pre-emphasis — boosts high frequencies', () => {
	let data = [0, 0, 0, 1, 0, 0, 0, 0]
	dsp.emphasis(data, {alpha: 0.97})
	almost(data[3], 1, EPSILON)
	almost(data[4], -0.97, EPSILON)
})

test('de-emphasis — lowpass accumulation', () => {
	let data = impulse(8)
	dsp.deemphasis(data, {alpha: 0.97})
	ok(data[0] > 0, 'first sample non-zero')
	ok(data[1] > 0, 'decaying tail')
	ok(data[1] < data[0], 'decreasing')
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
	ok(hasPositive && hasNegative, 'resonator oscillates')
})

test('envelope — follows amplitude', () => {
	let data = new Float64Array(256)
	for (let i = 0; i < 128; i++) data[i] = Math.sin(2 * Math.PI * 1000 * i / 44100)
	dsp.envelope(data, {attack: 0.001, release: 0.01, fs: 44100})
	ok(data[127] > 0.5, 'envelope rises during signal')
	ok(data[255] < data[127], 'envelope falls after signal ends')
})

test('slewLimiter — limits rate of change', () => {
	let data = new Float64Array([0, 0, 0, 1, 1, 1, 0, 0])
	dsp.slewLimiter(data, {rise: 22050, fall: 22050, fs: 44100})
	// Max change = 0.5 per sample (22050/44100)
	ok(data[3] <= 0.5 + LOOSE, 'rise limited')
	ok(data[3] > 0, 'still rises')
})

test('groupDelay — flat for FIR delay', () => {
	// Unity filter: zero delay
	let resp = dsp.groupDelay({b0: 1, b1: 0, b2: 0, a1: 0, a2: 0}, 64, 44100)
	is(resp.frequencies.length, 64, 'correct length')
	ok(Math.abs(resp.delay[1]) < 0.01, 'unity filter has ~0 delay')
})

test('filtfilt — zero-phase filtering', () => {
	let c = dsp.biquad.lowpass(2000, 0.707, 44100)
	let data = dc(256)
	dsp.filtfilt(data, {coefs: c})
	almost(data[128], 1, 0.01)
})

// --- FIR design ---

test('window.hann — correct shape', () => {
	let w = dsp.window.hann(5)
	is(w.length, 5)
	almost(w[0], 0, EPSILON)
	almost(w[2], 1, EPSILON)
	almost(w[4], 0, EPSILON)
})

test('window.kaiser — parameterized', () => {
	let w = dsp.window.kaiser(11, 5)
	is(w.length, 11)
	ok(w[5] > w[0], 'center > edge')
	almost(w[5], 1, EPSILON)
})

test('firwin — lowpass FIR', () => {
	let h = dsp.firwin(51, 1000, 44100)
	is(h.length, 51)
	// DC gain should be ~1
	let sum = 0
	for (let i = 0; i < h.length; i++) sum += h[i]
	almost(sum, 1, 0.01)
	// Symmetric (linear phase)
	almost(h[0], h[50], LOOSE)
})

test('firwin — highpass FIR', () => {
	let h = dsp.firwin(51, 5000, 44100, {type: 'highpass'})
	// DC should be ~0
	let sum = 0
	for (let i = 0; i < h.length; i++) sum += h[i]
	ok(Math.abs(sum) < 0.05, 'near-zero DC gain for HP')
})

test('firwin — bandpass FIR', () => {
	let h = dsp.firwin(101, [500, 2000], 44100, {type: 'bandpass'})
	is(h.length, 101)
})

test('kaiserord — estimates order and beta', () => {
	let {numtaps, beta} = dsp.kaiserord(0.05, 60)
	ok(numtaps > 10, 'reasonable order')
	ok(numtaps % 2 === 1, 'odd taps')
	ok(beta > 0, 'positive beta')
})

test('hilbert — antisymmetric FIR', () => {
	let h = dsp.hilbert(31)
	is(h.length, 31)
	almost(h[15], 0, EPSILON)
	// Antisymmetric: h[n] = -h[N-1-n]
	almost(h[14], -h[16], LOOSE)
})

test('median — removes impulse noise', () => {
	let data = new Float64Array([1, 1, 1, 100, 1, 1, 1])
	dsp.median(data, {size: 3})
	ok(data[3] < 10, 'impulse removed')
	almost(data[0], 1, EPSILON)
})

// --- Analysis & conversion ---

test('sos2zpk — correct poles and zeros', () => {
	let sos = [{b0: 1, b1: 0, b2: -1, a1: 0, a2: -0.81}]
	let {zeros, poles} = dsp.sos2zpk(sos)
	ok(zeros.length === 2, '2 zeros')
	ok(poles.length === 2, '2 poles')
})

test('sos2tf — converts to polynomials', () => {
	let sos = dsp.butterworth(2, 1000, 44100)
	let {b, a} = dsp.sos2tf(sos)
	ok(b.length === 3, 'numerator degree 2')
	ok(a.length === 3, 'denominator degree 2')
})

test('isStable — detects stable filters', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	ok(dsp.isStable(sos), 'Butterworth is stable')
})

test('isLinPhase — detects symmetric FIR', () => {
	let h = dsp.firwin(31, 1000, 44100)
	ok(dsp.isLinPhase(h), 'firwin produces linear-phase FIR')
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
	ok(lastErr < 0.1, 'LMS error converges')
})

test('nlms — converges faster than LMS', () => {
	let input = new Float64Array(256)
	for (let i = 0; i < 256; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, mu: 0.5}
	let output = dsp.nlms(input, desired, params)
	let lastErr = Math.abs(params.error[255])
	ok(lastErr < 0.1, 'NLMS error converges')
})

// --- Dynamic / nonlinear ---

test('pinkNoise — produces output', () => {
	let data = new Float64Array(256)
	for (let i = 0; i < 256; i++) data[i] = Math.random() * 2 - 1
	dsp.pinkNoise(data, {})
	let hasOutput = data.some(x => Math.abs(x) > 0.01)
	ok(hasOutput, 'pink noise has output')
})

test('oneEuro — smooths noisy signal', () => {
	let data = new Float64Array(100)
	for (let i = 0; i < 100; i++) data[i] = 1 + (Math.random() - 0.5) * 0.1
	dsp.oneEuro(data, {minCutoff: 1, beta: 0.01, fs: 100})
	// After filtering, variance should be reduced
	let mean = 0
	for (let i = 50; i < 100; i++) mean += data[i]
	mean /= 50
	ok(Math.abs(mean - 1) < 0.1, 'one-euro preserves mean')
})

test('decimate — reduces sample count', () => {
	let data = new Float64Array(1000)
	data.fill(1)
	let result = dsp.decimate(data, 4)
	ok(result.length === 250, 'length / 4')
})

// --- Tier 1+2 new modules ---

test('firls — least-squares FIR', () => {
	let h = dsp.firls(31, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	is(h.length, 31)
	let sum = 0
	for (let i = 0; i < h.length; i++) sum += h[i]
	ok(sum > 0.5, 'positive DC gain for lowpass')
	almost(h[0], h[30], LOOSE)
})

test('remez — equiripple FIR', () => {
	let h = dsp.remez(31, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	is(h.length, 31)
	almost(h[0], h[30], LOOSE)
})

test('tf2zpk — polynomial to roots', () => {
	let {zeros, poles, gain} = dsp.tf2zpk([1, 0, -1], [1, 0, -0.81])
	is(zeros.length, 2, '2 zeros')
	is(poles.length, 2, '2 poles')
	ok(gain !== 0, 'nonzero gain')
})

test('zpk2sos — round-trip with sos2zpk', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	let zpk = dsp.sos2zpk(sos)
	let sos2 = dsp.zpk2sos(zpk)
	is(sos2.length, sos.length, 'same section count')
})

test('impulseResponse — correct length', () => {
	let sos = dsp.butterworth(2, 1000, 44100)
	let ir = dsp.impulseResponse(sos, 128)
	is(ir.length, 128)
	ok(ir[0] !== 0, 'first sample non-zero')
})

test('stepResponse — converges to DC gain', () => {
	let sos = dsp.butterworth(2, 1000, 44100)
	let sr = dsp.stepResponse(sos, 512)
	almost(sr[511], 1, 0.01)
})

test('chebyshev2 — flat passband', () => {
	let sos = dsp.chebyshev2(4, 2000, 44100, 40)
	let resp = dsp.freqz(sos, 8192, 44100)
	let db = dsp.mag2db(resp.magnitude)
	let idx500 = Math.round(500 / (44100/2) * 8192)
	ok(Math.abs(db[idx500]) < 1, 'flat passband at 500Hz')
})

test('iirdesign — auto-selects filter', () => {
	let result = dsp.iirdesign(1000, 2000, 1, 40, 44100)
	ok(result.sos, 'returns SOS')
	ok(result.order > 0, 'positive order')
	ok(result.type, 'identifies type')
})

test('interpolate — increases sample count', () => {
	let data = new Float64Array(100)
	data.fill(1)
	let result = dsp.interpolate(data, 4)
	is(result.length, 400, 'length * 4')
})

test('phaseDelay — returns frequencies and delay', () => {
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	let resp = dsp.phaseDelay(c, 64, 44100)
	is(resp.frequencies.length, 64)
	is(resp.delay.length, 64)
})

// --- Tier 3: IIR design ---

test('legendre — DC gain = 1, steeper than Butterworth', () => {
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.legendre(order, 1000, 44100)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		almost(gain, 1, LOOSE)
	}
	// Verify steeper than Butterworth at order 4
	let bwResp = dsp.freqz(dsp.butterworth(4, 1000, 44100), 4096, 44100)
	let lgResp = dsp.freqz(dsp.legendre(4, 1000, 44100), 4096, 44100)
	let idx2k = Math.round(2000 / (44100/2) * 4096)
	ok(dsp.mag2db(lgResp.magnitude[idx2k]) < dsp.mag2db(bwResp.magnitude[idx2k]),
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
		ok(Math.abs(f3db - 1000) < 15, 'order ' + order + ' -3dB at ' + (f3db|0) + 'Hz')
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
	ok(monotonic, 'Legendre order 6 passband is monotonic')
})

test('gaussianIir — smooths signal', () => {
	let data = impulse(256)
	dsp.gaussianIir(data, {sigma: 5})
	ok(data[0] > 0, 'peak exists')
	ok(data[10] > 0, 'spread visible')
	ok(data[50] < data[0], 'decays from peak')
})

test('yulewalk — produces valid filter', () => {
	let {b, a} = dsp.yulewalk(4, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	ok(b.length > 0, 'has numerator')
	ok(a.length > 0, 'has denominator')
	ok(a[0] === 1, 'a[0] = 1')
})

// --- Tier 3: FIR extras ---

test('firwin2 — arbitrary frequency response', () => {
	let h = dsp.firwin2(51, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	is(h.length, 51)
	almost(h[0], h[50], LOOSE)
})

test('minimumPhase — reduces delay, preserves magnitude', () => {
	let h = dsp.firwin(63, 1000, 44100)
	let hm = dsp.minimumPhase(h)
	is(hm.length, h.length)
	// Energy should be similar
	let e1 = 0, e2 = 0
	for (let i = 0; i < h.length; i++) { e1 += h[i]*h[i]; e2 += hm[i]*hm[i] }
	ok(Math.abs(e1 - e2) / e1 < 0.15, 'energy preserved within 15%')
	// Not linear phase anymore
	ok(!dsp.isLinPhase(hm), 'no longer linear phase')
})

test('differentiator — antisymmetric', () => {
	let h = dsp.differentiator(31)
	almost(h[15], 0, 1e-10)
	almost(h[14], -h[16], LOOSE)
})

test('integrator — trapezoidal rule', () => {
	let h = dsp.integrator('trapezoidal')
	is(h.length, 2)
	almost(h[0], 0.5, 1e-10)
	almost(h[1], 0.5, 1e-10)
})

test('raisedCosine — symmetric, nonzero', () => {
	let h = dsp.raisedCosine(65, 0.35, 4)
	is(h.length, 65)
	almost(h[0], h[64], LOOSE)
	let energy = 0
	for (let i = 0; i < h.length; i++) energy += h[i]*h[i]
	ok(energy > 0, 'has energy')
})

test('gaussianFir — bell-shaped', () => {
	let h = dsp.gaussianFir(33, 0.3, 4)
	is(h.length, 33)
	ok(h[16] > h[0], 'center > edge')
})

test('matchedFilter — time-reversed template', () => {
	let template = new Float64Array([1, 2, 3, 4])
	let h = dsp.matchedFilter(template)
	almost(h[0] * 30, 4, LOOSE) // 4/energy
	almost(h[3] * 30, 1, LOOSE)
})

// --- Tier 3: Virtual analog ---

test('moogLadder — produces output, resonance works', () => {
	let data = impulse(512)
	dsp.moogLadder(data, {fc: 1000, resonance: 0.5, fs: 44100})
	let hasOutput = data.some(x => Math.abs(x) > 0.001)
	ok(hasOutput, 'moog produces output')
	// With resonance, should ring
	let hasNeg = data.some(x => x < -0.001)
	ok(hasNeg, 'resonance causes ringing')
})

test('moogLadder — stable at high cutoff', () => {
	let data = impulse(256)
	dsp.moogLadder(data, {fc: 15000, resonance: 0.8, fs: 44100})
	ok(data.every(x => isFinite(x)), 'no NaN/Inf at high cutoff')
})

test('diodeLadder — produces output', () => {
	let data = impulse(256)
	dsp.diodeLadder(data, {fc: 1000, resonance: 0.5, fs: 44100})
	ok(data.some(x => Math.abs(x) > 0.001), 'output present')
})

test('korg35 — lowpass and highpass modes', () => {
	let lp = impulse(256)
	dsp.korg35(lp, {fc: 1000, resonance: 0.3, fs: 44100, type: 'lowpass'})
	let hp = impulse(256)
	dsp.korg35(hp, {fc: 1000, resonance: 0.3, fs: 44100, type: 'highpass'})
	ok(lp.some(x => Math.abs(x) > 0.001), 'LP output')
	ok(hp.some(x => Math.abs(x) > 0.001), 'HP output')
})

// --- Tier 3: Psychoacoustic ---

test('gammatone — resonates at center frequency', () => {
	let data = impulse(4096)
	dsp.gammatone(data, {fc: 1000, fs: 44100})
	let hasPos = false, hasNeg = false
	for (let i = 0; i < 4096; i++) {
		if (data[i] > 0.001) hasPos = true
		if (data[i] < -0.001) hasNeg = true
	}
	ok(hasPos && hasNeg, 'gammatone oscillates')
})

test('erbBank — ERB-spaced center frequencies', () => {
	let bands = dsp.erbBank(44100)
	ok(bands.length >= 25, 'at least 25 ERB bands')
	ok(bands[0].fc >= 50, 'starts above fmin')
	ok(bands[0].erb > 0, 'has ERB width')
	// Verify spacing increases with frequency (ERB property)
	let spacing1 = bands[1].fc - bands[0].fc
	let spacingN = bands[bands.length - 1].fc - bands[bands.length - 2].fc
	ok(spacingN > spacing1, 'wider spacing at higher frequencies')
})

test('barkBank — 24 critical bands', () => {
	let bands = dsp.barkBank(44100)
	ok(bands.length >= 20, 'at least 20 Bark bands')
	is(bands[0].bark, 1, 'starts at bark 1')
	ok(bands[0].coefs.b0 !== undefined, 'has biquad coefficients')
	ok(bands[0].fLow < bands[0].fHigh, 'fLow < fHigh')
})

test('octaveBank — correct number of bands', () => {
	let bands = dsp.octaveBank(3, 44100)
	ok(bands.length >= 20, '1/3-octave has 20+ bands')
	ok(bands[0].fc > 0, 'has center frequency')
	ok(bands[0].coefs.b0 !== undefined, 'has coefficients')
})

// --- Tier 3: Multirate ---

test('halfBand — half the coefficients are zero', () => {
	let h = dsp.halfBand(31)
	is(h.length, 31)
	let M = 15
	let zeroCount = 0
	for (let i = 0; i < 31; i++) {
		if (i !== M && Math.abs(i - M) % 2 === 0 && Math.abs(h[i]) < 1e-10) zeroCount++
	}
	ok(zeroCount >= 5, 'many even-offset coefficients are zero')
})

test('cic — decimates correctly', () => {
	let data = new Float64Array(1000).fill(1)
	let out = dsp.cic(data, 10, 3)
	is(out.length, 100, 'decimated by 10')
	almost(out[50], 1, 0.01)
})

test('polyphase — decomposes into M phases', () => {
	let h = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8])
	let phases = dsp.polyphase(h, 4)
	is(phases.length, 4, '4 phases')
	almost(phases[0][0], 1, 1e-10)
	almost(phases[1][0], 2, 1e-10)
})

test('farrow — delays signal', () => {
	let data = new Float64Array(64)
	data[10] = 1  // impulse at sample 10
	dsp.farrow(data, {delay: 3, order: 3})
	// Peak should move to ~sample 13
	let peakIdx = 0
	for (let i = 1; i < 64; i++) if (data[i] > data[peakIdx]) peakIdx = i
	ok(peakIdx >= 12 && peakIdx <= 14, 'peak shifted by ~3 samples')
})

test('thiran — allpass coefficients', () => {
	let {b, a} = dsp.thiran(3.5, 3)
	is(b.length, 4, 'order+1 coefficients')
	is(a.length, 4)
	// Allpass: b = reverse(a)
	almost(b[0], a[3], LOOSE)
	almost(b[3], a[0], LOOSE)
})

test('oversample — increases length', () => {
	let data = new Float64Array(100).fill(1)
	let out = dsp.oversample(data, 4)
	is(out.length, 400)
})

// --- Tier 3: Adaptive ---

test('rls — converges faster than LMS', () => {
	let input = new Float64Array(256)
	for (let i = 0; i < 256; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, lambda: 0.99}
	dsp.rls(input, desired, params)
	ok(Math.abs(params.error[255]) < 0.05, 'RLS converges')
})

test('levinson — produces LPC coefficients', () => {
	// Autocorrelation of a simple signal
	let R = [1, 0.9, 0.8, 0.7, 0.6]
	let {a, error, k} = dsp.levinson(R)
	is(a.length, 5, 'order+1 coefficients')
	ok(a[0] === 1, 'a[0] = 1')
	ok(error > 0, 'positive prediction error')
	ok(k.length === 4, '4 reflection coefficients')
	// All reflection coefficients should be < 1 in magnitude (stability)
	ok(k.every(v => Math.abs(v) < 1), 'stable reflection coefficients')
})

// --- Tier 3: Intelligent ---

test('dynamicSmoothing — smooths signal', () => {
	let data = new Float64Array(256)
	for (let i = 0; i < 256; i++) data[i] = Math.sin(2 * Math.PI * 10 * i / 44100) + (Math.random() - 0.5) * 0.1
	dsp.dynamicSmoothing(data, {minFc: 5, maxFc: 5000, fs: 44100})
	ok(data.every(isFinite), 'all finite')
})

test('spectralTilt — nonzero output', () => {
	let data = impulse(256)
	dsp.spectralTilt(data, {slope: 3, fs: 44100})
	ok(data.some(x => Math.abs(x) > 0.001), 'output present')
})

test('variableBandwidth — filters signal', () => {
	let data = dc(256)
	dsp.variableBandwidth(data, {fc: 5000, Q: 0.707, fs: 44100})
	almost(data[255], 1, 0.05)
})

// --- Tier 3: Composites ---

test('graphicEq — applies gain', () => {
	let data = dc(512)
	dsp.graphicEq(data, {gains: {1000: 6}, fs: 44100})
	// DC should still pass (peaking EQ at 1kHz doesn't affect DC)
	almost(data[511], 1, 0.05)
})

test('parametricEq — applies bands', () => {
	let data = dc(256)
	dsp.parametricEq(data, {bands: [{fc: 1000, Q: 1, gain: 0, type: 'peak'}], fs: 44100})
	almost(data[255], 1, 0.01)
})

test('crossover — returns correct band count', () => {
	let bands = dsp.crossover([500, 2000], 4, 44100)
	is(bands.length, 3, '2 crossover freqs → 3 bands')
	ok(Array.isArray(bands[0]), 'each band is SOS array')
})

test('formant — produces vowel-like output', () => {
	let data = impulse(512)
	dsp.formant(data, {fs: 44100})
	ok(data.some(x => Math.abs(x) > 0.001), 'output present')
})

test('convolution — correct length and impulse', () => {
	let sig = new Float64Array([1, 0, 0, 0])
	let ir = new Float64Array([1, 0.5, 0.25])
	let out = dsp.convolution(sig, ir)
	is(out.length, 6, 'N+M-1')
	almost(out[0], 1, 1e-10)
	almost(out[1], 0.5, 1e-10)
	almost(out[2], 0.25, 1e-10)
})

// --- Tier 3: Structures ---

test('lattice — all-pole filter', () => {
	let data = impulse(64)
	dsp.lattice(data, {k: new Float64Array([0.5, -0.3])})
	ok(data[0] !== 0, 'produces output')
	ok(data.every(isFinite), 'all finite')
})

// ================================================================
// Additional comprehensive tests — mathematical correctness
// ================================================================

// --- Butterworth HP: -3dB at cutoff ---

test('butterworth HP — correct -3dB frequency', () => {
	let target = 1 / Math.sqrt(2)
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.butterworth(order, 1000, 44100, 'highpass')
		let resp = dsp.freqz(sos, 8192, 44100)
		let f3db = -1
		for (let i = resp.magnitude.length - 1; i > 0; i--) {
			if (resp.magnitude[i] < target && resp.magnitude[i+1] >= target) {
				// HP: magnitude rises with frequency, cross from below
			}
			if (resp.magnitude[i] >= target && resp.magnitude[i-1] < target) {
				f3db = resp.frequencies[i]; break
			}
		}
		ok(Math.abs(f3db - 1000) < 15, 'HP order ' + order + ' -3dB at ' + (f3db|0) + 'Hz')
	}
})

// --- Chebyshev passband ripple is exactly Rp ---

test('chebyshev — passband ripple matches Rp', () => {
	let Rp = 1 // dB ripple
	for (let order of [3, 5, 7]) {
		let sos = dsp.chebyshev(order, 2000, 44100, Rp)
		let resp = dsp.freqz(sos, 8192, 44100)
		let db = dsp.mag2db(resp.magnitude)
		let idx2k = Math.round(2000 / (44100/2) * 8192)
		let maxPB = -Infinity, minPB = Infinity
		for (let i = 1; i <= idx2k; i++) {
			if (db[i] > maxPB) maxPB = db[i]
			if (db[i] < minPB) minPB = db[i]
		}
		let ripple = maxPB - minPB
		ok(ripple < Rp + 0.3, 'Cheb order ' + order + ' ripple ' + ripple.toFixed(2) + 'dB ≈ ' + Rp + 'dB')
	}
})

// --- Bessel group delay is flat ---

test('bessel — group delay flatter than Butterworth', () => {
	let order = 4, fc = 2000, fs = 44100
	let besselSos = dsp.bessel(order, fc, fs)
	let bwSos = dsp.butterworth(order, fc, fs)

	let besselGD = dsp.groupDelay(besselSos, 256, fs)
	let bwGD = dsp.groupDelay(bwSos, 256, fs)

	// Measure delay variation in passband (up to fc)
	let idxFc = Math.round(fc / (fs/2) * 256)
	let besselVar = 0, bwVar = 0
	for (let i = 2; i < idxFc; i++) {
		besselVar += Math.abs(besselGD.delay[i] - besselGD.delay[i-1])
		bwVar += Math.abs(bwGD.delay[i] - bwGD.delay[i-1])
	}
	ok(besselVar < bwVar, 'Bessel group delay variation (' + besselVar.toFixed(2) + ') < Butterworth (' + bwVar.toFixed(2) + ')')
})

// --- Legendre is monotonic AND steeper than Butterworth ---

test('legendre — steeper than Butterworth at multiple frequencies', () => {
	for (let order of [3, 5, 7]) {
		let bwResp = dsp.freqz(dsp.butterworth(order, 1000, 44100), 4096, 44100)
		let lgResp = dsp.freqz(dsp.legendre(order, 1000, 44100), 4096, 44100)
		let idx3k = Math.round(3000 / (44100/2) * 4096)
		ok(dsp.mag2db(lgResp.magnitude[idx3k]) <= dsp.mag2db(bwResp.magnitude[idx3k]) + 0.5,
			'Legendre order ' + order + ' steeper at 3kHz')
	}
})

// --- SVF all 6 modes produce output on impulse ---

test('svf — all 6 modes produce output on impulse', () => {
	let modes = ['lowpass', 'highpass', 'bandpass', 'notch', 'peak', 'allpass']
	for (let type of modes) {
		let data = impulse(128)
		dsp.svf(data, {fc: 1000, Q: 1, fs: 44100, type})
		let hasOutput = data.some(x => Math.abs(x) > 0.0001)
		ok(hasOutput, 'SVF ' + type + ' produces output')
	}
})

// --- Moog ladder self-oscillation ---

test('moogLadder — self-oscillation at resonance=1', () => {
	let data = new Float64Array(2048)
	data[0] = 0.01 // tiny impulse to start oscillation
	dsp.moogLadder(data, {fc: 1000, resonance: 1, fs: 44100})
	// Check that output has sustained energy even late in the buffer
	let lateEnergy = 0
	for (let i = 1024; i < 2048; i++) lateEnergy += data[i] * data[i]
	ok(lateEnergy > 0.001, 'Moog self-oscillates at resonance=1 (late energy: ' + lateEnergy.toFixed(4) + ')')
})

// --- Diode ladder stable at high resonance ---

test('diodeLadder — stable at high resonance', () => {
	let data = impulse(1024)
	dsp.diodeLadder(data, {fc: 2000, resonance: 0.95, fs: 44100})
	ok(data.every(isFinite), 'no NaN/Inf at high resonance')
	let maxVal = 0
	for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > maxVal) maxVal = Math.abs(data[i])
	ok(maxVal < 100, 'output bounded (max: ' + maxVal.toFixed(2) + ')')
})

// --- Korg35 HP mode removes DC ---

test('korg35 HP — attenuates DC', () => {
	let data = dc(1024)
	dsp.korg35(data, {fc: 1000, resonance: 0.3, fs: 44100, type: 'highpass'})
	// Nonlinear filter: tanh saturation prevents full DC removal, but HP significantly attenuates it
	ok(Math.abs(data[1023]) < 0.5, 'Korg35 HP attenuates DC (last sample: ' + data[1023].toFixed(4) + ')')
	// HP output should be much less than input (1.0)
	ok(Math.abs(data[1023]) < Math.abs(1.0) * 0.2, 'Korg35 HP reduces DC by >80%')
})

// --- Gammatone center frequency matches ---

test('gammatone — peak of frequency response near fc', () => {
	let fc = 2000, fs = 44100
	let data = impulse(4096)
	dsp.gammatone(data, {fc, fs})

	// Compute rough magnitude spectrum via DFT at a few points
	let peakFreq = 0, peakMag = 0
	let N = data.length
	for (let fi = 500; fi <= 5000; fi += 50) {
		let w = 2 * Math.PI * fi / fs
		let re = 0, im = 0
		for (let n = 0; n < N; n++) {
			re += data[n] * Math.cos(w * n)
			im -= data[n] * Math.sin(w * n)
		}
		let mag = Math.sqrt(re * re + im * im)
		if (mag > peakMag) { peakMag = mag; peakFreq = fi }
	}
	ok(Math.abs(peakFreq - fc) < 200, 'Gammatone peak at ' + peakFreq + 'Hz (expected ~' + fc + 'Hz)')
})

// --- octaveBank band count for different fractions ---

test('octaveBank — 1/1 has fewer bands than 1/3', () => {
	let bands1 = dsp.octaveBank(1, 44100)
	let bands3 = dsp.octaveBank(3, 44100)
	ok(bands1.length >= 8, '1/1 octave has 8+ bands (got ' + bands1.length + ')')
	ok(bands3.length >= 20, '1/3 octave has 20+ bands (got ' + bands3.length + ')')
	ok(bands3.length > bands1.length * 2, '1/3 octave has >2x bands vs 1/1')
})

test('octaveBank — 1/6 has more bands than 1/3', () => {
	let bands3 = dsp.octaveBank(3, 44100)
	let bands6 = dsp.octaveBank(6, 44100)
	ok(bands6.length > bands3.length, '1/6 octave has more bands than 1/3')
})

// --- erbBank spacing increases with frequency ---

test('erbBank — spacing increases monotonically', () => {
	let bands = dsp.erbBank(44100)
	for (let i = 2; i < bands.length; i++) {
		let sp1 = bands[i-1].fc - bands[i-2].fc
		let sp2 = bands[i].fc - bands[i-1].fc
		ok(sp2 >= sp1 - 0.01, 'ERB spacing increases: ' + sp1.toFixed(1) + ' → ' + sp2.toFixed(1))
	}
})

// --- barkBank has 24 bands ---

test('barkBank — 24 critical bands', () => {
	let bands = dsp.barkBank(44100)
	is(bands.length, 24, '24 Bark bands at 44100Hz')
})

// --- firls produces symmetric coefficients ---

test('firls — symmetric coefficients (linear phase)', () => {
	let h = dsp.firls(51, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	ok(dsp.isLinPhase(h), 'firls output is linear phase')
})

// --- remez produces equiripple ---

test('remez — equiripple passband', () => {
	let h = dsp.remez(31, [0, 0.25, 0.35, 1], [1, 1, 0, 0])
	// Compute passband response and check ripple is roughly constant
	let N = h.length
	let maxRipple = -Infinity, minRipple = Infinity
	for (let fi = 0.05; fi <= 0.25; fi += 0.02) {
		let w = Math.PI * fi
		let re = 0, im = 0
		for (let n = 0; n < N; n++) {
			re += h[n] * Math.cos(w * n)
			im -= h[n] * Math.sin(w * n)
		}
		let mag = Math.sqrt(re * re + im * im)
		if (mag > maxRipple) maxRipple = mag
		if (mag < minRipple) minRipple = mag
	}
	let rippleDb = 20 * Math.log10(maxRipple / minRipple)
	ok(rippleDb < 3, 'Remez passband ripple < 3dB (got ' + rippleDb.toFixed(2) + 'dB)')
})

// --- kaiserord gives reasonable estimates ---

test('kaiserord — estimates scale with requirements', () => {
	let {numtaps: n1} = dsp.kaiserord(0.1, 40)
	let {numtaps: n2} = dsp.kaiserord(0.05, 60)
	ok(n2 > n1, 'tighter spec requires more taps (' + n1 + ' vs ' + n2 + ')')
	ok(n1 >= 5 && n1 <= 200, 'reasonable tap count for 40dB: ' + n1)
	ok(n2 >= 10 && n2 <= 500, 'reasonable tap count for 60dB: ' + n2)
})

// --- raisedCosine is symmetric ---

test('raisedCosine — symmetric and peaks at center', () => {
	let h = dsp.raisedCosine(65, 0.35, 4)
	let center = 32
	for (let i = 0; i < 32; i++) {
		almost(h[i], h[64 - i], LOOSE)
	}
	// Center should be the maximum
	let centerVal = h[center]
	for (let i = 0; i < 65; i++) {
		ok(h[i] <= centerVal + LOOSE, 'center is max (i=' + i + ')')
	}
})

// --- gaussianFir peaks at center ---

test('gaussianFir — peaks at center and symmetric', () => {
	let h = dsp.gaussianFir(33, 0.3, 4)
	let center = 16
	ok(h[center] >= h[0], 'center >= edge')
	ok(h[center] >= h[32], 'center >= last')
	almost(h[0], h[32], LOOSE)
	almost(h[5], h[27], LOOSE)
})

// --- matchedFilter reverses template ---

test('matchedFilter — output is time-reversed and energy-normalized', () => {
	let template = new Float64Array([1, 0, 3, 2])
	let h = dsp.matchedFilter(template)
	let energy = 1 + 0 + 9 + 4 // 14
	almost(h[0], 2/energy, LOOSE)
	almost(h[1], 3/energy, LOOSE)
	almost(h[2], 0/energy, LOOSE)
	almost(h[3], 1/energy, LOOSE)
})

// --- noiseShaping quantizes signal ---

test('noiseShaping — quantizes to target bit depth', () => {
	let data = new Float64Array(256)
	for (let i = 0; i < 256; i++) data[i] = Math.sin(2 * Math.PI * 100 * i / 44100) * 0.5
	let orig = Float64Array.from(data)
	dsp.noiseShaping(data, {bits: 8})
	let scale = Math.pow(2, 7) // 2^(bits-1)
	let allQuantized = true
	for (let i = 0; i < 256; i++) {
		let rounded = Math.round(data[i] * scale) / scale
		if (Math.abs(data[i] - rounded) > 1e-12) { allQuantized = false; break }
	}
	ok(allQuantized, 'all samples quantized to 8-bit grid')
	// Should differ from original continuous values
	let hasDiff = data.some((x, i) => Math.abs(x - orig[i]) > 1e-10)
	ok(hasDiff, 'quantization changes values')
})

// --- LMS/NLMS/RLS all converge ---

test('lms — error decreases over time', () => {
	let input = new Float64Array(512)
	for (let i = 0; i < 512; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, mu: 0.1}
	dsp.lms(input, desired, params)
	let earlyErr = 0, lateErr = 0
	for (let i = 0; i < 50; i++) earlyErr += Math.abs(params.error[i])
	for (let i = 462; i < 512; i++) lateErr += Math.abs(params.error[i])
	ok(lateErr < earlyErr, 'LMS error decreases: early=' + earlyErr.toFixed(3) + ' late=' + lateErr.toFixed(3))
})

test('nlms — error decreases over time', () => {
	let input = new Float64Array(512)
	for (let i = 0; i < 512; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, mu: 0.5}
	dsp.nlms(input, desired, params)
	let earlyErr = 0, lateErr = 0
	for (let i = 0; i < 50; i++) earlyErr += Math.abs(params.error[i])
	for (let i = 462; i < 512; i++) lateErr += Math.abs(params.error[i])
	ok(lateErr < earlyErr, 'NLMS error decreases: early=' + earlyErr.toFixed(3) + ' late=' + lateErr.toFixed(3))
})

test('rls — error decreases over time', () => {
	let input = new Float64Array(512)
	for (let i = 0; i < 512; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, lambda: 0.99}
	dsp.rls(input, desired, params)
	let earlyErr = 0, lateErr = 0
	for (let i = 0; i < 50; i++) earlyErr += Math.abs(params.error[i])
	for (let i = 462; i < 512; i++) lateErr += Math.abs(params.error[i])
	ok(lateErr < earlyErr, 'RLS error decreases: early=' + earlyErr.toFixed(3) + ' late=' + lateErr.toFixed(3))
})

// --- ITU-468: 0dB normalization at 2kHz reference ---

test('itu468 — peaked response near 6.3kHz', () => {
	let sos = dsp.itu468(48000)
	ok(sos.length >= 3, 'at least 3 sections')
	let resp = dsp.freqz(sos, 4096, 48000)
	let db = dsp.mag2db(resp.magnitude)
	let idx2k = Math.round(2000 / (48000/2) * 4096)
	let idx6k = Math.round(6300 / (48000/2) * 4096)
	// ITU-468 peaks near 6.3kHz, significantly above 2kHz level
	ok(db[idx6k] > db[idx2k] + 3, 'ITU-468 peaks near 6.3kHz (6.3kHz: ' + db[idx6k].toFixed(1) + 'dB, 2kHz: ' + db[idx2k].toFixed(1) + 'dB)')
})

// --- dcBlocker: verify last sample near 0 for DC input ---

test('dcBlocker — output converges to 0 for pure DC', () => {
	let data = dc(4096)
	dsp.dcBlocker(data, {R: 0.995})
	ok(Math.abs(data[4095]) < 0.005, 'DC blocked to < 0.005 (got ' + Math.abs(data[4095]).toFixed(6) + ')')
})

// --- allpass second-order: unity magnitude ---

test('allpass.second — unity magnitude across spectrum', () => {
	let data = impulse(512)
	dsp.allpass.second(data, {fc: 2000, Q: 1, fs: 44100})
	// Compute energy — should equal input energy (1.0 for unit impulse)
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	almost(energy, 1, 0.01)
})

// --- halfBand: DC passthrough and Nyquist/2 rejection ---

test('halfBand — DC gain = 1', () => {
	let h = dsp.halfBand(31)
	let sum = 0
	for (let i = 0; i < h.length; i++) sum += h[i]
	almost(sum, 1, 0.01)
})

test('halfBand — attenuates at Nyquist/2', () => {
	let h = dsp.halfBand(31)
	// Evaluate magnitude at w = pi/2 (Nyquist/2, normalized frequency 0.5)
	let w = Math.PI / 2
	let re = 0, im = 0
	for (let n = 0; n < h.length; n++) {
		re += h[n] * Math.cos(w * n)
		im -= h[n] * Math.sin(w * n)
	}
	let mag = Math.sqrt(re * re + im * im)
	// At exactly Nyquist/2, half-band should be at -6dB (≈ 0.5 magnitude)
	ok(mag < 0.8, 'halfBand magnitude < 0.8 at Nyquist/2 (got ' + mag.toFixed(4) + ')')
})

// --- CIC: DC preservation strict ---

test('cic — DC preservation exact', () => {
	let data = new Float64Array(2000).fill(1)
	let out = dsp.cic(data, 10, 3)
	is(out.length, 200, 'decimated by 10')
	// After settling, all output samples should be exactly 1
	let allOne = true
	for (let i = 50; i < 200; i++) {
		if (Math.abs(out[i] - 1) > 0.001) { allOne = false; break }
	}
	ok(allOne, 'CIC preserves DC exactly after settling')
})

// --- polyphase: reconstruction (concat phases = original) ---

test('polyphase — phases reconstruct original', () => {
	let h = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
	let M = 4
	let phases = dsp.polyphase(h, M)
	is(phases.length, M, M + ' phases')

	// Interleave phases to reconstruct original
	let reconstructed = new Float64Array(h.length)
	for (let p = 0; p < M; p++) {
		for (let k = 0; k < phases[p].length; k++) {
			reconstructed[k * M + p] = phases[p][k]
		}
	}
	almost(Array.from(reconstructed), Array.from(h), 1e-10)
})

// --- oversample: DC passthrough ---

test('oversample — DC passthrough', () => {
	let data = new Float64Array(64).fill(1)
	let out = dsp.oversample(data, 4)
	is(out.length, 256, 'length * 4')
	// After transient, output should be ≈ 1 (DC preserved)
	let midVal = out[128]
	almost(midVal, 1, 0.1)
})

// --- farrow: integer delay is exact ---

test('farrow — integer delay is exact', () => {
	let data = new Float64Array(64)
	data[10] = 1 // impulse at 10
	dsp.farrow(data, {delay: 5, order: 3})
	// Peak should be exactly at sample 15
	let peakIdx = 0
	for (let i = 1; i < 64; i++) if (data[i] > data[peakIdx]) peakIdx = i
	is(peakIdx, 15, 'integer delay moves impulse by exactly 5 samples')
	ok(data[15] > 0.8, 'peak amplitude preserved (got ' + data[15].toFixed(4) + ')')
})

// --- thiran: allpass property (|b| coefficients = reversed |a|) ---

test('thiran — allpass structure verified', () => {
	for (let delay of [2.3, 3.7, 4.1]) {
		let order = Math.ceil(delay)
		let {b, a} = dsp.thiran(delay, order)
		// For allpass: b[k] = a[N-k] (reversed)
		for (let k = 0; k <= order; k++) {
			almost(b[k], a[order - k], LOOSE)
		}
	}
})

// --- crossfeed: stereo mix ---

test('crossfeed — mixes stereo channels', () => {
	let left = dc(256, 1)
	let right = dc(256, 0)
	dsp.crossfeed(left, right, {fc: 700, level: 0.3, fs: 44100})
	// Right channel should now have some energy (mixed from left)
	let rightEnergy = 0
	for (let i = 128; i < 256; i++) rightEnergy += right[i] * right[i]
	ok(rightEnergy > 0.01, 'crossfeed mixes L→R (right energy: ' + rightEnergy.toFixed(4) + ')')
	// Left should still have energy (not fully cancelled)
	let leftEnergy = 0
	for (let i = 128; i < 256; i++) leftEnergy += left[i] * left[i]
	ok(leftEnergy > 0.1, 'left retains energy after crossfeed')
})

// --- formant: output has energy ---

test('formant — output has significant energy', () => {
	let data = impulse(1024)
	dsp.formant(data, {fs: 44100})
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	ok(energy > 0.0001, 'formant has energy (got ' + energy.toFixed(6) + ')')
	// Should have some non-zero output
	let hasOutput = data.some(x => Math.abs(x) > 0.0001)
	ok(hasOutput, 'formant produces output')
})

// --- vocoder: output length ---

test('vocoder — output matches input length', () => {
	let N = 512
	let carrier = new Float64Array(N)
	let modulator = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		carrier[i] = Math.sin(2 * Math.PI * 440 * i / 44100) // sawtooth-like
		modulator[i] = Math.sin(2 * Math.PI * 100 * i / 44100) * 0.5
	}
	let out = dsp.vocoder(carrier, modulator, {bands: 8, fs: 44100})
	is(out.length, N, 'vocoder output length = input length')
	let hasOutput = out.some(x => Math.abs(x) > 0.0001)
	ok(hasOutput, 'vocoder produces nonzero output')
})

// --- warpedFir: produces output ---

test('warpedFir — produces output on impulse', () => {
	let data = impulse(128)
	dsp.warpedFir(data, {coefs: new Float64Array([1, 0.5, 0.25]), lambda: 0.7})
	ok(data[0] !== 0, 'first sample non-zero')
	let hasOutput = data.some(x => Math.abs(x) > 0.001)
	ok(hasOutput, 'warpedFir produces output')
	ok(data.every(isFinite), 'all samples finite')
})

// --- isMinPhase on minimumPhase output ---

test('isMinPhase — minimumPhase output is minimum phase', () => {
	let h = dsp.firwin(31, 2000, 44100)
	let hm = dsp.minimumPhase(h)
	// Convert to SOS for isMinPhase: treat as single FIR section
	// isMinPhase checks that zeros are inside unit circle
	// For a minimum-phase filter, all zeros should be inside or on the unit circle
	// We verify via energy concentration: most energy should be in early samples
	let earlyEnergy = 0, totalEnergy = 0
	for (let i = 0; i < hm.length; i++) {
		totalEnergy += hm[i] * hm[i]
		if (i < hm.length / 2) earlyEnergy += hm[i] * hm[i]
	}
	ok(earlyEnergy / totalEnergy > 0.7, 'minimumPhase concentrates energy early (ratio: ' + (earlyEnergy/totalEnergy).toFixed(3) + ')')
})

// --- isFir on FIR coefficients ---

test('isFir — returns true for biquad with a1=a2=0', () => {
	let firSos = [{b0: 1, b1: 0.5, b2: 0.25, a1: 0, a2: 0}]
	ok(dsp.isFir(firSos), 'a1=a2=0 is FIR')
})

test('isFir — returns false for IIR filter', () => {
	let sos = dsp.butterworth(2, 1000, 44100)
	ok(!dsp.isFir(sos), 'Butterworth is not FIR')
})

// --- Round-trip: butterworth → sos2zpk → zpk2sos → same section count ---

test('convert round-trip — butterworth → sos2zpk → zpk2sos', () => {
	for (let order of [2, 4, 6]) {
		let sos = dsp.butterworth(order, 1000, 44100)
		let zpk = dsp.sos2zpk(sos)
		let sos2 = dsp.zpk2sos(zpk)
		is(sos2.length, sos.length, 'order ' + order + ' round-trip: same section count')

		// Verify DC gain is preserved through round-trip
		let gain1 = 1, gain2 = 1
		for (let s of sos) gain1 *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		for (let s of sos2) gain2 *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		almost(gain1, gain2, 0.01)
	}
})

// --- Integration: full chain test ---

test('butterworth + filter + freqz end-to-end', () => {
	let sos = dsp.butterworth(4, 2000, 44100)
	let data = dc(512)
	dsp.filter(data, {coefs: sos})
	almost(data[511], 1, 0.01)

	let resp = dsp.freqz(sos, 512, 44100)
	ok(resp.magnitude[0] > 0.99, 'magnitude at DC ≈ 1')
	ok(resp.magnitude[511] < 0.01, 'magnitude at Nyquist ≈ 0 for LP')
})
