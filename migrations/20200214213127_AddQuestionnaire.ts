import * as Knex from "knex";


export async function up(knex: Knex): Promise<any> {
  await knex.raw(`
    CREATE TABLE Questionnaire (
      id int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
      title varchar(255)
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE Question (
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
    CREATE TABLE QuestionOption (
      id int(11) NOT NULL,
      questionId int(11) NOT NULL,
      value varchar(255),
      text text,

      PRIMARY KEY (id, questionId),

      CONSTRAINT question_option_question FOREIGN KEY (questionId)
      REFERENCES Question(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE QuestionResponseBoolean (
      questionId int(11) PRIMARY KEY NOT NULL,
      value BOOLEAN,

      CONSTRAINT boolean_response_quesetion FOREIGN KEY (questionId)
      REFERENCES Question(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE QuestionResponseText (
      questionId int(11) PRIMARY KEY NOT NULL,
      value text,

      CONSTRAINT text_response_question FOREIGN KEY (questionId)
      REFERENCES Question(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE QuestionResponseMultiple (
      questionId int(11) NOT NULL,
      optionId int(11) NOT NULL,

      PRIMARY KEY (questionId, optionId),

      CONSTRAINT multiple_response_question FOREIGN KEY (questionId)
      REFERENCES Question(id) ON DELETE CASCADE,

      CONSTRAINT multiple_response_option FOREIGN KEY (optionId)
      REFERENCES QuestionOption(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)
}


export async function down(knex: Knex): Promise<any> {
  await knex.raw(`DROP TABLE QuestionResponseMultiple,QuestionResponseText,QuestionResponseBoolean,QuestionOption,Question,Questionnaire;`)
}
