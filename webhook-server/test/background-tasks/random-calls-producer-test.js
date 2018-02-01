'use strict'

const test = require('ava').test

const callSchema = require('../../src/background-tasks/call-schema')
const RandomCallsProducer = require('../../src/background-tasks/random-calls-producer')
const helpers = require('../helpers')

process.on('unhandledRejection', (reason, p) => {
	throw reason
})
process.on('uncaughtException', (err) => {
	throw err
})

test.beforeEach(async (t) => {
	t.context.db = await helpers.createTemporaryDB()
	t.context.container = await helpers.createRabbitMQContainer()
})

test.afterEach(async (t) => {
	await t.context.container.control.stop()
	await t.context.container.control.remove()
})

test('RandomCallsProducer | should produce random calls for an existing client once initialized', (t) => {
	t.plan(3)
	return new Promise(async (resolve, reject) => {
		try {
			// creating a client
			const client = {
				name: 'client-1',
				callbackURL: 'http://mocked.com/calls',
			}
			await t.context.db.client.create(client)

			const callContactNumber = '(11) 1111-1111'

			// setting up a RandomCallsProducer instance
			const randomCallsProducer = new RandomCallsProducer(t.context.db, t.context.container.uri, helpers.callsQueue, [callContactNumber], 60000)
			randomCallsProducer.on('error', (err) => {
				return reject(err)
			})

			// setting up a consumer for the queue to which the RandomCallsProducer will send the calls
			const basicConsumer = new helpers.BasicConsumer(t.context.container.uri, helpers.callsQueue, 1, async (content) => {
				const result = callSchema.validate(content)

				t.falsy(result.error)
				t.is(content.name, client.name)
				t.is(content.contactNumber, callContactNumber)

				await randomCallsProducer.stop()
				await basicConsumer.stop()
				return resolve()
			})
			basicConsumer.on('error', (err) => {
				return reject(err)
			})
			await basicConsumer.init()

			// initializing the RandomCallsProducer
			await randomCallsProducer.init()
		} catch (err) {
			return reject(err)
		}
	})
})