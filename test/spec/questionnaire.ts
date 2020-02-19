import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { TestModuleExport } from 'test/runner'
import { Question, Questionnaire, QuestionOption, QuestionType } from 'types'

const GET_QUESTIONNAIRE = gql`
  query Questionnaire($id: Int!) {
    questionnaire(id: $id) {
      id
      title
      questions {
        ... on BooleanQuestion {
          id
          type
          boolResp: response
        }
        ... on TextQuestion {
          id
          type
          textResp: response
        }
        ... on SingleChoiceQuestion {
          id
          type
          singleChoiceResp: response
          options {
            value
            text
          }
        }
        ... on MultipleChoiceQuestion {
          id
          type
          multipleChoiceResp: response
          options {
            value
            text
          }
        }
      }
    }
  }
`

const CREATE_QUESTIONNAIRE = gql`
  mutation CreateQuestionnaire($title: String, $questions: [QuestionInput]){
    createQuestionnaire(title: $title, questions: $questions) {
      id
      title
      questions {
        ... on BooleanQuestion {
          id
          type
          boolResp: response
        }
        ... on TextQuestion {
          id
          type
          textResp: response
        }
        ... on SingleChoiceQuestion {
          id
          type
          singleChoiceResp: response
          options {
            value
            text
          }
        }
        ... on MultipleChoiceQuestion {
          id
          type
          multipleChoiceResp: response
          options {
            value
            text
          }
        }
      }
    }
  }
`

const SUBMIT_BOOLEAN_RESPONSE = gql`
  mutation SubmitBoolean($questionId: Int!, $value: Boolean!) {
    submitBooleanQuestionResponse(questionId: $questionId, value: $value)
  }
`

const SUBMIT_TEXT_RESPONSE = gql`
  mutation SubmitText($questionId: Int!, $value: String!) {
    submitTextQuestionResponse(questionId: $questionId, value: $value)
  }
`

const SUBMIT_CHOICE_RESPONSE = gql`
  mutation SubmitChoice($questionId: Int!, $value: String!) {
    submitChoiceQuestionResponse(questionId: $questionId, value: $value)
  }
`

// TODO not specifying options does not yield type error, but server expects them
// so it should be a type error here. I'm telling TS it's a choice question, but
// TS is just not seeing that options are required.
const questions: Omit<Omit<Question, 'id'>, 'questionnaireId'>[] = [
  { type: 'BOOLEAN', text: 'Sample Boolean Question' },
  { type: 'TEXT', text: 'Sample Text Question' },
  { type: 'SINGLE_CHOICE', text: 'Sample Single Choice Question', options: [
    { value: 'val', text: 'text' } as QuestionOption
  ] },
  { type: 'MULTIPLE_CHOICE', text: 'Sample Multiple Choice Question', options: [
    { value: 'val', text: 'text' } as QuestionOption
  ]},
]
const title = 'Questionnaire Test Title'

export const test: TestModuleExport = (test, query, mutate, knex, db, server) => {
  test('GQL Add Questionnaire -> Get Questionnaire', async t => {
    await db._util.clearDb()

    const { data, errors } = await mutate(server).asUnprived({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.deepEqual(errors, undefined, 'Received unexpected GQL error')

    const questionnaire = data?.createQuestionnaire as Questionnaire

    t.equal(questionnaire?.title, title)
    t.equal(questionnaire?.questions?.length, questions.length)

    const singleChoiceQuestion = questionnaire?.questions?.find(q => q.type === 'SINGLE_CHOICE')
    const multipleChoiceQuestion = questionnaire?.questions?.find(q => q.type === 'MULTIPLE_CHOICE')

    t.deepEqual(singleChoiceQuestion?.options, [{ value: 'val', text: 'text' }])
    t.deepEqual(multipleChoiceQuestion?.options, [{ value: 'val', text: 'text' }])

    t.end()
  })

  test('GQL Get Questionnaire that doesn\'t exist', async t => {
    await db._util.clearDb()

    const { data, errors } = await mutate(server).asUnprived({ mutation: GET_QUESTIONNAIRE, variables: { id: 42 } })
    const questionnaire = data?.createQuestionnaire

    t.deepEqual(errors, undefined, 'Received unexpected GQL error')
    t.equal(questionnaire, undefined)

    t.end()
  })

  test('GQL Submit Responses to Questionnaire -> Retrieve Questionnaire with responses', async t => {
    await db._util.clearDb()

    const createResp = await mutate(server).asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.deepEqual(createResp.errors, undefined, 'Received unexpected GQL error')

    const createdQuestionnaire = createResp.data?.createQuestionnaire

    const singleChoiceQuestion = createdQuestionnaire?.questions?.find(q => q.type === 'SINGLE_CHOICE')
    const multipleChoiceQuestion = createdQuestionnaire?.questions?.find(q => q.type === 'MULTIPLE_CHOICE')
    const booleanQuestion = createdQuestionnaire?.questions?.find(q => q.type === 'BOOLEAN')
    const textQuestion = createdQuestionnaire?.questions?.find(q => q.type === 'TEXT')

    const singleChoiceResponse = singleChoiceQuestion?.options?.[0]?.value
    const multipleChoiceResponse = multipleChoiceQuestion?.options?.[0]?.value

    const boolResp = await mutate(server).asPatient({ mutation: SUBMIT_BOOLEAN_RESPONSE, variables: { questionId: booleanQuestion.id, value: true }})
    const textResp = await mutate(server).asPatient({ mutation: SUBMIT_TEXT_RESPONSE, variables: { questionId: textQuestion.id, value: 'text answer' }})
    const singResp = await mutate(server).asPatient({ mutation: SUBMIT_CHOICE_RESPONSE, variables: { questionId: singleChoiceQuestion.id, value: singleChoiceResponse }})
    const multResp = await mutate(server).asPatient({ mutation: SUBMIT_CHOICE_RESPONSE, variables: { questionId: multipleChoiceQuestion.id, value: multipleChoiceResponse }})

    t.deepEqual(boolResp.errors, undefined, 'Received unexpected GQL error')
    t.deepEqual(textResp.errors, undefined, 'Received unexpected GQL error')
    t.deepEqual(singResp.errors, undefined, 'Received unexpected GQL error')
    t.deepEqual(multResp.errors, undefined, 'Received unexpected GQL error')

    const getResp = await mutate(server).asPatient({ mutation: GET_QUESTIONNAIRE, variables: { id: createdQuestionnaire.id }})

    t.deepEqual(getResp.errors, undefined, 'Received unexpected GQL error')

    const gottenQuestionnaire = getResp.data?.questionnaire

    const getQuestionOfType = (questionnaire?: Questionnaire, type?: QuestionType) => {
      return questionnaire?.questions?.find(q => q.type === type)
    }

    // GraphQL requires using aliases for inline fragments that have similar keys of different types.
    // This wreaks havoc on our typescript types. On a real client implementation, we need to define a
    // specific type for each GraphQL request.
    // @ts-ignore
    t.equal(getQuestionOfType(gottenQuestionnaire, 'BOOLEAN').boolResp, true)
    // @ts-ignore
    t.equal(getQuestionOfType(gottenQuestionnaire, 'TEXT').textResp, 'text answer')
    // @ts-ignore
    t.equal(getQuestionOfType(gottenQuestionnaire, 'SINGLE_CHOICE').singleChoiceResp, singleChoiceResponse)
    // @ts-ignore
    t.deepEqual(getQuestionOfType(gottenQuestionnaire, 'MULTIPLE_CHOICE').multipleChoiceResp, [multipleChoiceResponse])

    t.end()
  })
}
