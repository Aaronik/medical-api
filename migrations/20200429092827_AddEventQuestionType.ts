import * as Knex from "knex";


export async function up(knex: Knex): Promise<any> {
  await knex.raw(`
    ALTER TABLE Question
      CHANGE type type ENUM('BOOLEAN', 'TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'EVENT')
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS QuestionResponseEvent (
      questionId int(11) NOT NULL,
      userId int(11) NOT NULL,
      assignmentInstanceId int(11) NOT NULL,
      timelineItemId int(11) NOT NULL,

      PRIMARY KEY (questionId, userId, assignmentInstanceId),

      CONSTRAINT question_response_event_question FOREIGN KEY (questionId)
      REFERENCES Question(id) ON DELETE CASCADE,

      CONSTRAINT question_response_event_user FOREIGN KEY (userId)
      REFERENCES User(id) ON DELETE CASCADE,

      CONSTRAINT question_response_event_assignment_instance FOREIGN KEY (assignmentInstanceId)
      REFERENCES QuestionnaireAssignmentInstance(id) ON DELETE CASCADE,

      CONSTRAINT question_response_event_timeline FOREIGN KEY (timelineItemId)
      REFERENCES TimelineItem(id) ON DELETE CASCADE
    )
  `)
}


export async function down(knex: Knex): Promise<any> {
  await knex.raw(`
    ALTER TABLE Question
      DROP COLUMN type,
      ADD COLUMN type ENUM('BOOLEAN', 'TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE')
  `)

  await knex.raw(`DROP TABLE IF EXISTS QuestionResponseEvent`)
}

