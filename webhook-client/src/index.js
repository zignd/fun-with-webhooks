'use strict'

const config = require('./config')

const bodyParser = require('body-parser')
const bunyan = require('bunyan')
const http = require('http')
const resolve = require('resolve-dir')
const VError = require('verror')

const CallsHandler = require('./background-tasks/calls-handler')
const calls = require('./routes/calls')
const express = require('./express')
const sqlite = require('./sqlite')
const webhook = require('./webhook')

const init = async () => {
	console.log('Settings loaded:')
	console.dir(config, { colors: true })

	global.log = bunyan.createLogger({
		name: config['client-name'],
		streams: [{
			path: resolve(config['log-file']),
		}, {
			stream: process.stdout,
			level: 'debug',
		}],
	})
	global.log.on('error', function (err, stream) {
		console.error(err)
		console.error(stream)
		console.error('Bunyan emitted an error, it probably failed to write to one of the configured streams. The application will be shuted down.')
		process.exit(1)
	})

	const db = await sqlite.setup(config['sqlite-file'])

	const app = express.createApp(db, config)
	const server = http.createServer(app)

	const rabbitMQURI = config['rabbitmq-uri']
	const prefetchCount = config['rabbitmq-prefetch']
	const queue900 = config['rabbitmq-900-queue']
	const queue901 = config['rabbitmq-901-queue']

	const callsHandler900 = new CallsHandler(db, rabbitMQURI, queue900, prefetchCount, 3000)
	callsHandler900.on('consumerError', (err) => {
		log.error(err)
	})
	callsHandler900.on('error', (err) => {
		log.error(err)
		process.exit(1)
	})

	const callsHandler901 = new CallsHandler(db, rabbitMQURI, queue901, prefetchCount, 2000)
	callsHandler901.on('consumerError', (err) => {
		log.error(err)
	})
	callsHandler901.on('error', (err) => {
		log.error(err)
		process.exit(1)
	})
	
	try {
		const webhookServerURL = config['webhook-server-url']
		const clientName = config['client-name']
		const callbackURL = config['callback-url']
		
		server.listen(config['server-port'])
		await webhook.register(webhookServerURL, clientName, callbackURL)
		await callsHandler900.init()
		await callsHandler901.init()
	} catch (err) {
		server.close()
		await callsHandler900.close()
		await callsHandler901.close()
		throw err
	}
}

init().then(() => {
	log.info('Successfully initialized')
}).catch(err => {
	log.error(new VError(err, 'Failed to initialize'))
	process.exit(1)
})