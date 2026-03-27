/**
 * @module  digital-filter/moving-average
 */

export default function movingAverage (data, params) {
	let ptr = params.ptr
	let mem = params.memory

	//init memory, if ptr is not defined
	if (ptr == null) {
		if (!mem) mem = 8
		if (typeof mem === 'number') mem = Array(mem)
		for (let i = 0; i < mem.length; i++) {
			mem[i] = 0
		}
		ptr = params.ptr = 0;
		params.memory = mem
	}

	let m = mem.length

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		mem[ptr] = x
		ptr = (ptr + 1) % m

		let sum = 0
		for (let j = 0; j < m; j++) sum += mem[j]
		data[i] = sum / m
	}

	params.ptr = ptr

	return data
}
