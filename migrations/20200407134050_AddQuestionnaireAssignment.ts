import * as Knex from "knex";


export async function up(knex: Knex): Promise<any> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS QuestionnaireAssignment (
      questionnaireId int(11) NOT NULL,
      assigneeId int(11) NOT NULL,
      assignerId int(11) NOT NULL,
      PRIMARY KEY (questionnaireId, assigneeId, assignerId),

      CONSTRAINT questionnaire_assignment_questionnaire FOREIGN KEY (questionnaireId)
      REFERENCES Questionnaire(id) ON DELETE CASCADE,

      CONSTRAINT questionnaire_assignee_user FOREIGN KEY (assigneeId)
      REFERENCES User(id) ON DELETE CASCADE,

      CONSTRAINT questionnaire_assigner_user FOREIGN KEY (assignerId)
      REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

}


export async function down(knex: Knex): Promise<any> {
  await knex.raw(`DROP TABLE IF EXISTS QuestionnaireAssignment`)
}

