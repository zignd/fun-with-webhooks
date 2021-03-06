'use strict'

module.exports = {
	'server-port': 9001,
	'sqlite-file': '~/webhook-consumer.sqlite',
	'client-name': 'webhook-consumer',
	'webhook-server-url': 'http://localhost:9000/webhook',
	'callback-url': 'http://localhost:9001/calls',
	'rabbitmq-uri': 'amqp://guest:guest@localhost',
	'rabbitmq-900-queue': 'webhook-consumer-900',
	'rabbitmq-901-queue': 'webhook-consumer-901',
	'rabbitmq-prefetch': 2,
	'log-file': '~/webhook-consumer.log',
}