import { Schema, Table, Pckg, Query, Seed } from './schema';

const surveysTable = new Table({
  name: 'surveys',
  columns: [
    { name: 'id', dataType: 'number', isNullable: false },
    { name: 'title', dataType: 'varchar', length: 200, isNullable: false },
    { name: 'description', dataType: 'varchar', length: 2000 },
    { name: 'created', dataType: 'timestamp', isNullable: false },
    { name: 'updated', dataType: 'timestamp' },
  ],
});

const surveyResponsesTable = new Table('survey_responses')
  .addColumn({ name: 'id', dataType: 'number', isNullable: false })
  .addColumn({ name: 'survey_id', dataType: 'number', isNullable: false })
  .addColumn({ name: 'responses', dataType: 'clob' })
  .addColumn({ name: 'submitted', dataType: 'timestamp', isNullable: false });

const getSurveysQuery = new Query()
  .from('surveys')
  .select('id')
  .select('title')
  .select('description')
  .select('created')
  .select('updated')
  .whereRaw(`(p_filter IS NULL OR title LIKE '%' || p_filter || '%')`)
  .offsetP('p_offset')
  .limitP('p_limit')
  .build();

const surveysPackage = new Pckg('pck_surveys').addProcedure({
  name: 'get_surveys',
  params: [
    { name: 'p_filter', dataType: 'VARCHAR2', mode: 'IN', defaultValue: 'NULL' },
    { name: 'p_limit', dataType: 'NUMBER', mode: 'IN', defaultValue: '100' },
    { name: 'p_offset', dataType: 'NUMBER', mode: 'IN', defaultValue: '0' },
    { name: 'p_result', dataType: 'SYS_REFCURSOR', mode: 'OUT' },
  ],
  body: `
      OPEN p_result FOR
        ${getSurveysQuery};
    `,
});

const surveysSchema = new Schema()
  .addTable(surveysTable)
  .addTable(surveyResponsesTable)
  .addPackage(surveysPackage)
  .build();

const surveysSeed = new Seed('surveys')
  .addMany([
    {
      id: 1,
      title: 'Customer Satisfaction Survey',
      description: 'A survey to gauge customer satisfaction levels.',
      created: 'SYSTIMESTAMP',
      updated: null,
    },
    {
      id: 2,
      title: 'Employee Feedback Survey',
      description: 'Collecting feedback from employees about workplace environment.',
      created: 'SYSTIMESTAMP',
      updated: null,
    },
  ])
  .build();

export { surveysSchema, surveysSeed };
