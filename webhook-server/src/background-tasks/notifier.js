'use strict'

const EventEmitter = require('events')
const Joi = require('joi')
const request = require('request-promise')
const Op = require('sequelize').Op
const VError = require('verror')

const rabbitmq = require('../rabbitmq')

class Notifier extends EventEmitter {
	constructor(db, uri, callsQueue, prefetchCount, requestTimeout) {
		super()

		this._db = db
		this._uri = uri
		this._callsQueue = callsQueue
		this._prefetchCount = prefetchCount
		this._requestTimeout = requestTimeout

		this._initialized = false
		this._isStopping = false
		this._callSchema = Joi.object().keys({
			name: Joi.string().min(3).max(255).required(),
			contactNumber: Joi.string().length(14).required(),
		})
	}

	async init() {
		try {
			({ conn: this._conn, ch: this._ch } = await rabbitmq.connectToQueue(this._uri, this._callsQueue))
			this._ch.on('close', () => {
				if (!this._isStopping) {
					this.emit('error', new VError('RabbitMQ channel closed for an unexpected reason'))
				}
			})
			this._ch.on('error', (err) => {
				this.emit('error', new VError(err, 'An error occurred in the connection to the RabbitMQ server'))
			})

			await this._ch.prefetch(this._prefetchCount)
			await this._ch.consume(this._callsQueue, async (msg) => {
				try {
					const content = JSON.parse(msg.content.toString())
					const result = this._callSchema.validate(content)
					if (result.error) {
						throw new VError({
							info: result.error.details,
						}, 'Invalid schema')
					}

					try {
						await this._notify(content)
					} catch (err) {
						this.emit('consumerError', new VError({
							cause: err,
							info: { content },
						}, 'Failed to notify the client'))
					}
				} catch (err) {
					this.emit('consumerError', new VError(err, 'Malformed message content'))
				}

				await this._ch.ack(msg)
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
		await this._ch.close()
		await this._conn.close()
	}
}

module.exports = Notifier