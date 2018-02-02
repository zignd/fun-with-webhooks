'use strict'

function contact(sequelize, DataTypes) {
	return sequelize.define('contact', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			allowNull: false,
			primaryKey: true,
			field: 'id',
		},
		number: {
			type: DataTypes.STRING,
			allowNull: false,
			field: 'number',
		},
	}, {
		timestamps: true,
		updatedAt: false,
	})
}

module.exports = contact