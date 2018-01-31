'use strict'

const bodyParser = require('body-parser')
const express = require('express')

const webhook = require('./routes/webhook')

function addDb(db) {
	return function (req, res, next) {
		req.db = db
		next()
	}
}

function errorHandler(err, req, res, next) {
	if (global.log) {
		global.log.error(err)
	}
	res.status(500).send({ message: 'An unexpected error occurred.' })
}

function createApp(db, port) {
	const app = express()
	app.use(addDb(db))
	app.use(bodyParser.json())
	app.post('/webhook', webhook)
	app.use(errorHandler)
	app.set('port', port)
	return app
}

module.exports = {
	createApp,
}