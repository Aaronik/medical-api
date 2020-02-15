import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { TestModuleExport } from 'test/runner'
import { Question } from 'types'

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
        }
        ... on MultipleChoiceQuestion {
          id
        }
      }
    }
  }
`

export const test: TestModuleExport = (test, query, mutate, knex, db, server) => {
  test('GQL Add Questionnaire -> Get Questionnaire', async t => {
    await db._util.resetDB()

    const title = 'Questionnaire Test Title'

    const questions: Omit<Omit<Question, 'id'>, 'questionnaireId'>[] = [
      { type: 'BOOLEAN', text: 'Sample Boolean Question' },
      { type: 'TEXT', text: 'Sample Text Question' }
    ]

    const { data, errors } = await mutate(server).asUnprived({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    const questionnaire = data?.createQuestionnaire

    t.deepEqual(errors, undefined, 'Received unexpected GQL error')

    t.equal(questionnaire?.title, title)
    t.equal(questionnaire?.questions?.length, 2)

    t.end()
  })
}
