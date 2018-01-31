'use strict'

const EventEmitter = require('events')
const Joi = require('joi')
const Op = require('sequelize').Op
const VError = require('verror')

const statusEnum = require('../models/status-enum')
const rabbitmq = require('../rabbitmq')

class CallsHandler extends EventEmitter {
	constructor(db, uri, queue, prefetchCount, sleepMs) {
		super()

		this._db = db
		this._uri = uri
		this._queue = queue
		this._prefetchCount = prefetchCount
		this._sleepMs = sleepMs

		this._initialized = false
		this._isStopping = false
		this._callSchema = Joi.object().keys({
			callId: Joi.number().required(),
		})
	}

	async init() {
		try {
			({ conn: this._conn, ch: this._ch } = await rabbitmq.connectToQueue(this._uri, this._queue))
			this._ch.on('close', () => {
				if (!this._isStopping) {
					this.emit('error', new VError('RabbitMQ channel closed for an unexpected reason'))
				}
			})
			this._ch.on('error', (err) => {
				this.emit('error', new VError(err, 'An error occurred in the connection to the RabbitMQ server'))
			})

			await this._ch.prefetch(this._prefetchCount)
			await this._ch.consume(this._queue, async (msg) => {
				try {
					const content = JSON.parse(msg.content.toString())
					const result = this._callSchema.validate(content)
					if (result.error) {
						throw new VError({
							info: result.error.details,
						}, 'Invalid schema')
					}

					try {
						await this._handleCall(content.callId, this._sleepMs)
					} catch (err) {
						this.emit('consumerError', new VError({
							cause: err,
							info: { content },
						}, 'Failed to handle the call'))
					}
				} catch (err) {
					this.emit('consumerError', new VError(err, 'Malformed message content'))
				}

				await this._ch.ack(msg)
			})
		} catch (err) {
			throw new VError(err, 'Failed to initialize CallsHandler')
		}
		this._initialized = true
	}

	async _handleCall(id, ms) {
		const call = await this._db.call.findById(id)
		if (!call)
			throw new VError({ info: { id } }, 'Could not find a call with the provided id')
		
		await this._db.call.update({
			status: statusEnum.Active,
		}, { where: { id: { [Op.eq]: call.id } } })
		
		await this._sleepAsync(ms)
	
		await this._db.call.update({
			status: statusEnum.Completed,
		}, { where: { id: { [Op.eq]: call.id } } })
	}

	_sleepAsync(ms) {
		return new Promise((resolve, reject) => {
			setTimeout(() => { return resolve() }, ms)
		})
	}

	async close() {
		if (!this._initialized)
			return

		this._isStopping = true
		await this._ch.close()
		await this._conn.close()
	}
}

module.exports = CallsHandler