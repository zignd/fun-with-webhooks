'use strict'

function client(sequelize, DataTypes) {
	return sequelize.define('client', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			allowNull: false,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING,
			unique: true,
			allowNull: false,
		},
		callbackURL: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		errorsCounter: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		enabled: {
			type: DataTypes.INTEGER,
			defaultValue: true,
			allowNull: false,
		},
	})
}

module.exports = client