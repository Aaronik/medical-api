import { gql } from 'apollo-server'
import { TestModuleExport } from 'test/runner'
import { Question, Questionnaire, QuestionOption, QuestionRelation, QuestionType } from 'types'

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

const GET_QUESTIONNAIRE = gql`
  query Questionnaire($id: Int!) {
    questionnaire(id: $id) {
      id
      title
      questions ${QUESTIONS_FRAGMENT}
    }
  }
`

const GET_QUESTIONNAIRES = gql`
  query {
    allQuestionnaires {
      id
      title
      questions ${QUESTIONS_FRAGMENT}
    }
  }
`

const GET_QUESTIONNAIRES_I_MADE = gql`
  query {
    questionnairesIMade {
      id
      title
      questions ${QUESTIONS_FRAGMENT}
    }
  }
`

const GET_QUESTION = gql`
  query Question($id: Int!) {
    question(id: $id) ${QUESTIONS_FRAGMENT}
  }
`

const CREATE_QUESTIONNAIRE = gql`
  mutation CreateQuestionnaire($title: String, $questions: [QuestionInput]){
    createQuestionnaire(title: $title, questions: $questions) {
      id
      title
      questions ${QUESTIONS_FRAGMENT}
    }
  }
`

const UPDATE_QUESTIONNAIRE = gql`
  mutation UpdateQuestionnaire($id: Int!, $title: String, $questions: [QuestionInput]){
    updateQuestionnaire(id: $id, title: $title, questions: $questions) {
      id
      title
      questions ${QUESTIONS_FRAGMENT}
    }
  }
`

const ADD_QUESTION = gql`
  mutation AddQuestions($questions: [QuestionInput]) {
    addQuestions(questions: $questions) ${QUESTIONS_FRAGMENT}
  }
`

export const UPDATE_QUESTION = gql`
  mutation UpdateQuestion($question: QuestionInput!) {
    updateQuestion(question: $question) ${QUESTIONS_FRAGMENT}
  }
`

const DELETE_QUESTION = gql`
  mutation DeleteQuestion($id: Int!) {
    deleteQuestion(id: $id)
  }
`

const CREATE_QUESTION_RELATIONS = gql`
  mutation CreateQuestionRelations($relations: [QuestionRelationInput]) {
    createQuestionRelations(relations: $relations)
  }
`

const DELETE_QUESTIONNAIRE = gql`
  mutation DeleteQuestionnaire($id: Int!) {
    deleteQuestionnaire(id: $id)
  }
`

const title = 'Questionnaire Test Title'

const questions: Omit<Omit<Question, 'id'>, 'questionnaireId'>[] = [
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
    options: [ { text: 'text' } as QuestionOption ],
  },
  {
    type: 'MULTIPLE_CHOICE',
    text: 'Sample Multiple Choice Question',
    options: [ { text: 'text' } as QuestionOption ],
  },
]

