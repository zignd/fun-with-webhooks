'use strict'

const test = require('ava').test
const nock = require('nock')

const Notifier = require('../../src/background-tasks/notifier')
const rabbitmq = require('../../src/rabbitmq')
const helpers = require('../helpers')

test.beforeEach(async (t) => {
	t.context.db = await helpers.createTemporaryDB()
	t.context.container = await helpers.createRabbitMQContainer()
})

test.afterEach(async (t) => {
	await t.context.container.control.stop()
	await t.context.container.control.remove()
})

test('Notifier | should notify registered clients of new calls once initialized', (t) => {
	t.plan(1)
	return new Promise(async (resolve, reject) => {
		try {
			// creating a client
			const client = {
				name: 'client-1',
				callbackURL: 'http://mocked.com/calls',
			}
			await t.context.db.client.create(client)

			const callContactNumber = '(11) 1111-1111'

			// setting up a Notifier instance
			const notifier = new Notifier(t.context.db, t.context.container.uri, helpers.callsQueue, 1, 10000)
			notifier.on('clientError', (err) => {
				return reject(err)
			})
			notifier.on('error', (err) => {
				return reject(err)
			})

			// sending a call to the RabbitMQ queue, so that the Notifier can take it
			const { conn, ch } = await rabbitmq.connectToQueue(t.context.container.uri, helpers.callsQueue)
			ch.on('error', (err) => {
				return reject(err)
			})
			await ch.sendToQueue(helpers.callsQueue, Buffer.from(JSON.stringify({
				name: client.name,
				contactNumber: callContactNumber,
			})))

			// mocking the endpoint to which the Notifier will send the call
			const callsScope = nock('http://mocked.com').post('/calls', {
				type: 'call.standby',
				contactNumber: callContactNumber,
			}).reply(200)
			callsScope.on('replied', (req, interceptor) => {
				try {
					// testing if the call notification reached the registered client
					t.true(callsScope.isDone())
					return resolve()
				} catch (err) {
					return reject(err)
				}
			})

			// initializing the Notifier
			await notifier.init()

			await conn.close()
		} catch (err) {
			return reject(err)
		}
	})
})