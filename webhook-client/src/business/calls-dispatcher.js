'use strict'

const EventEmitter = require('events')
const Op = require('sequelize').Op
const VError = require('verror')

const statusEnum = require('../models/status-enum')
const rabbitmq = require('../rabbitmq')

class CallsDispathcer extends EventEmitter {
	constructor(db, uri, queue900, queue901) {
		super()

		this._db = db
		this._uri = uri
		this._queue900 = queue900
		this._queue901 = queue901
	}

	async sendToSpecializedExtensionNumber(contactNumber) {
		let contact = await this._db.contact.findOne({ where: { number: { [Op.eq]: contactNumber } } })

		let existingContact = true
		if (!contact) {
			existingContact = false
			contact = await this._db.contact.create({
				number: contactNumber,
			})
		}

		const call = await this._db.call.create({
			contactId: contact.id,
			status: statusEnum.Waiting,
		})

		const queue = existingContact ? this._queue901 : this._queue900
		const { conn, ch } = await rabbitmq.connectToQueue(this._uri, queue)
		const b = Buffer.from(JSON.stringify({
			callId: call.id,
		}))
		try {
			await ch.sendToQueue(queue, b)
		} catch (err) {
			throw new VError(err, 'Failed to dispatch call to specialized queue')
		} finally {
			await ch.close()
			await conn.close()
		}
	}
}


module.exports = CallsDispathcer