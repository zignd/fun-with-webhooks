'use strict'

function call(sequelize, DataTypes) {
	return sequelize.define('call', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			allowNull: false,
			primaryKey: true,
		},
		contactId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			references: {
				model: 'contacts',
				key: 'id',
			},
		},
		status: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
	})
}

module.exports = call