import { gql } from 'apollo-server'
import Db from 'src/db'
import Server from 'src/server'
import { ApolloServer } from 'apollo-server'
import { createTestClient } from 'apollo-server-testing'
import knex from 'test/db-connection'
import fs from 'fs'
import test from 'tape'

// This is our test runner -- it allows all the tests to be run asynchronously
// and great. Watch out for this guy, he'll rock your socks off.
//
// Usage:
// 1) Create a file in the spec/ folder.
// 2) Export an async function with the following signature:
//    export default async function(test, knex, db, server).
// 3) Enjoy yourself. Happy testing!

const db = Db(knex)
const server = Server(knex)
const files = fs.readdirSync(__dirname + '/spec')

const executions = files.map(async (file, idx) => {
  return new Promise((resolve, reject) => {
    import('./spec/' + file).then(resp => {
      const moduleTestFn = resp.default
      moduleTestFn(test, knex, db, server)
    })

    test.onFinish(resolve)
  })
})

Promise.all(executions).then(() => knex.destroy())
