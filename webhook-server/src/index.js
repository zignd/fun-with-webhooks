'use strict'

const config = require('./config')
const bunyan = require('bunyan')
const http = require('http')
const resolve = require('resolve-dir')
const VError = require('verror')

const Notifier = require('./background-tasks/notifier')
const RandomCallsProducer = require('./background-tasks/random-calls-producer')
const express = require('./express')
const sqlite = require('./sqlite')

async function init() {
	console.log('Settings loaded:')
	console.dir(config, { colors: true })

	global.log = bunyan.createLogger({
		name: 'webhook-server',
		streams: [{
			path: resolve(config['log-file']),
		}, {
			stream: process.stdout,
			level: 'debug',
		}],
	})
	global.log.on('error', (err, stream) => {
		console.error(err)
		console.error(stream)
		console.error('Bunyan emitted an error, it probably failed to write to one of the configured streams. The application will be shuted down.')
		process.exit(1)
	})

	const db = await sqlite.setup(config['sqlite-file'])

	const app = express.createApp(db, config['server-port'])
	const server = http.createServer(app)
	
	const rabbitMQURI = config['rabbitmq-uri']
	const callsQueue = config['rabbitmq-calls-queue']
	const prefetchCount = config['rabbitmq-prefetch']
	const requestTimeout = config['request-timeout-ms']

	const notifier = new Notifier(db, rabbitMQURI, callsQueue, prefetchCount, requestTimeout)
	notifier.on('clientError', (err) => {
		log.warn(err)
	})
	notifier.on('error', (err) => {
		log.error(err)
		process.exit(1)
	})

	const randomCallsProducer = new RandomCallsProducer(db, rabbitMQURI, callsQueue)
	randomCallsProducer.on('error', (err) => {
		log.error(err)
		process.exit(1)
	})

	try {
		server.listen(config['server-port'])
		await notifier.init()
		await randomCallsProducer.init()
	} catch (err) {
		server.close()
		await notifier.stop()
		await randomCallsProducer.stop()
		throw err
	}
}

init().then(() => {
	log.info('Successfully initialized')
}).catch(err => {
	log.error(new VError(err, 'Failed to initialize'))
	process.exit(1)
})