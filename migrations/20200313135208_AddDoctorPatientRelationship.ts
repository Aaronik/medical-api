import * as Knex from "knex";


export async function up(knex: Knex): Promise<any> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS DoctorPatientRelationship (
      doctorId int(11) NOT NULL,
      patientId int(11) NOT NULL,
      PRIMARY KEY (doctorId, patientId),

      CONSTRAINT doctor_user FOREIGN KEY (doctorId)
      REFERENCES User(id) ON DELETE CASCADE,

      CONSTRAINT patient_user FOREIGN KEY (patientId)
      REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)
}


export async function down(knex: Knex): Promise<any> {
  await knex.raw(`DROP TABLE IF EXISTS DoctorPatientRelationship`)
}

