'use strict'

function sleepAsync(ms) {
	return new Promise((resolve, reject) => {
		setTimeout(() => { return resolve() }, ms)
	})
}

module.exports = {
	sleepAsync,
}