# adaptive/ -- Adaptive Filtering

A conventional filter has fixed coefficients chosen at design time. An adaptive filter adjusts its coefficients sample-by-sample to minimize the error between its output and a desired signal. The filter learns from the data.

## The setup

Every adaptive filter follows the same structure:

```
x[n] (input) ──→ [FIR w] ──→ y[n] (output)
                                │
                    d[n] ───(-)─┘
                (desired)    │
                           e[n] = d[n] - y[n]
                           (error)
                                │
                    ┌───────────┘
                    ↓
              update w[n] → w[n+1]
```

The output $y[n] = \mathbf{w}^T \mathbf{x}[n]$ is the inner product of the weight vector with the input vector. The error $e[n] = d[n] - y[n]$ drives weight updates. Different algorithms differ only in *how* they update the weights.

What changes between applications is where the signals come from:

- **Echo cancellation**: $x$ = far-end speaker, $d$ = microphone (echo + near-end), $e$ = cleaned signal
- **Noise cancellation**: $x$ = reference noise, $d$ = signal + noise, $e$ = cleaned signal
- **System identification**: $x$ = test signal, $d$ = system output, $\mathbf{w}$ converges to system impulse response
- **Channel equalization**: $x$ = received signal, $d$ = training symbols, $\mathbf{w}$ becomes the inverse channel

## Modules

### lms.js

The Least Mean Squares algorithm. Stochastic gradient descent on the mean squared error surface. The simplest adaptive filter and the foundation for all others.

The update rule:

$$\mathbf{w}[n+1] = \mathbf{w}[n] + \mu \cdot e[n] \cdot \mathbf{x}[n]$$

Each weight moves in the direction that would have reduced the current error, scaled by step size $\mu$. The gradient is approximated by the instantaneous product $e[n] \cdot \mathbf{x}[n]$ rather than the true expectation -- hence "stochastic."

Convergence requires $0 < \mu < 2 / (\lambda_{\max})$, where $\lambda_{\max}$ is the largest eigenvalue of the input autocorrelation matrix. In practice, keep $\mu$ small. Too large diverges; too small converges slowly.

```js
import lms from 'digital-filter/adaptive/lms.js'

let params = { order: 32, mu: 0.01 }
let output = lms(input, desired, params)
// params.w     -- learned coefficients (Float64Array)
// params.error -- error signal (Float64Array)
```

**API**: `lms(input, desired, params)` &rarr; `Float64Array` (new output buffer)
- `input` -- input signal (`Float64Array`)
- `desired` -- desired signal (same length)
- `params.order` -- number of FIR taps (default 32)
- `params.mu` -- step size (default 0.01)
- `params.w` -- weight vector (auto-initialized to zeros, persists)
- `params.buf` -- input delay line (auto-initialized, persists)
- `params.error` -- error signal (written after each call)

**Complexity**: $O(N)$ per sample, where $N$ is the filter order.

**Use when**: learning, prototyping, or when computational budget is tight. Also when the input signal has relatively uniform power.

**Avoid when**: the input has high eigenvalue spread (e.g., colored noise, speech) -- convergence becomes very slow. Use NLMS instead.

---

### nlms.js

Normalized LMS. The step size is divided by the instantaneous input power, making convergence independent of signal level.

$$\mathbf{w}[n+1] = \mathbf{w}[n] + \frac{\mu}{\|\mathbf{x}[n]\|^2 + \varepsilon} \cdot e[n] \cdot \mathbf{x}[n]$$

The regularization term $\varepsilon$ prevents division by zero during silence. With normalization, $\mu$ can be set in $(0, 2)$ without knowing the signal statistics -- $\mu = 1$ is unit-norm step, $\mu = 0.5$ is a safe default.

```js
import nlms from 'digital-filter/adaptive/nlms.js'

let params = { order: 32, mu: 0.5, eps: 1e-8 }
let output = nlms(input, desired, params)
// params.w, params.error -- same as lms
```

**API**: `nlms(input, desired, params)` &rarr; `Float64Array`
- `params.order` -- number of taps (default 32)
- `params.mu` -- normalized step size, 0-2 (default 0.5)
- `params.eps` -- regularization (default 1e-8)
- `params.w`, `params.buf`, `params.error` -- same as LMS

**Complexity**: $O(N)$ per sample (one extra dot product for power).

**Use when**: this is the practical default. Echo cancellation, noise cancellation, real-time system identification. Works across a wide range of signal statistics without tuning.

**Avoid when**: you need the fastest possible convergence and can afford $O(N^2)$ -- use RLS.

---

### rls.js

Recursive Least Squares. Minimizes the exponentially weighted sum of all past squared errors. Instead of following the gradient, RLS maintains an estimate of the inverse autocorrelation matrix $\mathbf{P}$ and uses it to compute the optimal weight update directly.

The gain vector and updates:

$$\mathbf{k}[n] = \frac{\mathbf{P}[n-1] \cdot \mathbf{x}[n]}{\lambda + \mathbf{x}[n]^T \mathbf{P}[n-1] \cdot \mathbf{x}[n]}$$

