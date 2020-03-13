import * as Knex from "knex";


export async function up(knex: Knex): Promise<any> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS TimelineGroup (
      id int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
      content text NOT NULL,
      className varchar(320),
      title varchar(255),
      style text,
      .order int(11),
      visible BOOLEAN,
      showNested BOOLEAN
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS TimelineItem (
      id int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
      className varchar(320),
      content text NOT NULL,
      start datetime NOT NULL,
      end datetime,
      .group int(11),
      style text,
      subgroup int(11),
      title varchar(255),
      type ENUM('box', 'point', 'range', 'background'),
      editable BOOLEAN,
      selectable BOOLEAN,
      userId int(11) NOT NULL,

      CONSTRAINT item_group FOREIGN KEY (\`group\`)
      REFERENCES TimelineGroup(id) ON DELETE CASCADE,

      CONSTRAINT item_user FOREIGN KEY (userId)
      REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS TimelineGroupNesting (
      groupId int(11) NOT NULL,
      nestedGroupId int(11) NOT NULL,

      PRIMARY KEY (groupId, nestedGroupId),

      CONSTRAINT group_group FOREIGN KEY (groupId)
      REFERENCES TimelineGroup(id) ON DELETE CASCADE,

      CONSTRAINT group_nested_group FOREIGN KEY (nestedGroupId)
      REFERENCES TimelineGroup(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)
}


export async function down(knex: Knex): Promise<any> {
  await knex.raw(`DROP TABLE IF EXISTS TimelineItem,TimelineGroupNesting,TimelineGroup`)
}

