import * as Knex from "knex";


export async function up(knex: Knex): Promise<any> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS QuestionnaireAssignment (
      id int(11) NOT NULL AUTO_INCREMENT,
      questionnaireId int(11) NOT NULL,
      assigneeId int(11) NOT NULL,
      assignerId int(11) NOT NULL,
      created datetime NOT NULL DEFAULT NOW(),
      repeatInterval int(11),

      PRIMARY KEY (questionnaireId, assigneeId, assignerId),

      INDEX id (id),

      CONSTRAINT questionnaire_assignment_questionnaire FOREIGN KEY (questionnaireId)
      REFERENCES Questionnaire(id) ON DELETE CASCADE,

      CONSTRAINT questionnaire_assignment_assignee_user FOREIGN KEY (assigneeId)
      REFERENCES User(id) ON DELETE CASCADE,

      CONSTRAINT questionnaire_assignment_assigner_user FOREIGN KEY (assignerId)
      REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  // So we have a assignmentId but no FK reference to QuestionnaireAssignment.
  // That's because we:
  // * Need to be able to loop up all the QuestionnaireAssignmentInstances for a given QuestionnaireAssignment, and
  // * Need QuestionnaireAssignmentInstances to live forever even when their accompanying QuestionnaireAssignment
  //   is deleted. And Instance represents a certain questionnaire that was taken. The responses have a FK relation
  //   to an Instance. So they must persist forevs. I couldn't find a way to do a FK relation _only on creation_,
  //   so that there'd be sure to be an assignment when an instance is made, but then the assignment would be free
  //   to be deleted without cascade. If I could have I'd have.
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS QuestionnaireAssignmentInstance (
      id int(11) NOT NULL AUTO_INCREMENT,
      created datetime NOT NULL DEFAULT NOW(),
      assignmentId int(11) NOT NULL,
      questionnaireId int(11) NOT NULL,
      assigneeId int(11) NOT NULL,
      assignerId int(11) NOT NULL,

      PRIMARY KEY (id, assigneeId, assignerId),

      CONSTRAINT questionnaire_assignment_instance_questionnaire FOREIGN KEY (questionnaireId)
      REFERENCES Questionnaire(id) ON DELETE CASCADE,

      CONSTRAINT questionnaire_assignment_instance_assignee_user FOREIGN KEY (assigneeId)
      REFERENCES User(id) ON DELETE CASCADE,

      CONSTRAINT questionnaire_assignment_instance_assigner_user FOREIGN KEY (assignerId)
      REFERENCES User(id) ON DELETE CASCADE
    )
  `)

}


export async function down(knex: Knex): Promise<any> {
  await knex.raw(`DROP TABLE IF EXISTS QuestionnaireAssignmentInstance,QuestionnaireAssignment`)
}

