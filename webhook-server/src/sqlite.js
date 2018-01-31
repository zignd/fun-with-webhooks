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

	const client = sequelize.import(path.join(__dirname, 'models/client.js'))

	await sequelize.sync()

	return {
		sequelize,
		client,
	}
}

module.exports = {
	setup,
}