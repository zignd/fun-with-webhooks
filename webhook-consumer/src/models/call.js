'use strict'

function call(sequelize, DataTypes) {
	return sequelize.define('call', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			allowNull: false,
			primaryKey: true,
		},
		status: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
	})
}

module.exports = call