export const test: TestModuleExport = (test, query, mutate, knex, db, server) => {
  test('GQL Add Questionnaire -> Get Questionnaire', async t => {
    const { data: { createQuestionnaire: questionnaire }} = await mutate(server).noError()
      .asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.equal(questionnaire.title, title)
    t.equal(questionnaire.questions.length, questions.length)

    const singleChoiceQuestion = questionnaire.questions.find(q => q.type === 'SINGLE_CHOICE')
    const multipleChoiceQuestion = questionnaire.questions.find(q => q.type === 'MULTIPLE_CHOICE')

    t.equal(singleChoiceQuestion.options.length, 1)
    t.deepEqual(singleChoiceQuestion.options[0].text, 'text')
    t.equal(multipleChoiceQuestion.options.length, 1)
    t.deepEqual(multipleChoiceQuestion.options[0].text, 'text')

    t.end()
  })

  test('GQL Add Questionnaire -> Update Questionnaire', async t => {
    await db._util.clearDb()

    const { data: { createQuestionnaire: { id }}} = await mutate(server).noError()
      .asDoctor({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    const newTitle = 'updated quesitonnaire title'
    const { data: { updateQuestionnaire: questionnaire }} = await mutate(server).noError().asDoctor({ mutation: UPDATE_QUESTIONNAIRE, variables: { id, title: newTitle }})

    t.equal(questionnaire.title, newTitle)

    t.end()
  })

  test('GQL Add Questionnaire -> Get Questionnaires I Made', async t => {
    await db._util.clearDb()

    await mutate(server).noError()
      .asDoctor({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    const { data: { questionnairesIMade: questionnaires }} = await query(server).noError().asDoctor({ query: GET_QUESTIONNAIRES_I_MADE })

    t.equal(questionnaires?.length, 1)

    t.end()
  })

  test('GQL Add Questionnaire -> Get Question', async t => {
    const { data: { createQuestionnaire: questionnaire }} =
      await mutate(server).asDoctor({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.equal(questionnaire?.questions?.length, questions.length)

    const singleChoiceQuestion = questionnaire?.questions?.find(q => q.type === 'SINGLE_CHOICE')

    t.ok(singleChoiceQuestion.id)

    const { data: { question } } = await query(server).asUnprived({ query: GET_QUESTION, variables: { id: singleChoiceQuestion.id }})

    t.ok(question)

    t.end()
  })

  test('GQL Get Questionnaire that doesn\'t exist', async t => {
    await db._util.clearDb()

    const { data: { createQuestionnaire: questionnaire } } = await mutate(server).noError().asUnprived({ mutation: GET_QUESTIONNAIRE, variables: { id: 42 } })
    t.equal(questionnaire, undefined)
    t.end()
  })

  test('GQL Submit Questionnaire -> Submit Question Relations -> Get Questionnaire', async t => {
    const { data: { createQuestionnaire: createdQuestionnaire }}
      = await mutate(server).noError().asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    let booleanQuestion = createdQuestionnaire.questions.find(q => q.type === 'BOOLEAN')
    let textQuestion = createdQuestionnaire.questions.find(q => q.type === 'TEXT')
    let singleChoiceQuestion = createdQuestionnaire.questions.find(q => q.type === 'SINGLE_CHOICE')
    let multipleChoiceQuestion = createdQuestionnaire.questions.find(q => q.type === 'MULTIPLE_CHOICE')

    const relations: QuestionRelation[] = [
      {
        questionId: booleanQuestion.id,
        equals: 'true',
        nextQuestionId: textQuestion.id
      },
      {
        questionId: textQuestion.id,
        includes: 'wow',
        nextQuestionId: singleChoiceQuestion.id
      },
      {
        questionId: singleChoiceQuestion.id,
        equals: 'val',
        nextQuestionId: multipleChoiceQuestion.id
      },
    ]

    await mutate(server).noError().asAdmin({ mutation: CREATE_QUESTION_RELATIONS, variables: { relations }})

    const { data: { questionnaire: gottenQuestionnaire }}
      = await query(server).noError().asAdmin({ query: GET_QUESTIONNAIRE, variables: { id: createdQuestionnaire.id }})

    booleanQuestion = gottenQuestionnaire.questions.find(q => q.type === 'BOOLEAN')
    textQuestion = gottenQuestionnaire.questions.find(q => q.type === 'TEXT')
    singleChoiceQuestion = gottenQuestionnaire.questions.find(q => q.type === 'SINGLE_CHOICE')
    multipleChoiceQuestion = gottenQuestionnaire.questions.find(q => q.type === 'MULTIPLE_CHOICE')

    t.deepEqual(booleanQuestion.next, [{ equals: 'true', nextQuestionId: textQuestion.id, includes: null }], 'Boolean question has correct next value')
    t.deepEqual(textQuestion.next, [{ includes: 'wow', nextQuestionId: singleChoiceQuestion.id, equals: null }], 'Text question has correct next value')
    t.deepEqual(singleChoiceQuestion.next, [{ equals: 'val', nextQuestionId: multipleChoiceQuestion.id, includes: null }], 'Single Choice question has correct next value')
    t.deepEqual(multipleChoiceQuestion.next, [], 'Multiple Choice question has empty next value')

    t.end()
  })

  test('GQL Submit questionnaire -> Add another question -> Get questionnaire', async t => {
    const { data: { createQuestionnaire: createdQuestionnaire }}
      = await mutate(server).noError().asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    const extraQuestions = [{
      questionnaireId: createdQuestionnaire.id,
      text: 'Added Question',
      type: 'SINGLE_CHOICE',
      options: [{ text: 'option' }]
    }]

    await mutate(server).noError().asAdmin({ mutation: ADD_QUESTION, variables: { questions: extraQuestions }})

    const { data: { questionnaire: gottenQuestionnaire }}
      = await query(server).noError().asAdmin({ query: GET_QUESTIONNAIRE, variables: { id: createdQuestionnaire.id }})

    t.equal(gottenQuestionnaire.questions.length, questions.length + extraQuestions.length, 'Questionnaire should have all the extra questions')

    t.end()
  })

  test('GQL Submit Questionnaire -> Delete question', async t => {
    const { data: { createQuestionnaire: createdQuestionnaire }}
      = await mutate(server).noError().asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    await mutate(server).noError().asAdmin({ mutation: DELETE_QUESTION, variables: { id: createdQuestionnaire.questions[0].id } })

    const { data: { questionnaire: gottenQuestionnaire }}
      = await query(server).noError().asAdmin({ query: GET_QUESTIONNAIRE, variables: { id: createdQuestionnaire.id }})

    t.equal(gottenQuestionnaire.questions.length, questions.length - 1, 'There should be one fewer question after a question has been deleted')

    t.end()
  })

  test('GQL Submit Questionnaire -> Update question', async t => {
    const { data: { createQuestionnaire: createdQuestionnaire }}
      = await mutate(server).noError().asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    const newText = 'Updated text'
    const updatedQuestion = Object.assign({}, createdQuestionnaire.questions[0], { text: newText })
    delete updatedQuestion.boolResp
    delete updatedQuestion.next

    await mutate(server).noError().asAdmin({ mutation: UPDATE_QUESTION, variables: { question: updatedQuestion } })

    const { data: { questionnaire: gottenQuestionnaire }}
      = await query(server).noError().asAdmin({ query: GET_QUESTIONNAIRE, variables: { id: createdQuestionnaire.id }})

    t.equal(gottenQuestionnaire.questions[0].text, newText)

    t.end()
  })

  test('GQL Create multiple questionnaires -> get them all', async t => {
    await db._util.clearDb()

    await mutate(server).noError().asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})
    await mutate(server).noError().asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})
    const { data: { allQuestionnaires }} = await query(server).noError().asAdmin({ query: GET_QUESTIONNAIRES })
    t.equal(allQuestionnaires.length, 2, 'Getting all questionnaires should return two questionnaires')
    t.end()
  })

  test('GQL Create questionnaire -> delete questionnaire -> get them all', async t => {
    await db._util.clearDb()

    const { data: { createQuestionnaire: createdQuestionnaire }}
      = await mutate(server).noError().asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})
    await mutate(server).noError().asAdmin({ mutation: DELETE_QUESTIONNAIRE, variables: { id: createdQuestionnaire.id }})
    const { data: { allQuestionnaires }} = await query(server).noError().asAdmin({ query: GET_QUESTIONNAIRES })
    t.deepEqual(allQuestionnaires, [], 'There shouldn\'t be any questionnaires after one is created and one is deleted')
    t.end()
  })
}
