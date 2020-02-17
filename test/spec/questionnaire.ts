import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { TestModuleExport } from 'test/runner'
import { Question, Questionnaire, QuestionOption } from 'types'

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
  test.only('GQL Add Questionnaire -> Get Questionnaire', async t => {
    await db._util.resetDB()

    const title = 'Questionnaire Test Title'

    // TODO not specifying options does not yield type error, but server expects them
    // so it should be a type error here.
    const questions: Omit<Omit<Question, 'id'>, 'questionnaireId'>[] = [
      { type: 'BOOLEAN', text: 'Sample Boolean Question' },
      { type: 'TEXT', text: 'Sample Text Question' },
      { type: 'SINGLE_CHOICE', text: 'Sample Single Choice Question', options: [] },
      { type: 'MULTIPLE_CHOICE', text: 'Sample Multiple Choice Question', options: [{ value: 'val', text: 'text' } as QuestionOption ] },
    ]

    const { data, errors } = await mutate(server).asUnprived({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    const questionnaire = data?.createQuestionnaire as Questionnaire

    t.deepEqual(errors, undefined, 'Received unexpected GQL error')

    t.equal(questionnaire?.title, title)
    t.equal(questionnaire?.questions?.length, questions.length)

    // TODO figure out optional chaining for indexing into arrays that may be null or undefined
    t.deepEqual(questionnaire?.questions[2].options, [])
    t.deepEqual(questionnaire?.questions[3].options, [{ value: 'val', text: 'text' }])

    t.end()
  })
}
