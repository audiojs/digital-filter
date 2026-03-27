/**
 * Median filter. Replaces each sample with the median of its neighborhood.
 * @param {Array|Float64Array} data - Input (modified in-place)
 * @param {object} params - { size: window size (odd, default 5) }
 * @returns {Array|Float64Array} filtered data
 */
export default function median (data, params) {
	let size = params.size || 5
	let half = (size - 1) / 2
	let n = data.length
	let input = new Float64Array(data) // copy since we read while writing
	let buf = new Float64Array(size)

	for (let i = 0; i < n; i++) {
		// Fill window buffer
		for (let j = 0; j < size; j++) {
			let idx = i + j - half
			if (idx < 0) idx = 0
			if (idx >= n) idx = n - 1
			buf[j] = input[idx]
		}
		// Sort and take median
		buf.sort()
		data[i] = buf[half]
	}

	return data
}
