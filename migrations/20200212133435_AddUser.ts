import * as Knex from "knex";

export async function up(knex: Knex): Promise<any> {
  await knex.raw(`
    CREATE TABLE User (
      id int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
      name varchar(255) NOT NULL,
      role varchar(255) NOT NULL,
      email varchar(330) NOT NULL,
      imageUrl varchar(255),
      birthday varchar(255),
      joinDate datetime DEFAULT NOW(),
      lastVisit datetime DEFAULT NOW(),
      adherence int(11)
    ) ENGINE=InnoDB
  `)
}


export async function down(knex: Knex): Promise<any> {
  await knex.raw(`
    DROP TABLE user;
  `)
}

