'use strict'

const docker = new (require('dockerode'))()
const EventEmitter = require('events')
const getPort = require('get-port')
const tmp = require('tmp')
const VError = require('verror')
const util = require('util')

const rabbitmq = require('../../src/rabbitmq')
const sqlite = require('../../src/sqlite')

class BasicConsumer extends EventEmitter {
	constructor(uri, queue, prefetchCount, handler) {
		super()

		this._uri = uri
		this._queue = queue
		this._prefetchCount = prefetchCount
		this._handler = handler

		this._initialized = false
		this._isStopping = false
	}

	async init() {
		try {
			({ conn: this._conn, ch: this._ch } = await rabbitmq.connectToQueue(this._uri, this._queue))
			this._conn.on('close', () => {
				if (!this._isStopping)
					this.emit('error', new VError('RabbitMQ connection closed for an unexpected reason'))
			})
			this._conn.on('error', (err) => {
				if (!this._isStopping)
					this.emit('error', new VError(err, 'An error occurred in the connection to the RabbitMQ server'))
			})

			await this._ch.prefetch(this._prefetchCount)
			await this._ch.consume(this._queue, async (msg) => {
				try {
					const content = JSON.parse(msg.content.toString())
					await this._handler(content)
					await this._ch.ack(msg)
				} catch (err) {
					if (!this._isStopping)
						this.emit('error', new VError(err, 'Failed to consume the message'))
				}
			})
		} catch (err) {
			throw new VError(err, 'Failed to initialize BasicConsumer')
		}
		this._initialized = true
	}

	async stop() {
		if (!this._initialized)
			return

		this._isStopping = true
		await this._conn.close()
	}
}

async function createTemporaryDB() {
	const db = await sqlite.setup(tmp.fileSync({ postfix: '.sqlite' }).name)
	return db
}

async function createRabbitMQContainer() {
	const randomPort = await getPort()
	const container = await docker.createContainer({
		Image: 'rabbitmq:3-management',
		Hostname: 'rabbitmq-webhooks',
		PortBindings: {
			'5672/tcp': [{ HostPort: randomPort.toString() }],
		},
	})
	await container.start()
	return {
		control: container,
		uri: util.format('amqp://guest:guest@localhost:%s', randomPort),
	}
}

module.exports = {
	BasicConsumer,
	Queue900: 'webhook-consumer-900',
	Queue901: 'webhook-consumer-901',
	createTemporaryDB,
	createRabbitMQContainer,
}