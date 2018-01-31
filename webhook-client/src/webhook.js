'use strict'

const request = require('request-promise')
const VError = require('verror')

async function register(webhookServerURL, clientName, callbackURL) {
	try {
		await request({
			method: 'POST',
			uri: webhookServerURL,
			body: {
				name: clientName,
				callbackURL: callbackURL,
			},
			json: true,
		})
	} catch (err) {
		if (err.statusCode === 400) {
			if (err.error.length > 0 && err.error[0].errorCode === 'ALREADY_REGISTERED') {
				return
			}
		}
		throw new VError(err, 'Failed to register the application on the webhoook')
	}
}

module.exports = {
	register,
}