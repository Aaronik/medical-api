# bridge-api
A GQL server that bridges external APIs and maybe more... 🔥🔥🔥

## Development

We use docker for development, so you'll need to have `docker` and `docker-compose` installed.

To start developing, all you need to run is `npm run start:docker`. From there the server will
be running. You can modify code and the server will automatically restart on changes.

#### GQL Development

We expose `http://localhost:4000` (using docker or not). This is a webpage you can visit to find
GraphQL Playground. With this tool, you can easily see your schema and run sample queries. It's
super handy. Note you can change the port by specifying the `PORT` environment variable.

#### Migrations

To add a migration, please use the command `npm run generate-migration`. This will create a new
migration file in the 'migrations/' directory with up/down scaffolding.

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
* From there, you can run `npm run start` and the node server will start, connecting to your mysql instance.
