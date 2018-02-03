# fun-with-webhooks

This project is my solution to the [Teravoz Challenge](https://github.com/teravoz/challenge).

## Experimenting with the project

### Pre-requisite

The application requires a RabbitMQ server; we can set one up easily using a Docker container. Make sure you have Docker installed and run the following command:

    $ sudo docker run -d --hostname rabbitmq-webhooks --name rabbitmq-webhooks -p 8080:15672 -p 5672:5672 rabbitmq:3-management

### Tests

The application isn't very complex, therefore, I decided to go mostly with integration tests, it helped me ensure it was behaving correctly. Some integration tests require a RabbitMQ server, they will use Docker containers on the same image used on the previous topic, therefore, make you have this image, `rabbitmq:3-management`, pulled.

    $ sudo docker pull rabbitmq:3-management

Then you can execute the tests, but remember to execute them as root. The Docker API is used to start and stop containers, therefore, you need privileges to interact with it.

    $ npm install
    $ sudo npm test

### Understanding and running the applications in order

The solution is composed of 2 Node.js applications, each one with its own configuration file (`src/config.js`) with predefined settings so that you can start them with a simple `npm start`. Both are HTTP servers storing data in SQLite databases (one for each) and will make use of RabbitMQ for certain operations. It should be noticed that both applications are sharing the same RabbitMQ server, even though completely different queues are being used by each of them, but that is only for the sake of simplicity in the setup, in a real world scenario that would make no sense.

#### `webhook-server`

This application is composed of 3 subdivisions:
1. An HTTP server responsible for mocking the `/webhook` endpoint. Here's how it works, client sends a POST request to it with its name (for registration purposes) and a callback URL, the endpoint creates an account for this client and stores it in the database. Events will be sent to this callback URL and in 10 seconds an HTTP response with the status code 200 is expected to be returned. In case this criteria is not met, after 3 attempts, not consecutively, the account will be disabled and no other events will be sent to it. In order to enable the account again, the client will have to send another request to the `/webhook` endpoint. (`webhook-server/src/express.js`)
2. A background task responsible for generating fake call events. Those fake call events will be generated for the clients with enabled accounts and will be sent to a RabbitMQ queue. (`webhook-server/src/background-tasks/random-calls-producer.js`)
3. Another background task, this one is responsible for notifying the clients of call events through the registered callback URL. The events will be consumed from the RabbitMQ queue to which the previous background task is publishing the fake call events. (`webhook-server/src/background-tasks/notifier.js`)

##### Running it

This application should be executed first, so that the another one explained in the next topic can register itself on the `/webhook` endpoint.

    $ cd webhook-server
    $ npm install
    $ npm start

##### Configuration file (`webhook-server/src/config.js`)

Property Name          | Default Value                    | Description
-----------------------|----------------------------------|-------------
`server-port`          | `9000`                           | Port to which the HTTP server will listen.
`sqlite-file`          | `"~/webhook-registry.sqlite"`    | Name of the SQLite database file.
`rabbitmq-uri`         | `"amqp://guest:guest@localhost"` | URI to the RabbitMQ server.
`rabbitmq-calls-queue` | `"calls"`                        | Queue from which the messages will be read.
`rabbitmq-prefetch`    | `30`                             | How many messages will be taken from the queue without acknowledgment. Used to restrict the amount of concurrent requests to callback URLs the server will do.
`request-timeout-ms`   | `10000`                          | Client applications are supposed to answer in X milliseconds. We can't wait forever because that would lock the server, and prevent it from notifying other clients. (Related to the `rabbitmq-prefetch` property)
`log-file`             | `"~/webhook-registry.log"`       | Location to which the log file will be written to.

#### `webhook-consumer`

This application is composed of 3 subdivisions, although a bit different from the previous application:
1. When it starts, it registers itself on the first application's `/webhook` endpoint by sending an HTTP request to it. (`webhook-consumer/src/webhook.js`)
2. An HTTP server with a `/calls` endpoint responsible for receiving call events. It first checks its type for `call.standby`; in case it it follows by checking wether or not this call is a first time contact by looking for the contact number in the database; in case it is the call is delegated to a RabbitMQ queue for a specialized extension number in the call center, which is `900`; in case it is not, it is delegated to the queue for the extension number `901`. It should be noticed that contact numbers, and data for each call event and its current status in the call center are being stored in the database. This data is provided through endpoints used by the dashboard application you can check at `/` through your browser. (`webhook-consumer/src/express.js`)
3. A background task responsible for mocking the call center, it basically consumes the messages sent to both extension numbers' queues. Taking 3 seconds for calls sent to `900` and 2 seconds for the ones sent to `901`. (`webhook-consumer/src/background-tasks/calls-handler.js`)

##### Running it

This application should be executed after the `webhook-server`, so that in can register itself on the webhook.

    $ cd webhook-consumer
    $ npm install
    $ npm start

##### Configuration file (`webhook-consumer/src/config.js`)

Property Name          | Default Value                     | Description
-----------------------|-----------------------------------|-------------
`server-port`          | `9001`                            | Port to which the HTTP server will listen.
`sqlite-file`          | `"~/webhook-consumer.sqlite"`       | SQLite database file path.
`client-name`          | `"webhook-consumer"`                | Name used to register the application on the webhook.
`webhook-server-url`   | `"http://localhost:9000/webhook"` | The webhook server URL with the endpoint.
`callback-url`         | `"http://localhost:9001/calls"`   | The callback URL to which the call events will be sent.
`rabbitmq-uri`         | `"amqp://guest:guest@localhost"`  | URI to the RabbitMQ server.
`rabbitmq-900-queue`   | `"webhook-consumer-900"`            | Queue for the extension number `900`
`rabbitmq-901-queue`   | `"webhook-consumer-901"`            | Queue for the extension number `901`
`rabbitmq-prefetch`    | `2`                               | Number of concurrent calls the each instance of the background task previously mentioned can handle.
`log-file`             | `"~/webhook-consumer.log"`          | Location to which the log file will be written to.

##### Screenshot of the dashboard in action

![Dashboard](https://i.imgur.com/4l0bY00.png)
