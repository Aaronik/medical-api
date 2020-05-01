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
    ... on EventQuestion {
      eventResp: response {
        title
        start
        end
      }
      ${NON_CHOICE_QUESTIONS_SUBFRAGMENT}
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

const SUBMIT_EVENT_RESPONSE = gql`
  mutation SubmitEvent($questionId: Int!, $assignmentInstanceId: Int!, $event: EventResponseInput!) {
    submitEventQuestionResponse(questionId: $questionId, assignmentInstanceId: $assignmentInstanceId, event: $event)
  }
`

const TIMELINE_ITEMS = gql`
  query TimelineItems($userId: Int!) {
    timelineItems(userId: $userId) {
      id
      content
      end
      group
      start
      title
      type
    }
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
  {
    type: 'EVENT',
    text: 'Sample event text',
  }
]

const getQuestionOfType = (questions: T.Question[], type: T.QuestionType) => {
  return questions.find(q => q.type === type)
}

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

      t.equal(questions.length, QUESTIONNAIRE_QUESTIONS.length, 'The questions received are the same length as those given')

      const booleanQuestion        = getQuestionOfType(questions, 'BOOLEAN')
      const textQuestion           = getQuestionOfType(questions, 'TEXT')
      const singleChoiceQuestion   = getQuestionOfType(questions, 'SINGLE_CHOICE')
      const multipleChoiceQuestion = getQuestionOfType(questions, 'MULTIPLE_CHOICE')
      const eventQuestion          = getQuestionOfType(questions, 'EVENT')

      await mutate(server).noError().asPatient({ mutation: SUBMIT_BOOLEAN_RESPONSE, variables: { questionId: booleanQuestion.id, value: true, assignmentInstanceId }})
      await mutate(server).noError().asPatient({ mutation: SUBMIT_TEXT_RESPONSE, variables: { questionId: textQuestion.id, value: 'text answer', assignmentInstanceId }})
      await mutate(server).noError().asPatient({ mutation: SUBMIT_CHOICE_RESPONSE, variables: {
        questionId: singleChoiceQuestion.id,
        optionId: singleChoiceQuestion.options[0].id,
        assignmentInstanceId
      }})
      await mutate(server).noError().asPatient({ mutation: SUBMIT_CHOICE_RESPONSES, variables: {
        questionId: multipleChoiceQuestion.id,
        optionIds: multipleChoiceQuestion.options.map(o => o.id), // select 'em all
        assignmentInstanceId
      }})
      await mutate(server).noError().asPatient({ mutation: SUBMIT_EVENT_RESPONSE, variables: {
        questionId: eventQuestion.id,
        assignmentInstanceId,
        event: { start: '1', end: '2', title: eventQuestion.text, details: eventQuestion.text }
      }})
    }

    // Test to make sure the doctor can see the patients' questionnaire responses
    {
      const { data: { patientQuestionnaireResponses }} = await query(server).noError()
        .asDoctor({ query: QUESTIONNAIRES_FOR_MY_PATIENT, variables: { patientId }})
      const { questions } = patientQuestionnaireResponses[0]

      const booleanQuestion        = getQuestionOfType(questions, 'BOOLEAN') as T.BooleanQuestion
      const textQuestion           = getQuestionOfType(questions, 'TEXT') as T.TextQuestion
      const singleChoiceQuestion   = getQuestionOfType(questions, 'SINGLE_CHOICE') as T.SingleChoiceQuestion
      const multipleChoiceQuestion = getQuestionOfType(questions, 'MULTIPLE_CHOICE') as T.MultipleChoiceQuestion
      const eventQuestion          = getQuestionOfType(questions, 'EVENT') as T.EventQuestion

      t.deepEqual(booleanQuestion.boolResp, true, 'Doctors can see their patients\' boolean responses')
      t.deepEqual(textQuestion.textResp, 'text answer', 'Doctors can see their patients\' text responses')
      t.deepEqual(singleChoiceQuestion.singleChoiceResp, singleChoiceQuestion.options[0], 'Doctors can see their patients\' single choice responses')
      t.deepEqual(multipleChoiceQuestion.multipleChoiceResp, multipleChoiceQuestion.options, 'Doctors can see their patients\' multiple choice responses')
      t.equal(eventQuestion.eventResp.title, QUESTIONNAIRE_QUESTIONS[4].text, 'Doctors can see their patients\' event responses')
    }

    // Test to make sure the doc can see the patient's timeline data
    {
      const { data: { timelineItems } } = await query(server).noError().asDoctor({ query: TIMELINE_ITEMS, variables: { userId: patientId }})
      t.equal(timelineItems[0].title, QUESTIONNAIRE_QUESTIONS[4].text, 'The doctor can see the patient\'s timeline items after having answered an event question')
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


