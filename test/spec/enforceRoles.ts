import { enforceRoles } from 'src/server'
import { TestModuleExport } from 'test/runner'
import { User } from 'src/types.d'

export const test: TestModuleExport = (test, query, mutate, knex, db, server) => {
  test('enforceRoles', t => {
    const noUser = null
    const patient = { id: 1, role: 'PATIENT'} as User
    const doctor = { id: 1, role: 'DOCTOR'} as User
    const admin = { id: 1, role: 'ADMIN'} as User

    t.doesNotThrow(() => enforceRoles(patient))
    t.doesNotThrow(() => enforceRoles(doctor))
    t.doesNotThrow(() => enforceRoles(admin))
    t.throws(() => enforceRoles(noUser))
    t.throws(() => enforceRoles(doctor, 'ADMIN'))
    t.throws(() => enforceRoles(doctor, 'PATIENT'))
    t.doesNotThrow(() => enforceRoles(admin, 'ADMIN'))

    t.end()
  })
}
