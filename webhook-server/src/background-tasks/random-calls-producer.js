'use strict'

const Bluebird = require('bluebird')
const EventEmitter = require('events')
const Op = require('sequelize').Op
const VError = require('verror')

const rabbitmq = require('../rabbitmq')

class RandomCallsProducer extends EventEmitter {
	constructor(db, uri, callsQueue, contactNumbers, intervalMs) {
		super()

		this._db = db
		this._uri = uri
		this._callsQueue = callsQueue
		this._contactNumbers = contactNumbers
		this._intervalMs = intervalMs

		this._initialized = false
		this._isStopping = false
	}

	async init() {
		try {
			({ conn: this._conn, ch: this._ch } = await rabbitmq.connectToQueue(this._uri, this._callsQueue))
			this._conn.on('close', () => {
				if (!this._isStopping)
					this.emit('error', new VError('RabbitMQ connection closed for an unexpected reason'))
			})
			this._conn.on('error', (err) => {
				if (!this._isStopping)
					this.emit('error', new VError(err, 'An error occurred in the connection to the RabbitMQ server'))
			})

			// runs immediately and after intervals
			this._publishCalls().catch((err) => {
				if (!this._isStopping)
					this.emit('error', err)
			})
			this._intervalID = setInterval(() => {
				this._publishCalls().catch((err) => {
					if (!this._isStopping)
						this.emit('error', err)
				})
			}, this._intervalMs)
		} catch (err) {
			throw new VError(err, 'Failed to initialize RandomCallsProducer')
		}
		this._initialized = true
	}

	async _publishCalls() {
		try {
			const randomlyChosen = this._randomContactNumbers()
			const clients = await this._db.client.findAll({ where: { enabled: { [Op.eq]: true } } })
			await Bluebird.map(clients, async (client) => {
				await Bluebird.map(randomlyChosen, async (contactNumber) => {
					const b = Buffer.from(JSON.stringify({
						name: client.name,
						contactNumber,
					}))
					await this._ch.sendToQueue(this._callsQueue, b)
				})
			}, { concurrency: 10 })
		} catch (err) {
			throw new VError(err, 'Failed to publish the random calls')
		}
	}

	_randomContactNumbers() {
		const randomlyChosen = []
		for (let counter = 0; counter < Math.ceil(this._contactNumbers.length / 2); counter++) {
			while (true) {
				const randomIndex = Math.floor(Math.random() * this._contactNumbers.length)
				if (randomlyChosen.indexOf(this._contactNumbers[randomIndex]) === -1) {
					randomlyChosen.push(this._contactNumbers[randomIndex])
					break
				}
			}
		}
		return randomlyChosen
	}

	async stop() {
		if (!this._initialized)
			return

		this._isStopping = true
		clearInterval(this._intervalID)
		await this._conn.close()
	}
}

module.exports = RandomCallsProducer