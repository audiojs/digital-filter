# Adaptive Filters

Filters that design themselves. An adaptive filter adjusts its own coefficients in real time, driven by an error signal — the difference between its output and a desired reference. No frequency specifications, no design step, no precomputation. The signal itself teaches the filter what to do.

![Adaptive Filter Block Diagram](plots/adaptive-block.svg)

## What adaptive filters are

Every adaptive filter has the same structure:

```
              ┌─────────────┐
   input ────>│  FIR filter  │──── output ───(+)──── error
              │  w[0..N-1]   │               (-)
              └──────┬───────┘                │
                     │                    desired
                     │ update: w += f(error, input)
                     └────────────────────────┘
```

The filter is an FIR with N coefficients (taps). Each sample, the algorithm:
1. Computes the output: `y = w·x` (dot product of weights and input buffer).
2. Computes the error: `e = desired - y`.
3. Updates the weights: `w += f(e, x)` (the update rule differs per algorithm).

The goal: minimize the error signal over time. If the input and desired signals have a consistent relationship, the filter converges to the optimal Wiener filter — the FIR that minimizes the mean squared error.

**The critical question is always: what is the "desired" signal?** The answer determines the application:

- **Echo cancellation**: desired = microphone signal. Input = far-end speaker output. The filter learns the acoustic path. Error = echo-cancelled signal.
- **Noise cancellation**: desired = primary signal (noisy). Input = reference noise correlated with the noise component. Error = cleaned signal.
- **System identification**: desired = output of unknown system. Input = same input fed to the unknown system. The filter converges to match the unknown system.
- **Prediction**: desired = signal delayed by one sample. Input = current signal. The filter learns the signal's structure. Error = prediction residual (innovation).

---

## Choosing an adaptive algorithm

| | LMS | NLMS | RLS | Levinson-Durbin |
|---|---|---|---|---|
| **Complexity** | O(N) per sample | O(N) per sample | O(N²) per sample | O(N²) per block |
| **Convergence** | Slow | Medium | Fast | Instant (batch) |
| **Tracking** | Slow | Medium | Fast | N/A (static) |
| **Stability** | Very robust | Robust | Fragile (λ sensitive) | Stable |
| **Step size** | Must tune μ | Self-normalizing | Forgetting factor λ | N/A |
| **Memory** | N weights | N weights | N×N matrix | N coefficients |
| **Best for** | Learning, simple tasks | Real-world adaptive | Fast-changing systems | LPC, speech coding |

**Start with NLMS.** It handles varying signal levels automatically, converges reasonably fast, and is robust. Switch to RLS only if you need faster convergence and can afford the O(N²) cost. Use plain LMS only for educational purposes or when you need the absolute simplest implementation. Use Levinson-Durbin for offline LPC analysis.

---

## LMS — Least Mean Squares

### What it is

The simplest adaptive filter algorithm. Each sample, it adjusts the filter weights by a small step in the direction that reduces the squared error. The update rule is `w += μ · e · x`, where μ is the step size (learning rate), e is the error, and x is the input buffer. This is stochastic gradient descent on the mean squared error surface — each sample provides one noisy gradient estimate, and the algorithm takes a small step downhill.

### When to use it

Educational purposes — understanding adaptive filtering starts with LMS. Very simple systems where convergence speed does not matter. Situations where the input signal power is constant (so μ does not need normalization). When O(N) cost per sample is essential and NLMS overhead is unacceptable (rare — NLMS adds only one division).

### When NOT to use it

In practice, almost always use NLMS instead. LMS requires manual tuning of μ based on the input signal level — if μ is too large, the filter diverges; if too small, it converges too slowly. When the input signal has varying power (speech, music), LMS becomes unreliable. NLMS solves this by normalizing.

### Origin

Bernard Widrow and Ted Hoff, "Adaptive Switching Circuits" (1960). Developed at Stanford as part of the ADALINE (Adaptive Linear Neuron) project. One of the foundational algorithms of both adaptive signal processing and neural networks.

### How it works

At each sample n:

