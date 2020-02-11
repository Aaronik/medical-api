import Knex from 'knex'
import { ApolloServer } from 'apollo-server'
import typeDefs from './src/schema'

const knexConfig = require('./knexfile')

const knex = Knex(knexConfig)

knex.raw('show tables;').then(resp => console.log('Server is connected to db, tables:', resp[0]))

const server = new ApolloServer({ typeDefs })

server.listen().then(({ url }) => {
  console.log(`🚀 GQL server ready at ${url}`)
})
