import { gql } from 'apollo-server'
import Db from 'src/db'
import Server from 'src/server'
import { ApolloServer } from 'apollo-server'
import { createTestClient } from 'apollo-server-testing'
import knex from 'test/db-connection'
import fs from 'fs'
import test from 'tape'
import { query, mutate } from 'test/query-mutate'

// This is our test runner -- it allows all the tests to be run asynchronously
// and great. Watch out for this guy, he'll rock your socks off.
//
// Usage:
// 1) Create a file in the spec/ folder.
// 2) Export a function with the signature defined as TModuleExport below.
// 3) Enjoy yourself. Happy testing!

const db = Db(knex)
const server = Server(knex)
const files = fs.readdirSync(__dirname + '/spec')

// x's are to prevent typescript's brain from imploding
export type TestModuleExport = (
  testx: typeof test,
  queryx: typeof query,
  mutatex: typeof mutate,
  knexx: typeof knex,
  dbx: typeof db,
  serverx: typeof server
) => void

// Run all the tests.
// 1) Rollback all migrations,
// 2) Migrate to latest.
// This helps us ensure that firstly, the DB is clean and up
// to date. It also enforces good migration up/down coding.
// 3) Bring in the specs,
// 4) Run them.
db._util.migrateDownAndUp().then(() => {
  const executions = files.map((file, idx) => {
    return new Promise((resolve, reject) => {
      import('./spec/' + file).then(resp => {
        const moduleTestFn = resp.test as TestModuleExport
        moduleTestFn(test, query, mutate, knex, db, server)
      })

      test.onFinish(resolve)
    })
  })

  Promise.all(executions).finally(() => knex.destroy())
})

