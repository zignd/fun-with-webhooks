'use strict'

const amqp = require('amqplib')

async function connectToQueue(uri, queue) {
	const conn = await amqp.connect(uri)
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