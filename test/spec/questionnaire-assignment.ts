import { gql } from 'apollo-server'
import { TestModuleExport } from 'test/runner'
import * as T from 'types'

const CHOICE_QUESTIONS_SUBFRAGMENT = `
  id
  type
  text
  options {
   id
   text
  }
  next {
   includes
   equals
   nextQuestionId
  }
`

const NON_CHOICE_QUESTIONS_SUBFRAGMENT = `
  id
  type
  text
  next {
    includes
    equals
    nextQuestionId
  }
`

// Questions, since they're unions, require an unwieldy fragment. Here it is for reuse.
const QUESTIONS_FRAGMENT = gql`
  {
    ... on BooleanQuestion {
      boolResp: response
      ${NON_CHOICE_QUESTIONS_SUBFRAGMENT}
    }
    ... on TextQuestion {
      textResp: response
      ${NON_CHOICE_QUESTIONS_SUBFRAGMENT}
    }
    ... on SingleChoiceQuestion {
      singleChoiceResp: response {
        id
        text
      }
      ${CHOICE_QUESTIONS_SUBFRAGMENT}
    }
    ... on MultipleChoiceQuestion {
      multipleChoiceResp: response {
        id
        text
      }
      ${CHOICE_QUESTIONS_SUBFRAGMENT}
    }
  }
`

const CREATE_QUESTIONNAIRE_ASSIGNMENT = gql`
  mutation CreateQuestionnaireAssignment($assignment: QuestionnaireAssignmentInput!) {
    createQuestionnaireAssignment(assignment: $assignment) {
      id
    }
  }
`

const UPDATE_QUESTIONNAIRE_ASSIGNMENT = gql`
  mutation UpdateQuestionnaireAssignment($assignment: QuestionnaireAssignmentUpdateInput!) {
    updateQuestionnaireAssignment(assignment: $assignment) {
      id
    }
  }
`

const DELETE_QUESTIONNAIRE_ASSIGNMENT = gql`
  mutation DeleteQuestionnaireAssignment($id: Int!) {
    deleteQuestionnaireAssignment(id: $id)
  }
`

const QUESTIONNAIRES_ASSIGNED_TO_ME = gql`
  query {
    questionnairesAssignedToMe {
      id
      assignmentInstanceId
      questions ${QUESTIONS_FRAGMENT}
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

const CREATE_QUESTIONNAIRE = gql`
  mutation CreateQuestionnaire($title: String, $questions: [QuestionInput]){
    createQuestionnaire(title: $title, questions: $questions) {
      id
    }
  }
`

const MY_QUESTIONNAIRE_ASSIGNMENTS = gql`
  query {
    questionnaireAssignmentsIMade {
      assigneeId
      repeatInterval
    }
  }
`

const QUESTIONNAIRES_FOR_MY_PATIENT = gql`
  query PatientQuestionnaireResponses($patientId: Int!) {
    patientQuestionnaireResponses(patientId: $patientId) {
      assignmentInstanceId
      questions ${QUESTIONS_FRAGMENT}
    }
  }
`

const ASSIGN_PATIENT_TO_DOCTOR = gql`
  mutation AssignPatientToDoctor($patientId: Int!, $doctorId: Int!) {
    assignPatientToDoctor(patientId: $patientId, doctorId: $doctorId)
  }
`

const SUBMIT_BOOLEAN_RESPONSE = gql`
  mutation SubmitBoolean($questionId: Int!, $assignmentInstanceId: Int!, $value: Boolean!) {
    submitBooleanQuestionResponse(questionId: $questionId, assignmentInstanceId: $assignmentInstanceId, value: $value)
  }
`

const SUBMIT_TEXT_RESPONSE = gql`
  mutation SubmitText($questionId: Int!, $assignmentInstanceId: Int!, $value: String!) {
    submitTextQuestionResponse(questionId: $questionId, assignmentInstanceId: $assignmentInstanceId, value: $value)
  }
`

const SUBMIT_CHOICE_RESPONSE = gql`
  mutation SubmitChoice($questionId: Int!, $assignmentInstanceId: Int!, $optionId: Int!) {
    submitChoiceQuestionResponse(questionId: $questionId, assignmentInstanceId: $assignmentInstanceId, optionId: $optionId)
  }
`

const SUBMIT_CHOICE_RESPONSES = gql`
  mutation SubmitChoice($questionId: Int!, $assignmentInstanceId: Int!, $optionIds: [Int]!) {
    submitChoiceQuestionResponses(questionId: $questionId, assignmentInstanceId: $assignmentInstanceId, optionIds: $optionIds)
  }
