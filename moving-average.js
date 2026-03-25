/**
 * @module  digital-filter/moving-average
 */

'use strict'

module.exports = function movingAverage (data, param) {
	let ptr = param.ptr
	let mem = param.memory

	//init memory, if ptr is not defined
	if (ptr == null) {
		if (!mem) mem = 8
		if (typeof mem === 'number') mem = Array(mem)
		for (let i = 0; i < mem.length; i++) {
			mem[i] = 0
		}
		ptr = param.ptr = 0;
		param.memory = mem
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

	param.ptr = ptr

	return data
}
