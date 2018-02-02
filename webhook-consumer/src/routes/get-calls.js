'use strict'

const Joi = require('joi')
const Op = require('sequelize').Op
const VError = require('verror')

const statusEnum = require('../models/status-enum')

const schema = Joi.object().keys({
	status: Joi.any().allow(statusEnum.Waiting, statusEnum.Active, statusEnum.Completed).required(),
	limit: Joi.number().positive().integer().required(),
	offset: Joi.number().min(0).integer().required(),
})

function validation(req, res, next) {
	const result = schema.validate(req.query, { abortEarly: false })
	if (result.error)
		return res.status(400).send(result.error.details)

	return next()
}

async function main(req, res, next) {
	try {
		const calls = await req.db.call.findAll({
			where: { status: { [Op.eq]: req.query.status } },
			order: [['updatedAt', 'DESC']],
			include: [req.db.contact],
			limit: req.query.limit,
			offset: req.query.offset,
		})
		const result = calls.map(call => {
			return {
				callId: call.id,
				number: call.contact.number,
				status: call.status,
				createdAt: call.createdAt,
				updatedAt: call.updatedAt,
			}
		})
		return res.send(result)
	} catch (err) {
		return next(new VError(err, 'Unexpected error in the main middleware for the GET /calls endpoint'))
	}
}

module.exports = [validation, main]