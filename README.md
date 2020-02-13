# bridge-api
A GQL server that bridges external APIs and maybe more... 🔥🔥🔥

## Development

We use docker for development, so you'll need to have `docker` and `docker-compose` installed.
You'll also need `npm` so you can install dependencies.

The first time you start developing on this app, run:

* `npm install`
* `npm run start:docker`
* `npm run migrations:docker:run`

Every subsequent time you can just run `npm run start:docker`. A convenience
script is `npm run up`, which is just an alias for `start:docker`. I personally have `npm run`
aliased to `nr`, so my flow looks like `nr up` and then I start editing code. The docker instance
is watching for code modifications and automatically restarts on changes.

#### GQL Development

We expose `http://localhost:4000` (using docker or not). This is a webpage you can visit to find
GraphQL Playground. With this tool, you can easily see your schema and run sample queries. It's
super handy. Note you can change the port by specifying the `PORT` environment variable.

#### Migrations

To add a migration, please use the command `npm run generate-migration`. This will create a new
migration file in the 'migrations/' directory with up/down scaffolding.

#### Testing

The tests can be run by first bringing up the docker services, then running the test command.

* `npm run start:docker`
* `npm run test`

You can activate a test watcher with `npm run test:watch`.

## Deployment

If docker is available, you can simply run `NODE_ENV=production npm run start:docker`.
However, if you want to launch it raw, you can:

* Create a mysql instance somewhere
* Populate the following environment variables:
  * `PORT`: What port the GQL server should listen on
  * `DB_HOST`: the database hostname (for use with the `-h` flag for the `mysql-client` program)
  * `DB_USER`: the user
  * `DB_PASSWORD`: the password
  * `DB_DB`: the name of the database we use.
* From there, you can run `npm run build` to transpile the server.
* Then, `npm run start` and the node server will start.
