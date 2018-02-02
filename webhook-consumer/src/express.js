'use strict'

const bodyParser = require('body-parser')
const express = require('express')
const path = require('path')

const calls = require('./routes/calls')

function addDb(db) {
	return function (req, res, next) {
		req.db = db
		next()
	}
}

function addConfig(cfg) {
	return function (req, res, next) {
		req.cfg = cfg
		next()
	}
}

function errorHandler(err, req, res, next) {
	if (global.log) {
		global.log.error(err)
	}
	res.status(500).send({ message: 'An unexpected error occurred.' })
}

function createApp(db, cfg) {
	const app = express()

	app.use(addDb(db))
	app.use(addConfig(cfg))
	app.use(bodyParser.json())

	app.use(express.static(path.join(__dirname, '../client/build')))
	app.post('/calls', calls)
	app.get('*', function (req, res) {
		res.sendFile(path.join(__dirname, '../client/build/index.html'))
	})

	app.use(errorHandler)

	return app
}

module.exports = {
	createApp,
}