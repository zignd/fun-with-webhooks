'use strict'

const amqp = require('amqplib')
const VError = require('verror')

const helper = require('./helper')

async function connectToQueue(uri, queue) {
	let conn = null
	let count = 0
	while (count++ < 3) {
		try {
			conn = await amqp.connect(uri)
			break
		} catch (err) {
			if (count === 3) {
				throw new VError(err, 'Failed to connect to the RabbitMQ server')
			}
			await helper.sleepAsync(15000)
		}
	}
	
	const ch = await conn.createChannel()
	await ch.assertQueue(queue)
	return {
		conn,
		ch,
	}
}

module.exports = {
	connectToQueue,
}