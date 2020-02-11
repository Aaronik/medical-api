import * as Knex from 'knex'
const knexConfig = require('./knexfile')

const knex = Knex(knexConfig)

knex.raw('show tables;').then(resp => console.log(resp[0]))
