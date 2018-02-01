'use strict'

const test = require('ava').test
const Op = require('sequelize').Op

const CallsHandler = require('../../src/background-tasks/calls-handler')
const CallsDispathcer = require('../../src/business/calls-dispatcher')
const statusEnum = require('../../src/models/status-enum')
const helpers = require('../helpers')

test.beforeEach(async (t) => {
	t.context.db = await helpers.createTemporaryDB()
	t.context.container = await helpers.createRabbitMQContainer()
})

test.afterEach(async (t) => {
	await t.context.container.control.stop()
	await t.context.container.control.remove()
})

test('CallsHandler | should handle calls for a specific extension number just like a specialized call center team', (t) => {
	t.plan(5)
	return new Promise(async (resolve, reject) => {
		try {
			const callContactNumber = '(11) 1111-1111'

			const dispatcher = new CallsDispathcer(t.context.db, t.context.container.uri, helpers.Queue900, helpers.Queue901)
			await dispatcher.sendToSpecializedExtensionNumber(callContactNumber)

			const contact = await t.context.db.contact.findOne({ where: { number: { [Op.eq]: callContactNumber } } })
			t.truthy(contact, 'Could not find the contact')

			const call = await t.context.db.call.find({ where: { contactId: { [Op.eq]: contact.id } }, order: [['updatedAt', 'DESC']] })
			t.truthy(call, 'Could not find the call')
			t.is(call.status, statusEnum.Waiting, 'The call was expected to be set to waiting at this point')

			const handler = new CallsHandler(t.context.db, t.context.container.uri, helpers.Queue900, 1, 0)
			handler.on('error', (err) => {
				return reject(err)
			})
			handler.on('handledCall', async (callId) => {
				try {
					const handledCall = await t.context.db.call.findById(callId)
					t.is(handledCall.id, call.id, 'The handled call isn\'t the one we\'re testing on')
					t.is(handledCall.status, statusEnum.Completed, 'The handled call was expected to be set to completed at this point')
					return resolve()
				} catch (err) {
					return reject(err)
				}
			})
			await handler.init()
		} catch (err) {
			return reject(err)
		}
	})
})