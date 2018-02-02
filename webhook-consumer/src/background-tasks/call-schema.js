'use strict'

const Joi = require('joi')

const callSchema = Joi.object().keys({
	callId: Joi.number().required(),
})

module.exports = callSchema