'use strict'

module.exports = {
	'server-port': 9000,
	'sqlite-file': '~/webhook-registry.sqlite',
	'rabbitmq-uri': 'amqp://guest:guest@localhost',
	'rabbitmq-calls-queue': 'calls',
	'rabbitmq-prefetch': 30,
	'request-timeout-ms': 10000,
	'log-file': '~/webhook-registry.log',
}