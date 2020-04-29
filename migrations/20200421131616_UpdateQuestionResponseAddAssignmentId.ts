import * as Knex from "knex";


export async function up(knex: Knex): Promise<any> {
  await knex.raw(`
    ALTER TABLE QuestionResponseBoolean
      ADD COLUMN assignmentInstanceId int(11),

      DROP PRIMARY KEY, ADD PRIMARY KEY (questionId, userId, assignmentInstanceId),

      ADD CONSTRAINT question_response_boolean_assignment_instance FOREIGN KEY (assignmentInstanceId)
      REFERENCES QuestionnaireAssignmentInstance(id) ON DELETE CASCADE
  `)

  await knex.raw(`
    ALTER TABLE QuestionResponseText
      ADD COLUMN assignmentInstanceId int(11),

      DROP PRIMARY KEY, ADD PRIMARY KEY (questionId, userId, assignmentInstanceId),

      ADD CONSTRAINT question_response_text_assignment_instance FOREIGN KEY (assignmentInstanceId)
      REFERENCES QuestionnaireAssignmentInstance(id) ON DELETE CASCADE
  `)

  await knex.raw(`
    ALTER TABLE QuestionResponseChoice
      ADD COLUMN assignmentInstanceId int(11),

      DROP PRIMARY KEY, ADD PRIMARY KEY (questionId, userId, assignmentInstanceId, optionId),

      ADD CONSTRAINT question_response_choice_assignment_instance FOREIGN KEY (assignmentInstanceId)
      REFERENCES QuestionnaireAssignmentInstance(id) ON DELETE CASCADE
  `)

}


export async function down(knex: Knex): Promise<any> {
  // When this fires, there will be risk of duplicates b/c of primary key
  // change if data has been collecting within the framework of having multiple
  // responses to the same questionnaire. If we are running this rollback under
  // those circumstances, then we are going to be deleting data anyways. So I'm
  // actually going to let this stand as a kind of gate to prevent against data
  // loss in that way. If it needs to be done still, we can just remove all
  // primary keys from here, or we can come up with a plan to remove that data
  // intelligently.
  await knex.raw(`
    ALTER TABLE QuestionResponseBoolean
      DROP FOREIGN KEY question_response_boolean_assignment_instance,
      DROP PRIMARY KEY, ADD PRIMARY KEY (questionId, userId),
      DROP COLUMN assignmentInstanceId
  `)

  await knex.raw(`
    ALTER TABLE QuestionResponseText
      DROP FOREIGN KEY question_response_text_assignment_instance,
      DROP PRIMARY KEY, ADD PRIMARY KEY (questionId, userId),
      DROP COLUMN assignmentInstanceId
  `)

  await knex.raw(`
    ALTER TABLE QuestionResponseChoice
      DROP FOREIGN KEY question_response_choice_assignment_instance,
      DROP PRIMARY KEY, ADD PRIMARY KEY (questionId, userId, optionId),
      DROP COLUMN assignmentInstanceId
  `)
}