```
y[n] = Σ w[k] · x[n-k]        (FIR output)
e[n] = d[n] - y[n]             (error)
w[k] += μ · e[n] · x[n-k]     (weight update for all k)
```

The step size μ must satisfy `0 < μ < 2/(N · σ²)` where σ² is the input signal power — otherwise the algorithm diverges. In practice, μ is set much smaller than this bound for stability margin.

**Convergence speed** is proportional to μ and inversely proportional to the eigenvalue spread of the input autocorrelation matrix. White noise (flat spectrum) converges fastest; narrow-band signals (large eigenvalue spread) converge slowest.

### Key characteristics

- **Complexity**: 2N multiplies + N additions per sample (N for output, N for update).
- **Convergence**: Slow. Depends on eigenvalue spread of input correlation matrix. For speech, can take thousands of samples.
- **Misadjustment**: Steady-state excess MSE is proportional to μ·N. Larger μ → faster convergence but higher residual error. This is the fundamental LMS tradeoff.
- **Stability**: Robust if μ is within bounds. Gracefully degrades (slow divergence) if μ is slightly too large.
- **Memory**: N weights + N-sample circular buffer.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `input` | Float64Array | — | — | Input signal |
| `desired` | Float64Array | — | same length as input | Desired (reference) signal |
| `params.order` | number | 32 | ≥ 1 | Number of filter taps |
| `params.mu` | number | 0.01 | 0 < μ < 2/(N·σ²) | Step size. Larger = faster but less stable. |
| `params.w` | Float64Array | zeros | length = order | Weight vector (persisted between calls) |

Returns Float64Array (filtered output). `params.error` contains the error signal. `params.w` is updated in place.

### Example

```js
import { lms } from 'digital-filter'

// Echo cancellation setup
let params = { order: 128, mu: 0.01 }

// Process block by block
for (let block of audioBlocks) {
  let { mic, speaker } = block
  let output = lms(speaker, mic, params)
  // params.error is the echo-cancelled signal
  playback(params.error)
}
```

### Comparison

vs **NLMS**: NLMS adds normalization by input power: step becomes `μ/(||x||² + ε)` instead of `μ`. This one division per sample makes NLMS self-tuning for varying signal levels. There is almost no reason to prefer LMS over NLMS in practice.

vs **RLS**: RLS converges in ~2N samples (independent of eigenvalue spread). LMS converges in ~10N/μ samples. RLS is 10–100× faster but costs O(N²) per sample and can diverge if λ is wrong.

### References

- B. Widrow & M.E. Hoff, "Adaptive Switching Circuits," *IRE WESCON Conv. Record*, pt. 4, pp. 96–104, 1960.
- S. Haykin, *Adaptive Filter Theory*, 5th ed., Prentice-Hall, 2013.
- B. Widrow & S.D. Stearns, *Adaptive Signal Processing*, Prentice-Hall, 1985.

---

## NLMS — Normalized LMS

### What it is

The practical version of LMS. The step size is normalized by the current input power: `w += μ · e · x / (||x||² + ε)`. This makes the convergence rate independent of the input signal level. When the signal is loud, the step shrinks automatically; when the signal is quiet, the step grows. No manual tuning of μ relative to signal power. This is the algorithm you should use for real-world adaptive filtering.

### When to use it

The default choice for adaptive filtering. Echo cancellation in teleconferencing (the AEC in your phone uses a variant of NLMS). Active noise cancellation in headphones. Acoustic feedback suppression in live sound. Adaptive equalization. Any real-time adaptive task where the input level varies.

### When NOT to use it

When convergence must be as fast as possible and you can afford O(N²) per sample (use RLS). When the system is completely stationary and you are doing offline batch processing (use Levinson-Durbin for the exact Wiener solution).

### Origin

A direct extension of Widrow-Hoff LMS (1960). The normalization was introduced by Nagumo and Noda (1967) and independently by Albert and Gardner (1967). It resolved the primary practical limitation of LMS — sensitivity to input scaling.

### How it works

At each sample n:

