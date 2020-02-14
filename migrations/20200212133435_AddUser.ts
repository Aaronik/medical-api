import * as Knex from "knex";

export async function up(knex: Knex): Promise<any> {
  await knex.raw(`
    CREATE TABLE User (
      id int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
      role varchar(255) NOT NULL,
      email varchar(330) NOT NULL,
      name varchar(255),
      imageUrl varchar(255),
      birthday varchar(255),
      joinDate datetime DEFAULT NOW()
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE UserLogin (
      userId int(11) PRIMARY KEY NOT NULL,
      passwordHash char(60) NOT NULL,
      lastVisit datetime DEFAULT NOW(),

      CONSTRAINT user_login_user FOREIGN KEY (userId)
      REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE UserHealth (
      userId int(11) PRIMARY KEY NOT NULL,
      adherence int(11),

      CONSTRAINT user_health_user FOREIGN KEY (userId)
      REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)
}


export async function down(knex: Knex): Promise<any> {
  await knex.raw(`DROP TABLE UserHealth;`)
  await knex.raw(`DROP TABLE UserLogin;`)
  await knex.raw(`DROP TABLE User;`)
}

