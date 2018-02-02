'use strict'

const EventEmitter = require('events')
const Op = require('sequelize').Op
const VError = require('verror')

const callSchema = require('./call-schema')
const statusEnum = require('../models/status-enum')
const helper = require('../helper')
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
						await this._handleCall(content.callId)
						this.emit('handledCall', content.callId)
					} catch (err) {
						this.emit('error', new VError({
							cause: err,
							info: { content },
						}, 'Failed to handle the call'))
					}

					await this._ch.ack(msg)
				} catch (err) {
					this.emit('error', new VError(err, 'Failed to consume the message'))
				}
			})
		} catch (err) {
			throw new VError(err, 'Failed to initialize CallsHandler')
		}
		this._initialized = true
	}

	async _handleCall(id) {
		const call = await this._db.call.findById(id)
		if (!call) {
			this.emit('warning', new VError({ info: { id } }, 'Could not find a call with the provided id'))
			return
		}
		
		await this._db.call.update({
			status: statusEnum.Active,
		}, { where: { id: { [Op.eq]: call.id } } })
		
		await helper.sleepAsync(this._sleepMs)
	
		await this._db.call.update({
			status: statusEnum.Completed,
		}, { where: { id: { [Op.eq]: call.id } } })
	}

	async close() {
		if (!this._initialized)
			return

		this._isStopping = true
		await this._conn.close()
	}
}

module.exports = CallsHandler