'use strict'

const Joi = require('joi')
const VError = require('verror')

const CallsDisPatcher = require('../business/calls-dispatcher')

const schema = Joi.object().keys({
	type: Joi.string().required(),
	contactNumber: Joi.string().length(14).required(),
})

function validation(req, res, next) {
	const result = schema.validate(req.body, { abortEarly: false })
	if (result.error)
		return res.status(400).send(result.error.details)

	return next()
}

async function main(req, res, next) {
	try {
		if (req.body.type !== 'call.standby')
			return res.send()

		const rabbitMQURI = req.cfg['rabbitmq-uri']
		const queue900 = req.cfg['rabbitmq-900-queue']
		const queue901 = req.cfg['rabbitmq-901-queue']

		const dispatcher = new CallsDisPatcher(req.db, rabbitMQURI, queue900, queue901)
		await dispatcher.sendToSpecializedExtensionNumber(req.body.contactNumber)

		return res.end()
	} catch (err) {
		next(new VError(err, 'Unexpected error in the main middleware for the /calls endpoint'))
	}
}

module.exports = [validation, main]