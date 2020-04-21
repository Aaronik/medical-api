import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { TestModuleExport } from 'test/runner'
import * as T from 'types'

const DOCTORS = gql`
  query Doctors {
    doctors {
      id
    }
  }
`

const PATIENTS = gql`
  query Patients {
    patients {
      id
    }
  }
`

const ASSIGN_PATIENT_TO_DOCTOR = gql`
  mutation AssignPatientToDoctor($patientId: Int!, $doctorId: Int!) {
    assignPatientToDoctor(patientId: $patientId, doctorId: $doctorId)
  }
`

const UNASSIGN_PATIENT_FROM_DOCTOR = gql`
  mutation UnassignPatientFromDoctor($patientId: Int!, $doctorId: Int!) {
    unassignPatientFromDoctor(patientId: $patientId, doctorId: $doctorId)
  }
`

const USER = gql`
  query User($id: Int!) {
    user(id: $id) {
      patients{
        id
      }
      doctors{
        id
      }
    }
  }
`

const ME = gql`
  query {
    me {
      id
    }
  }
`

export const test: TestModuleExport = (test, query, mutate, knex, db, server) => {

  test('GQL Doctor Patient Relationships -- created, destroyed', async t => {
    await db._util.clearDb()

    // setup
    const { data: { me: { id: doctorId }}} = await query(server).noError().asDoctor({ query: ME })
    const { data: { me: { id: patientId }}} = await query(server).noError().asPatient({ query: ME })
    await mutate(server).noError().asAdmin({ mutation: ASSIGN_PATIENT_TO_DOCTOR, variables: { patientId, doctorId }})

    {
      // Testing creation
      const { data: { patients }} = await query(server).asDoctor({ query: PATIENTS })
      t.equal(patients[0].id, patientId)

      const { data: { doctors }} = await query(server).asPatient({ query: DOCTORS })
      t.equal(doctors[0].id, doctorId)
    }

    {
      // Testing fetching patients/doctors on user
      const { data: { user: { patients }}} = await query(server).asAdmin({ query: USER, variables: { id: doctorId }})
      t.deepEqual(patients, [{ id: patientId }])

      const { data: { user: { doctors }}} = await query(server).asAdmin({ query: USER, variables: { id: patientId }})
      t.deepEqual(doctors, [{ id: doctorId }])
    }

    // destroy
    await mutate(server).noError().asDoctor({ mutation: UNASSIGN_PATIENT_FROM_DOCTOR, variables: { patientId, doctorId }})

    {
      // Testing destroy
      const { data: { patients }} = await query(server).asDoctor({ query: PATIENTS })
      t.deepEqual(patients, [])

      const { data: { doctors }} = await query(server).asPatient({ query: DOCTORS })
      t.deepEqual(doctors, [])
    }

    t.end()
  })

}

