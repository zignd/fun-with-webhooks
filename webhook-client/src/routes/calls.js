'use strict'

const Joi = require('joi')
const Op = require('sequelize').Op
const VError = require('verror')

const statusEnum = require('../models/status-enum')
const rabbitmq = require('../rabbitmq')

const schema = Joi.object().keys({
	type: Joi.string().required(),
	contactNumber: Joi.string().length(14).required(),
})

async function sendToSpecializedQueue(db, contactNumber, uri, queue900, queue901) {
	let contact = await db.contact.findOne({
		where: {
			number: {
				[Op.eq]: contactNumber,
			},
		},
	})

	let existingContact = true
	if (!contact) {
		existingContact = false
		contact = await db.contact.create({
			number: contactNumber,
		})
	}

	const call = await db.call.create({
		contactId: contact.id,
		status: statusEnum.Waiting,
	})

	const queue = existingContact ? queue901 : queue900
	const { conn, ch } = await rabbitmq.connectToQueue(uri, queue)
	try {
		await ch.assertQueue(queue)
		const b = Buffer.from(JSON.stringify({
			callId: call.id,
		}))
		await ch.sendToQueue(queue, b)
	} finally {
		await ch.close()
		await conn.close()
	}
}

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
		await sendToSpecializedQueue(req.db, req.body.contactNumber, rabbitMQURI, queue900, queue901)

		return res.end()
	} catch (err) {
		next(new VError(err, 'Unexpected error in the main middleware for the /calls endpoint'))
	}
}

module.exports = [validation, main]