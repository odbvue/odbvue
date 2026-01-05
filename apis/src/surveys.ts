import { Schema } from './types';
import { createTable, createProcedure, createPackage, createSchema } from './utils';

// Define surveys table
const surveys = createTable('surveys');
surveys.addColumn('id', 'int').primaryKey().notNullable();
surveys.addColumn('title', 'varchar').notNullable();
surveys.addColumn('description', 'text');
surveys.addColumn('created', 'datetime').notNullable().default('SYSTIMESTAMP');
surveys.addColumn('updated', 'datetime');
surveys.comment('Table storing survey information');

// Add seed data
surveys.upsert(
  {
    id: 1,
    title: 'Customer Satisfaction Survey',
    description: 'A survey to gauge customer satisfaction levels.',
    created: new Date(),
  },
  { id: 1 },
);

// Define procedures
const getSurveys = createProcedure('get_surveys')
  .addParam('p_filter', 'VARCHAR2', 'IN', 'NULL')
  .addParam('p_limit', 'NUMBER', 'IN', '100')
  .addParam('p_offset', 'NUMBER', 'IN', '0')
  .addParam('p_result', 'SYS_REFCURSOR', 'OUT').body(`
    OPEN p_result FOR
      SELECT id, title, description, created, updated
      FROM surveys
      WHERE (p_filter IS NULL OR title LIKE '%' || p_filter || '%')
      OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;
  `);

// Define package
const surveysPackage = createPackage('pck_surveys').addProcedure(getSurveys);

// Build complete schema
const schema: Schema = createSchema().addTable(surveys).addPackage(surveysPackage).build();

export { schema };
