'use strict'

const test = require('ava').test
const Op = require('sequelize').Op
const supertest = require('supertest')

const express = require('../../src/express')
const helpers = require('../helpers')

test.beforeEach(async (t) => {
	t.context.db = await helpers.createTemporaryDB()
})

test('[validation, main] | should register a client on the webhoook', (t) => {
	t.plan(3)
	return new Promise(async (resolve, reject) => {
		try {
			const app = express.createApp(t.context.db, true)
			app.use(function (err, req, res, next) {
				return reject(err)
			})

			const clientName = 'client-1'

			const body = {
				name: clientName,
				callbackURL: 'http://test.com/calls',
			}
			await supertest(app)
				.post('/webhook')
				.send(body)
				.set('Content-Type', 'application/json')
				.expect(200)

			const client = await t.context.db.client.findOne({ where: { name: { [Op.eq]: clientName } } })
			t.truthy(client)
			t.is(client.name, body.name)
			t.is(client.callbackURL, body.callbackURL)

			return resolve()
		} catch (err) {
			return reject(err)
		}
	})
})