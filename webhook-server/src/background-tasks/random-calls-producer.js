'use strict'

const Bluebird = require('bluebird')
const EventEmitter = require('events')
const Op = require('sequelize').Op
const VError = require('verror')

const rabbitmq = require('../rabbitmq')

class RandomCallsProducer extends EventEmitter {
	constructor(db, uri, callsQueue) {
		super()

		this._db = db
		this._uri = uri
		this._callsQueue = callsQueue

		this._initialized = false
		this._isStopping = false
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
			
			await this._ch.assertQueue(this._callsQueue)
			this._intervalID = setInterval(async () => {
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
					this.emit('error', new VError(err, 'Failed to produce a batch of random calls'))
				}
			}, 10000)
		} catch (err) {
			throw new VError(err, 'Failed to initialize RandomCallsProducer')
		}
		this._initialized = true
	}

	_randomContactNumbers() {
		const contactNumbers = [
			'(11) 1111-1010',
			'(11) 1111-1111',
			'(11) 2222-2222',
			'(11) 3333-3333',
			'(11) 4444-4444',
			'(11) 5555-5555',
			'(11) 6666-6666',
			'(11) 7777-7777',
			'(11) 8888-8888',
			'(11) 9999-9999',
		]
		const randomlyChosen = []
		for (let counter = 0; counter < 5; counter++) {
			while (true) {
				const randomIndex = Math.floor(Math.random() * 10)
				if (randomlyChosen.indexOf(contactNumbers[randomIndex]) === -1) {
					randomlyChosen.push(contactNumbers[randomIndex])
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
		await this._ch.close()
		await this._conn.close()
	}
}

module.exports = RandomCallsProducer