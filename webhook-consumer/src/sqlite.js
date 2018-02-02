'use strict'

const path = require('path')
const resolve = require('resolve-dir')
const Sequelize = require('sequelize')

async function setup(sqliteFile) {
	const sequelize = new Sequelize({
		dialect: 'sqlite',
		storage: resolve(sqliteFile),
		logging: (value) => {
			if (global.log) {
				global.log.debug(value)
			}
		},
		operatorsAliases: false,
	})

	const call = sequelize.import(path.join(__dirname, 'models/call.js'))
	const contact = sequelize.import(path.join(__dirname, 'models/contact.js'))

	await sequelize.sync()

	return {
		sequelize,
		call,
		contact,
	}
}

module.exports = {
	setup,
}