```
y[n] = Σ w[k] · x[n-k]                     (FIR output)
e[n] = d[n] - y[n]                           (error)
power = Σ x[n-k]²                            (input power)
w[k] += (μ / (power + ε)) · e[n] · x[n-k]  (normalized update)
```

The regularization `ε` (default 1e-8) prevents division by zero during silence. The step size μ now has a clean range: `0 < μ < 2`. At μ=1, the algorithm attempts to correct the entire error in one step (aggressive). At μ=0.5, it corrects half. Common values: 0.1–1.0.

### Key characteristics

- **Complexity**: 3N multiplies per sample (N for output, N for power, N for update). One extra division.
- **Convergence**: Faster than LMS for varying-level signals. For white noise input, convergence time ≈ 2N/μ samples.
- **Misadjustment**: Proportional to μ. The μ vs misadjustment tradeoff is the same as LMS, but μ has a well-defined range [0, 2] regardless of signal level.
- **Stability**: Stable for 0 < μ < 2. More robust than LMS because the normalization prevents step size from being too large when the signal is loud.
- **Tracking**: Adapts to slowly changing systems. For fast-changing systems, increase μ (at the cost of higher misadjustment).

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `input` | Float64Array | — | — | Input signal |
| `desired` | Float64Array | — | same length as input | Desired (reference) signal |
| `params.order` | number | 32 | ≥ 1 | Number of filter taps |
| `params.mu` | number | 0.5 | 0 < μ < 2 | Normalized step size. 1 = full correction per sample. |
| `params.eps` | number | 1e-8 | > 0 | Regularization (prevents division by zero in silence) |
| `params.w` | Float64Array | zeros | length = order | Weight vector (persisted between calls) |

Returns Float64Array (filtered output). `params.error` contains the error signal.

### Example

```js
import { nlms } from 'digital-filter'

// Acoustic echo cancellation
let params = { order: 256, mu: 0.5 }

for (let block of audioBlocks) {
  let output = nlms(speakerSignal, micSignal, params)
  // params.error = echo-cancelled microphone signal
  send(params.error)
}

// Noise cancellation: reference microphone picks up noise
let nc = { order: 64, mu: 0.3 }
let clean = nlms(noiseReference, noisySignal, nc)
// nc.error = cleaned signal
```

### Comparison

vs **LMS**: NLMS is strictly superior for varying-level signals. The only advantage of LMS is simplicity (one less division per sample). In practice, always use NLMS.

vs **RLS**: RLS converges ~10× faster but costs O(N²) per sample and requires tuning the forgetting factor λ. For order N=256, NLMS costs ~768 operations/sample; RLS costs ~65,536. Use NLMS unless convergence speed is critical and you can afford the computation.

### References

- J.I. Nagumo & A. Noda, "A Learning Method for System Identification," *IEEE Trans. Automatic Control*, vol. 12, pp. 282–287, 1967.
- S. Haykin, *Adaptive Filter Theory*, 5th ed., Prentice-Hall, 2013, ch. 5.
- A. Sayed, *Adaptive Filters*, Wiley, 2008.

---

## RLS — Recursive Least Squares

### What it is

The fast-converging adaptive filter. Where LMS/NLMS use a single gradient step per sample, RLS maintains an estimate of the inverse input correlation matrix and uses it to compute the optimal weight update. The result: convergence in roughly 2N samples (where N is the filter order), independent of the input signal statistics. The price is O(N²) computation per sample and a fragility that LMS does not have — the forgetting factor λ must be set correctly, or the algorithm diverges.

### When to use it

When convergence speed is critical and the system changes rapidly: fast-tracking channel equalization, rapidly varying echo paths, systems that must adapt within a few hundred samples. When N is small enough that O(N²) is affordable (N ≤ 64 is typical). When the signal statistics change and the filter must track the changes quickly.

### When NOT to use it

When N is large (N > 128 makes O(N²) expensive). When stability and robustness matter more than convergence speed (use NLMS). When the system is stationary (NLMS will converge eventually, and its steady-state performance is comparable). When memory is constrained (RLS stores an N×N matrix).

