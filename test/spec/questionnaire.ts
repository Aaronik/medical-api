import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { TestModuleExport } from 'test/runner'
import { Question, Questionnaire, QuestionOption } from 'types'

const GET_QUESTIONNAIRE = gql`
  query Questionnaire($id: Int!) {
    questionnaire(id: $id) {
      id
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
        }
        ... on TextQuestion {
          id
        }
        ... on SingleChoiceQuestion {
          id
          options {
            value
            text
          }
        }
        ... on MultipleChoiceQuestion {
          id
          options {
            value
            text
          }
        }
      }
    }
  }
`

export const test: TestModuleExport = (test, query, mutate, knex, db, server) => {
  test('GQL Add Questionnaire -> Get Questionnaire', async t => {
    await db._util.clearDb()

    const title = 'Questionnaire Test Title'

    // TODO not specifying options does not yield type error, but server expects them
    // so it should be a type error here. I'm telling TS it's a choice question, but
    // TS is just not seeing that options are required.
    const questions: Omit<Omit<Question, 'id'>, 'questionnaireId'>[] = [
      { type: 'BOOLEAN', text: 'Sample Boolean Question' },
      { type: 'TEXT', text: 'Sample Text Question' },
      { type: 'SINGLE_CHOICE', text: 'Sample Single Choice Question', options: [] },
      { type: 'MULTIPLE_CHOICE', text: 'Sample Multiple Choice Question', options: [
        { value: 'val', text: 'text' } as QuestionOption
      ]},
    ]

    const { data, errors } = await mutate(server).asUnprived({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    const questionnaire = data?.createQuestionnaire as Questionnaire

    t.deepEqual(errors, undefined, 'Received unexpected GQL error')

    t.equal(questionnaire?.title, title)
    t.equal(questionnaire?.questions?.length, questions.length)

    t.deepEqual(questionnaire?.questions?.[2].options, [])
    t.deepEqual(questionnaire?.questions?.[3].options, [{ value: 'val', text: 'text' }])

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
}
