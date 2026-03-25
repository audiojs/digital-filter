/**
 * @module  digital-filter
 */
'use strict'

// Core
exports.biquad = require('./biquad')
exports.filter = require('./filter')
exports.freqz = require('./freqz')
exports.transform = require('./transform')

// Simple filters
exports.leakyIntegrator = require('./leaky-integrator')
exports.movingAverage = require('./moving-average')
exports.dcBlocker = require('./dc-blocker')
exports.onePole = require('./one-pole')
exports.comb = require('./comb')
exports.allpass = require('./allpass')

// Classic analog-prototype designs (return SOS)
exports.butterworth = require('./butterworth')
exports.chebyshev = require('./chebyshev')
exports.bessel = require('./bessel')
exports.elliptic = require('./elliptic')

// Specialized
exports.svf = require('./svf')
exports.linkwitzRiley = require('./linkwitz-riley')
exports.savitzkyGolay = require('./savitzky-golay')

// Weighting filters (return SOS)
exports.aWeighting = require('./a-weighting')
exports.cWeighting = require('./c-weighting')
exports.kWeighting = require('./k-weighting')
exports.itu468 = require('./itu468')
exports.riaa = require('./riaa')
