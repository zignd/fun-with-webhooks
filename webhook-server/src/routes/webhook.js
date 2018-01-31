'use strict'

const Joi = require('joi')
const Op = require('sequelize').Op
const VError = require('verror')

const schema = Joi.object().keys({
	name: Joi.string().min(3).max(255).required(),
	callbackURL: Joi.string().uri({
		scheme: ['http', 'https'],
	}).max(255).required(),
})

function validation(req, res, next) {
	const result = schema.validate(req.body, { abortEarly: false })
	if (result.error)
		return res.status(400).send(result.error.details)
	return next()
}

async function main(req, res, next) {
	try {
		const client = await req.db.client.findOne({ where: { name: { [Op.eq]: req.body.name } } })
		if (client) {
			if (client.enabled) {
				return res.status(400).send([{ errorCode: 'ALREADY_REGISTERED', message: 'There\'s already a client with the same name' }])
			}

			await req.db.client.update({
				errorsCounter: 0,
				enabled: true,
			}, { where: { id: { [Op.eq]: client.id } } })
		}
		await req.db.client.create(req.body)
		return res.end()
	} catch (err) {
		next(new VError(err, 'Unexpected error in the main middleware for the /webhook endpoint'))
	}
}

module.exports = [validation, main]