$$\mathbf{w}[n] = \mathbf{w}[n-1] + \mathbf{k}[n] \cdot e[n]$$

$$\mathbf{P}[n] = \frac{1}{\lambda}(\mathbf{P}[n-1] - \mathbf{k}[n] \cdot \mathbf{x}[n]^T \mathbf{P}[n-1])$$

The forgetting factor $\lambda \in (0, 1]$ controls how fast old data is discounted. $\lambda = 1$ is infinite memory (growing window). $\lambda = 0.99$ forgets with a time constant of ~100 samples.

RLS converges in roughly $2N$ samples regardless of eigenvalue spread -- dramatically faster than LMS for correlated inputs. The cost is $O(N^2)$ per sample for the matrix update.

```js
import rls from 'digital-filter/adaptive/rls.js'

let params = { order: 16, lambda: 0.99, delta: 100 }
let output = rls(input, desired, params)
// params.w     -- learned coefficients
// params.P     -- inverse correlation matrix (N x N)
// params.error -- error signal
```

**API**: `rls(input, desired, params)` &rarr; `Float64Array`
- `params.order` -- number of taps (default 16)
- `params.lambda` -- forgetting factor (default 0.99)
- `params.delta` -- initial diagonal of $\mathbf{P}$ (default 100). Larger = faster initial convergence but more noise.
- `params.w`, `params.P`, `params.buf`, `params.error` -- state (auto-initialized, persists)

**Complexity**: $O(N^2)$ per sample.

**Use when**: fast convergence matters more than computation. Fast-changing systems, short adaptation windows, situations where LMS/NLMS converge too slowly.

**Avoid when**: $N$ is large (hundreds of taps) -- the $O(N^2)$ cost dominates. Use NLMS for long filters.

---

### levinson.js

Levinson-Durbin recursion. Not an online adaptive filter -- it is a batch algorithm that solves the Toeplitz system $\mathbf{R}\mathbf{a} = \mathbf{r}$ in $O(N^2)$ given the autocorrelation sequence $R[0], R[1], \ldots, R[N]$.

Produces linear prediction coefficients (LPC), reflection coefficients (PARCOR), and the prediction error power.

The recursion builds up the solution order by order:

$$k_i = \frac{R[i] - \sum_{j=1}^{i-1} a_j R[i-j]}{E_{i-1}}$$

$$a_j^{(i)} = a_j^{(i-1)} - k_i \cdot a_{i-j}^{(i-1)}$$

$$E_i = E_{i-1}(1 - k_i^2)$$

The reflection coefficients $k_i$ have the Schur stability property: $|k_i| < 1$ for all $i$ if and only if the system is stable.

```js
import levinson from 'digital-filter/adaptive/levinson.js'

// R = autocorrelation values R[0], R[1], ..., R[order]
let { a, error, k } = levinson(R, 10)
// a     -- LPC coefficients (Float64Array, length order+1, a[0]=1)
// error -- prediction error power
// k     -- reflection coefficients (Float64Array, length order)
```

**API**: `levinson(R, order?)` &rarr; `{ a, error, k }`
- `R` -- autocorrelation sequence (`Float64Array | Array`), length >= order + 1
- `order` -- LPC order (default `R.length - 1`)

Returns:
- `a` -- prediction coefficients, `a[0] = 1`
- `error` -- residual prediction error power
- `k` -- reflection coefficients (PARCOR)

**Use when**: speech coding (LPC-10, CELP), spectral estimation (AR model), lattice filter design, formant analysis.

**Avoid when**: you need sample-by-sample adaptation -- use LMS/NLMS/RLS instead.

## Comparison

| | LMS | NLMS | RLS | Levinson |
|---|---|---|---|---|
| **Complexity** | $O(N)$/sample | $O(N)$/sample | $O(N^2)$/sample | $O(N^2)$/block |
| **Convergence** | Slow | Medium | Fast (~$2N$ samples) | Instant (batch) |
| **Memory** | $O(N)$ | $O(N)$ | $O(N^2)$ | $O(N)$ |
| **Stability** | Conditional ($\mu$ dependent) | Robust | Robust ($\lambda$ dependent) | Guaranteed if $|k_i| < 1$ |
| **Tuning** | $\mu$ critical, signal-dependent | $\mu \in (0,2)$, easy | $\lambda$ easy, $\delta$ moderate | Order only |
| **Mode** | Online | Online | Online | Batch |

## Practical guidance

**Choosing filter order**: start with an estimate of the unknown system's impulse response length. Too short misses slow-decaying modes. Too long wastes computation and slows convergence. For echo cancellation at 8 kHz, typical orders are 128-512 (16-64 ms).

**Step size tuning (LMS)**: $\mu = 0.1 / (N \cdot \sigma_x^2)$ is a reasonable starting point, where $\sigma_x^2$ is input variance. Reduce if unstable. NLMS avoids this entirely.

**Forgetting factor (RLS)**: $\lambda = 1$ for stationary systems. For tracking time-varying systems, $\lambda = 0.95$--$0.99$. Lower $\lambda$ tracks faster but adds noise to the weight estimate.
