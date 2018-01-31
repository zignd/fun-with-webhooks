'use strict'

const Joi = require('joi')

const callSchema = Joi.object().keys({
	name: Joi.string().min(3).max(255).required(),
	contactNumber: Joi.string().length(14).required(),
})

module.exports = callSchema