### Origin

The recursive least squares algorithm is the online (sample-by-sample) version of the normal equations solution. It was developed for control and signal processing applications in the 1960s–70s, building on the matrix inversion lemma (Woodbury identity). The forgetting factor variant was formalized by Ljung and Söderström (1983).

### How it works

RLS maintains two structures: the weight vector `w` (N elements) and the inverse correlation matrix `P` (N×N). At each sample:

```
x = input buffer (N elements)
y = w · x                          (output)
e = desired - y                    (error)
k = P·x / (λ + x'·P·x)           (gain vector — N×1)
w += k · e                         (weight update)
P = (P - k·(P·x)') / λ            (inverse correlation update)
```

The gain vector `k` is the Kalman gain — it tells the algorithm how much to trust each input sample for updating each weight. The matrix `P` is initialized as `δ·I` (a scaled identity matrix), representing initial uncertainty about the weights.

The **forgetting factor λ** (0 < λ ≤ 1) controls how quickly old data is discounted:
- λ = 1.0: infinite memory, no forgetting. Optimal for stationary systems.
- λ = 0.99: effectively remembers the last ~100 samples. Good for slowly varying systems.
- λ = 0.95: remembers ~20 samples. For rapidly changing systems.
- λ < 0.9: dangerous. The algorithm becomes very aggressive and can diverge.

### Key characteristics

- **Complexity**: ~3N² multiplies per sample (matrix-vector products and rank-1 update).
- **Convergence**: ~2N samples, independent of input statistics. This is RLS's defining advantage.
- **Tracking**: Excellent for time-varying systems (controlled by λ).
- **Stability**: Less robust than NLMS. If λ is too small, P can become ill-conditioned and the algorithm diverges. The initial δ also affects stability — too large causes slow start, too small causes instability.
- **Memory**: N×N matrix + N weights.
- **Numerical precision**: Accumulated matrix operations can cause P to lose symmetry or positive-definiteness. Practical implementations add stabilization (force symmetry, eigenvalue flooring).

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `input` | Float64Array | — | — | Input signal |
| `desired` | Float64Array | — | same length as input | Desired (reference) signal |
| `params.order` | number | 16 | ≥ 1 | Number of filter taps |
| `params.lambda` | number | 0.99 | 0.9–1.0 (practical) | Forgetting factor. 1 = no forgetting. Lower = faster tracking, less stable. |
| `params.delta` | number | 100 | > 0 | Initial P matrix scaling (δ·I). Larger = more cautious start. |
| `params.w` | Float64Array | zeros | length = order | Weight vector (persisted) |
| `params.P` | Array of Float64Array | δ·I | N×N | Inverse correlation matrix (persisted) |

Returns Float64Array (filtered output). `params.error` contains the error signal.

### Example

```js
import { rls } from 'digital-filter'

// Fast-tracking echo cancellation (short filter)
let params = { order: 32, lambda: 0.99, delta: 100 }

for (let block of audioBlocks) {
  let output = rls(speakerSignal, micSignal, params)
  // params.error = echo-cancelled signal
  // Converges in ~64 samples (2 × order)
}

// System identification: learn an unknown filter
let sysid = { order: 16, lambda: 1.0 }
rls(input, outputOfUnknownSystem, sysid)
// sysid.w now approximates the unknown system's impulse response
```

### Comparison

vs **NLMS**: NLMS converges in ~2N/μ ≈ 500–2000 samples (for typical μ). RLS converges in ~2N ≈ 32–64 samples. RLS is 10–50× faster but costs N× more computation per sample. Use NLMS for long filters (N > 128); use RLS for short filters where speed matters.

vs **LMS**: RLS is superior in every way except computation cost and robustness. LMS is O(N), RLS is O(N²). LMS diverges gracefully (weights grow slowly); RLS can blow up suddenly (P becomes singular).

### References

