import * as Knex from "knex";

export async function up(knex: Knex): Promise<any> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS User (
      id int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
      role ENUM('ADMIN', 'DOCTOR', 'PATIENT'),
      email varchar(330) NOT NULL,
      name varchar(255),
      imageUrl varchar(255),
      birthday datetime,
      joinDate datetime DEFAULT NOW()
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS UserLogin (
      userId int(11) PRIMARY KEY NOT NULL,
      passwordHash char(60) NOT NULL,
      lastVisit datetime DEFAULT NOW(),

      CONSTRAINT user_login_user FOREIGN KEY (userId)
      REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS UserHealth (
      userId int(11) PRIMARY KEY NOT NULL,
      adherence int(11),

      CONSTRAINT user_health_user FOREIGN KEY (userId)
      REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS UserToken (
      userId int(11) NOT NULL,
      token char(36) NOT NULL,

      PRIMARY KEY (userId, token),

      CONSTRAINT user_token_user FOREIGN KEY (userId)
      REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)
}


export async function down(knex: Knex): Promise<any> {
  await knex.raw(`DROP TABLE IF EXISTS UserToken,UserHealth,UserLogin,User`)
}

