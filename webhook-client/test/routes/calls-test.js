'use strict'

const test = require('ava').test
const Op = require('sequelize').Op
const supertest = require('supertest')

const callSchema = require('../../src/background-tasks/call-schema')
const statusEnum = require('../../src/models/status-enum')
const express = require('../../src/express')
const helpers = require('../helpers')

test.beforeEach(async (t) => {
	t.context.db = await helpers.createTemporaryDB()
	t.context.container = await helpers.createRabbitMQContainer()
})

test('[validation, main] | should receive a call from the webhook and dispatch it to a specialized extension number', (t) => {
	t.plan(6)
	return new Promise(async (resolve, reject) => {
		try {
			const cfg = {
				'rabbitmq-uri': t.context.container.uri,
				'rabbitmq-900-queue': helpers.Queue900,
				'rabbitmq-901-queue': helpers.Queue901,
			}
			const app = express.createApp(t.context.db, cfg, true)
			app.use(function (err, req, res, next) {
				return reject(err)
			})

			const body = {
				type: 'call.standby',
				contactNumber: '(11) 1111-1111',
			}
			await supertest(app)
				.post('/calls')
				.send(body)
				.set('Content-Type', 'application/json')
				.expect(200)

			const contact = await t.context.db.contact.findOne({ where: { number: { [Op.eq]: body.contactNumber } } })
			t.truthy(contact, 'Could not find the contact')
			t.is(contact.number, body.contactNumber, 'Contact number in the database differs from the one in the request')

			const call = await t.context.db.call.find({ where: { contactId: { [Op.eq]: contact.id } }, order: [['updatedAt', 'DESC']] })
			t.truthy(call, 'Could not find the call')
			t.is(call.status, statusEnum.Waiting, 'The call was expected to be set to waiting at this point')

			const basicConsumer = new helpers.BasicConsumer(t.context.container.uri, helpers.Queue900, 1, async (content) => {
				const result = callSchema.validate(content)

				t.falsy(result.error)
				t.is(content.callId, call.id)

				await basicConsumer.stop()
				return resolve()
			})
			basicConsumer.on('error', (err) => {
				return reject(err)
			})
			await basicConsumer.init()
		} catch (err) {
			return reject(err)
		}
	})
})