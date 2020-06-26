import * as Knex from "knex";


export async function up(knex: Knex): Promise<any> {

  // email can now be null
  await knex.raw(`
    ALTER TABLE User
      MODIFY email varchar(330) UNIQUE,
      ADD COLUMN phone varchar(255) UNIQUE
  `)

  // Leave it so if we have to roll back, users don't have to create all new passwords
  // Also note that we can't bring this back to NOT NULL on the rollback because
  // new entries will exist without passwords. So it's like this forever now.
  await knex.raw(`
    ALTER TABLE UserLogin
      MODIFY passwordHash char(60)
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS UserAuthCode (
      email varchar(330),
      phone varchar(255),
      role ENUM('ADMIN', 'DOCTOR', 'PATIENT'),
      name varchar(255),
      code char(36),
      inviterId int(11),
      created datetime DEFAULT NOW(),

      CONSTRAINT auth_code_user FOREIGN KEY (inviterId)
      REFERENCES User(id) ON DELETE CASCADE
    )
  `)
}


export async function down(knex: Knex): Promise<any> {
  await knex.raw(`
    ALTER TABLE User
      MODIFY email varchar(330) NOT NULL,
      DROP COLUMN phone
  `)

  await knex.raw(`DROP TABLE IF EXISTS UserAuthCode`)
}

