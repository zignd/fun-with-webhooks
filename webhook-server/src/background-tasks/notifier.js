'use strict'

const EventEmitter = require('events')
const request = require('request-promise')
const Op = require('sequelize').Op
const VError = require('verror')

const callSchema = require('./call-schema')
const rabbitmq = require('../rabbitmq')

class Notifier extends EventEmitter {
	constructor(db, uri, queue, prefetchCount, requestTimeout) {
		super()

		this._db = db
		this._uri = uri
		this._queue = queue
		this._prefetchCount = prefetchCount
		this._requestTimeout = requestTimeout

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
					const result = callSchema.validate(content)
					if (result.error) {
						throw new VError({
							info: result.error.details,
						}, 'Invalid schema')
					}

					try {
						await this._notify(content)
					} catch (err) {
						this.emit('clientError', new VError({
							cause: err,
							info: { content },
						}, 'Failed to notify the client'))
					}

					await this._ch.ack(msg)
				} catch (err) {
					if (!this._isStopping)
						this.emit('error', new VError(err, 'Failed to consume the message'))
				}
			})
		} catch (err) {
			throw new VError(err, 'Failed to initialize Notifier')
		}
		this._initialized = true
	}

	async _notify(content) {
		const client = await this._db.client.findOne({ where: { name: { [Op.eq]: content.name } } })
		if (!client) {
			throw new VError({
				info: {
					name: content.name,
				},
			}, 'Failed to find a client with the provided name')
		}
		if (!client.enabled)
			return

		try {
			await request({
				method: 'POST',
				uri: client.callbackURL,
				body: {
					type: 'call.standby',
					contactNumber: content.contactNumber,
				},
				json: true,
				timeout: this._requestTimeout,
			})
		} catch (err) {
			client.errorsCounter += 1
			if (client.errorsCounter >= 3)
				client.enabled = false

			await this._db.client.update({
				errorsCounter: client.errorsCounter,
				enabled: client.enabled,
			}, { where: { id: { [Op.eq]: client.id } } })

			throw new VError({
				cause: err,
				info: {
					callbackURL: client.callbackURL,
					content,
				},
			}, 'Failed to perform the request to the callbackURL')
		}
	}

	async stop() {
		if (!this._initialized)
			return

		this._isStopping = true
		await this._conn.close()
	}
}

module.exports = Notifier