`


const QUESTIONNAIRE_TITLE = 'questionnaire title'
const QUESTIONNAIRE_QUESTIONS: Omit<Omit<T.Question, 'id'>, 'questionnaireId'>[] = [
  {
    type: 'BOOLEAN',
    text: 'Sample Boolean Question',
  },
  {
    type: 'TEXT',
    text: 'Sample Text Question',
  },
  {
    type: 'SINGLE_CHOICE',
    text: 'Sample Single Choice Question',
    options: [ { text: 'text' } as T.QuestionOption ],
  },
  {
    type: 'MULTIPLE_CHOICE',
    text: 'Sample Multiple Choice Question',
    options: [ { text: 'text' } as T.QuestionOption, { text: 'moar' } as T.QuestionOption ],
  },
]


export const test: TestModuleExport = (test, query, mutate, knex, db, server) => {

  test('GQL Questionnaire Assignments: creation, update, deletion, retrieval by doc/patient, answering', async t => {
    await db._util.clearDb()

    // Grab the patient's id
    const { data: { me: { id: patientId }}} = await query(server).noError().asPatient({ query: ME })

    // Grab the doctor's id
    const { data: { me: { id: doctorId }}} = await query(server).noError().asDoctor({ query: ME })

    // Create the questionnaire as a doctor
    const { data: { createQuestionnaire: { id: questionnaireId }}} = await mutate(server).noError()
      .asDoctor({ mutation: CREATE_QUESTIONNAIRE, variables: { title: QUESTIONNAIRE_TITLE, questions: QUESTIONNAIRE_QUESTIONS }})

    // Test to make sure doctors can't assign questionnaires to users who are not their own patients (this before we make the patient assignment)
    {
      const { errors } = await mutate(server).asDoctor({ mutation: CREATE_QUESTIONNAIRE_ASSIGNMENT, variables: { assignment: { questionnaireId, assigneeId: patientId, repeatInterval: 1 }}})
      t.ok(errors, 'Doctors cannot assign questionnaires to users other than their patients')
    }

    // Assign patient to doctor
    await mutate(server).noError().asAdmin({ mutation: ASSIGN_PATIENT_TO_DOCTOR, variables: { patientId, doctorId }})

    // Assign the questionnaire to the patient
    const { data: { createQuestionnaireAssignment: { id: assignmentId }}} = await mutate(server).noError()
      .asDoctor({ mutation: CREATE_QUESTIONNAIRE_ASSIGNMENT, variables: { assignment: { questionnaireId, assigneeId: patientId, repeatInterval: 1 }}})

    // Test to make sure the patient can see their new questionnaire
    {
      // Grab the questionnaire from the patient's perspective
      const { data: { questionnairesAssignedToMe }} = await query(server).noError().asPatient({ query: QUESTIONNAIRES_ASSIGNED_TO_ME })
      t.equal(questionnairesAssignedToMe[0].id, questionnaireId, 'Patients can see questionnaires assigned to them')
    }

    // Test to make sure the doctor can see the questionnaire assignments they've made
    {
      const { data: { questionnaireAssignmentsIMade }} = await query(server).noError().asDoctor({ query: MY_QUESTIONNAIRE_ASSIGNMENTS })
      t.deepEqual(questionnaireAssignmentsIMade, [{ assigneeId: patientId, repeatInterval: 1 }], 'Doctors can see the assignments they\'ve created')
    }

    // Patient submits responses to the questionnaire
    {
      const { data: { questionnairesAssignedToMe }} = await query(server).noError().asPatient({ query: QUESTIONNAIRES_ASSIGNED_TO_ME })
      const { assignmentInstanceId, questions } = questionnairesAssignedToMe[0]
      await mutate(server).noError().asPatient({ mutation: SUBMIT_BOOLEAN_RESPONSE, variables: { questionId: questions[0].id, value: true, assignmentInstanceId }})
      await mutate(server).noError().asPatient({ mutation: SUBMIT_TEXT_RESPONSE, variables: { questionId: questions[1].id, value: 'text answer', assignmentInstanceId }})
      await mutate(server).noError().asPatient({ mutation: SUBMIT_CHOICE_RESPONSE, variables: {
        questionId: questions[2].id,
        optionId: questions[2].options[0].id,
        assignmentInstanceId
      }})
      await mutate(server).noError().asPatient({ mutation: SUBMIT_CHOICE_RESPONSES, variables: {
        questionId: questions[3].id,
        optionIds: questions[3].options.map(o => o.id), // select 'em all
        assignmentInstanceId
      }})}

    // Test to make sure the doctor can see the patients' questionnaire responses
    {
      const { data: { patientQuestionnaireResponses }} = await query(server).noError()
        .asDoctor({ query: QUESTIONNAIRES_FOR_MY_PATIENT, variables: { patientId }})
      const { questions } = patientQuestionnaireResponses[0]
      t.deepEqual(questions[0].boolResp, true, 'Doctors can see their patients\' questionnaire responses')
      t.deepEqual(questions[1].textResp, 'text answer', 'Doctors can see their patients\' questionnaire responses')
      t.deepEqual(questions[2].singleChoiceResp, questions[2].options[0], 'Doctors can see their patients\' questionnaire responses')
      t.deepEqual(questions[3].multipleChoiceResp, questions[3].options, 'Doctors can see their patients\' questionnaire responses')
    }

    // Test to ensure doctor cannot request patient that does not belong to them
    {
      const { errors } = await query(server)
        .asDoctor({ query: QUESTIONNAIRES_FOR_MY_PATIENT, variables: { patientId: -1 }})
      t.ok(errors[0], 'A doctor cannot request responses from a patient that is not theirs')
    }

    // Update the assignment
    await mutate(server).noError().asDoctor({ mutation: UPDATE_QUESTIONNAIRE_ASSIGNMENT, variables: { assignment: { id: assignmentId, repeatInterval: 100 }}})

    // Test to ensure update worked
    {
      const { data: { questionnaireAssignmentsIMade }} = await query(server).noError().asDoctor({ query: MY_QUESTIONNAIRE_ASSIGNMENTS })
      t.equal(questionnaireAssignmentsIMade[0].repeatInterval, 100, 'Doctors can update their assignments')
    }

    // Now we can delete the assignment
    await mutate(server).noError().asDoctor({ mutation: DELETE_QUESTIONNAIRE_ASSIGNMENT, variables: { id: assignmentId }})

    // Test that the questionnaire was successfully unassigned
    {
      const { data: { questionnaireAssignmentsIMade }} = await query(server).noError().asDoctor({ query: MY_QUESTIONNAIRE_ASSIGNMENTS })
      t.deepEqual(questionnaireAssignmentsIMade, [], 'Doctors can unassign questionnaires')
    }

    t.end()
  })

}


