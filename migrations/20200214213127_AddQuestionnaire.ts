import * as Knex from "knex";


export async function up(knex: Knex): Promise<any> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS Questionnaire (
      id int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
      title varchar(255),
      creatingUserId int(11) NOT NULL,

      CONSTRAINT questionnaire_creating_user_id_user FOREIGN KEY (creatingUserId)
      REFERENCES User(id)
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS Question (
      id int(11) NOT NULL AUTO_INCREMENT,
      questionnaireId int(11) NOT NULL,
      text text,
      type ENUM('BOOLEAN', 'TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE'),

      PRIMARY KEY (id, questionnaireId),

      CONSTRAINT boolean_question_questionnaire FOREIGN KEY (questionnaireId)
      REFERENCES Questionnaire(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS QuestionOption (
      id int(11) NOT NULL AUTO_INCREMENT,
      questionId int(11) NOT NULL,
      text text,

      PRIMARY KEY (id),

      CONSTRAINT question_option_question FOREIGN KEY (questionId)
      REFERENCES Question(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS QuestionResponseBoolean (
      questionId int(11) NOT NULL,
      userId int(11) NOT NULL,
      value BOOLEAN,

      PRIMARY KEY (questionId, userId),

      CONSTRAINT boolean_response_quesetion FOREIGN KEY (questionId)
      REFERENCES Question(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS QuestionResponseText (
      questionId int(11) NOT NULL,
      userId int(11) NOT NULL,
      value text,

      PRIMARY KEY (questionId, userId),

      CONSTRAINT text_response_question FOREIGN KEY (questionId)
      REFERENCES Question(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS QuestionResponseChoice (
      questionId int(11) NOT NULL,
      userId int(11) NOT NULL,
      optionId int(11) NOT NULL,

      PRIMARY KEY (questionId, userId, optionId),

      CONSTRAINT question_response_question FOREIGN KEY (questionId)
      REFERENCES Question(id) ON DELETE CASCADE,

      CONSTRAINT question_response_option FOREIGN KEY (optionId)
      REFERENCES QuestionOption(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS QuestionRelation (
      id int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
      questionId int(11) NOT NULL,
      includes text,
      equals text,
      nextQuestionId int(11) NOT NULL,

      CONSTRAINT question_relation_question FOREIGN KEY (questionId)
      REFERENCES Question(id) ON DELETE CASCADE,

      CONSTRAINT question_relation_next_question FOREIGN KEY (nextQuestionId)
      REFERENCES Question(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

}


export async function down(knex: Knex): Promise<any> {
  await knex.raw(`DROP TABLE IF EXISTS QuestionRelation,QuestionResponseChoice,QuestionResponseText,QuestionResponseBoolean,QuestionOption,Question,Questionnaire`)
}