- S. Haykin, *Adaptive Filter Theory*, 5th ed., Prentice-Hall, 2013, ch. 10.
- L. Ljung & T. Söderström, *Theory and Practice of Recursive Identification*, MIT Press, 1983.
- A. Sayed, *Fundamentals of Adaptive Filtering*, Wiley, 2003.

---

## Levinson-Durbin — Toeplitz Solver for LPC

### What it is

Not a real-time adaptive filter but the efficient algorithm for solving the Toeplitz system that arises in Linear Predictive Coding (LPC). Given the autocorrelation sequence of a signal, Levinson-Durbin computes the optimal all-pole prediction coefficients in O(N²) time (vs O(N³) for general matrix inversion). It produces three things: the prediction coefficients `a`, the prediction error `E`, and the reflection coefficients `k` (PARCOR coefficients).

### When to use it

Linear Predictive Coding for speech analysis/synthesis (the core of CELP, LPC-10, and most speech codecs). Autoregressive (AR) spectral estimation. Speech formant analysis. Lattice filter coefficient computation (the reflection coefficients k map directly to lattice stages). Any application that needs to model a signal as an all-pole filter driven by white noise.

### When NOT to use it

For real-time adaptive filtering where coefficients must update every sample (use NLMS or RLS). When the signal is non-stationary and you need continuous tracking (Levinson-Durbin operates on a block of autocorrelation values, not sample-by-sample). When you need FIR (MA) or ARMA models rather than pure AR.

### Origin

Norman Levinson (1946) proposed the efficient recursion for Toeplitz systems. James Durbin (1960) refined it for the autocorrelation case. The algorithm became central to speech processing through Itakura and Saito's work on LPC at NTT in the 1960s, and was adopted into the US military's LPC-10 codec (1976) and later CELP.

### How it works

Given autocorrelation values R[0], R[1], ..., R[N]:

```
Initialize: a[0] = 1, E = R[0]

For i = 1 to N:
    λ = Σ a[j] · R[i-j]  for j=1..i-1
    k[i] = (R[i] - λ) / E              (reflection coefficient)
    a[i] = k[i]
    a[j] = a[j] - k[i] · a[i-j]       for j=1..i-1  (update coefficients)
    E = E · (1 - k[i]²)                (update prediction error)
```

Each iteration i adds one more coefficient, increasing the model order by 1. The reflection coefficients k[i] have a physical interpretation: they are the fraction of energy reflected at each stage of a lattice filter. If |k[i]| < 1 for all i, the model is stable.

The prediction error E decreases monotonically with order (more coefficients = better fit). The optimal order is typically chosen by the Akaike Information Criterion (AIC) or by domain knowledge (10–16 for narrowband speech at 8 kHz, 20–32 for wideband).

### Key characteristics

- **Complexity**: O(N²) for order N. One pass through the data (no iteration).
- **Output**: Prediction coefficients `a` (all-pole model), prediction error `E`, reflection coefficients `k`.
- **Stability guarantee**: If R is a valid autocorrelation sequence (positive definite Toeplitz matrix), all |k[i]| < 1 and the model is guaranteed stable.
- **Batch operation**: Processes the entire autocorrelation sequence at once. Not sample-by-sample.

### Parameters

| Parameter | Type | Default | Range | What it controls |
|---|---|---|---|---|
| `R` | Float64Array or Array | — | R[0] > 0 | Autocorrelation values R[0], R[1], ..., R[order] |
| `order` | number | R.length - 1 | ≥ 1 | LPC order (number of prediction coefficients) |

Returns `{ a: Float64Array, error: number, k: Float64Array }`:
- `a`: Prediction coefficients (a[0] = 1, a[1..order] = LP coefficients)
- `error`: Prediction error power
- `k`: Reflection (PARCOR) coefficients

### Example

```js
import { levinson } from 'digital-filter'

// Compute autocorrelation of a speech frame
let frame = audioFrame.slice(0, 320)  // 20ms at 16kHz
let R = new Float64Array(17)
for (let lag = 0; lag <= 16; lag++) {
  let sum = 0
  for (let i = 0; i < frame.length - lag; i++) sum += frame[i] * frame[i + lag]
  R[lag] = sum
}

// Solve for LPC-16 coefficients
let { a, error, k } = levinson(R, 16)
// a = prediction coefficients (for synthesis filter 1/A(z))
// error = residual energy (excitation power)
// k = reflection coefficients (for lattice filter)
```

