'use strict'

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

	const contact = require('./models/contact')(sequelize, Sequelize)
	const call = require('./models/call')(sequelize, Sequelize)
	call.belongsTo(contact)

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