### Comparison

vs **NLMS/RLS**: Levinson-Durbin computes the exact Wiener solution in one pass. NLMS/RLS converge to the same solution iteratively. Use Levinson-Durbin for offline batch analysis; use NLMS/RLS for real-time sample-by-sample adaptation.

vs **Direct matrix inversion**: Solving `R·a = r` by Gaussian elimination costs O(N³). Levinson-Durbin exploits the Toeplitz structure to reduce this to O(N²). For order 16, that is 256 vs 4096 operations.

### References

- N. Levinson, "The Wiener RMS (Root Mean Square) Error Criterion in Filter Design and Prediction," *J. Math. Phys.*, vol. 25, pp. 261–278, 1946.
- J. Durbin, "The Fitting of Time-Series Models," *Rev. Int. Stat. Inst.*, vol. 28, pp. 233–244, 1960.
- J. Makhoul, "Linear Prediction: A Tutorial Review," *Proc. IEEE*, vol. 63, no. 4, pp. 561–580, 1975.

---

## Applications in detail

### Echo cancellation

The classic adaptive filtering application. In a teleconference, the microphone picks up both the local speaker and the far-end speaker's voice playing through the loudspeaker. The adaptive filter models the acoustic path from loudspeaker to microphone and subtracts it.

```
Far-end speaker → Loudspeaker → Room → Microphone → [adaptive filter] → Clean signal
                      │                                   │
                      └── reference input ────────────────┘
```

- **Input**: far-end speaker signal (what the loudspeaker plays).
- **Desired**: microphone signal (far-end echo + local speech + noise).
- **Error**: echo-cancelled signal (local speech + residual).
- **Filter order**: 128–2048 taps (depends on room reverberation time).
- **Algorithm**: NLMS for most implementations. NLMS with double-talk detection for production systems.

```js
import { nlms } from 'digital-filter'

let aec = { order: 512, mu: 0.5 }
let cancelled = nlms(farEndSpeaker, microphone, aec)
// aec.error = microphone signal with echo removed
```

### Noise cancellation

A reference microphone picks up noise correlated with the noise component in the primary signal. The adaptive filter learns the transfer function from the noise source to the primary microphone and subtracts it.

```
Primary mic: signal + noise ──── desired
Reference mic: noise only ─────── input
Error: signal (noise removed)
```

- **Input**: reference noise signal.
- **Desired**: primary signal (contains both signal and noise).
- **Error**: cleaned signal.
- **Key requirement**: the reference must be correlated with the noise but uncorrelated with the signal.
- **Filter order**: 32–256 (depends on the acoustic path complexity).

### System identification

Feed the same input into both the unknown system and the adaptive filter. The adaptive filter converges to match the unknown system's impulse response.

```
                    ┌─────────────┐
   input ──┬──────>│ Unknown sys  │──── desired
            │       └─────────────┘
            │       ┌─────────────┐
            └──────>│ Adaptive    │──── output
                    └─────────────┘
                    error = desired - output → update
```

- **Use case**: measuring room impulse responses, characterizing audio equipment, identifying transfer functions.
- **Algorithm**: RLS for fast convergence. NLMS for long impulse responses.

### Defeedback (adaptive notch)

In live sound, acoustic feedback occurs when a microphone picks up sound from a loudspeaker, which is re-amplified, creating a growing oscillation at a specific frequency. An adaptive notch filter detects the growing frequency and places a narrow rejection band.

- **Approach**: Monitor the signal for growing sinusoidal components (high autocorrelation at the feedback frequency). Place a narrow adaptive notch at that frequency.
- **Implementation**: Cascade of NLMS-adapted biquads, each targeting one potential feedback frequency.
- **Filter order**: 2 per notch (biquad). Typically 4–8 notch filters in parallel.
