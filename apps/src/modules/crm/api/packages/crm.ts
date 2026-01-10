import { ParamType as pt, Procedure, Package } from '../../../../apis/package'
import { Query } from '../../../../apis/query'
import { Upsert } from '../../../../apis/upsert'

const query = new Query()
  .from('crm_persons')
  .select([
    'guid AS "id"',
    "TRIM(first_name || ' ' || last_name || ' ' || legal_name) AS \"fullname\"",
    'type AS "type"',
    'created AS "created"',
  ])
  .orderBy('created', 'DESC')
  .offsetP('p_offset')
  .limitP('p_limit')

const getPersons = new Procedure('get_persons', 'Gets list of persons')
  .addQueryParameter('p_filter', pt.String, 'Filter for persons')
  .addQueryParameter('p_sort', pt.String, 'Sort order for persons')
  .addQueryParameter('p_limit', pt.Integer, 'Limit number of persons')
  .addQueryParameter('p_offset', pt.Integer, 'Offset for pagination')
  .addResponse('r_persons', pt.Object, 'List of persons')
  .navigationGuard('role', 'crm')
  .returnQuery(query, 'r_persons')

const personUpsert = new Upsert()
  .table_name('crm_persons')
  .set('first_name', 'p_first_name')
  .set('last_name', 'p_last_name')
  .set('legal_name', 'p_legal_name')
  .set('modified', 'SYSTIMESTAMP')
  .where('id = p_id')

const postPerson = new Procedure('post_person', 'Create or update a person')
  .addParameter('p_id', pt.Integer, 'Person ID (null for insert)', 'IN', { notNull: false })
  .addParameter('p_first_name', pt.String, 'First name', 'IN')
  .addParameter('p_last_name', pt.String, 'Last name', 'IN')
  .addParameter('p_legal_name', pt.String, 'Legal name', 'IN')
  .navigationGuard('role', 'crm')
  .upsertStatement(personUpsert)

const organizationUpsert = new Upsert()
  .table_name('crm_persons')
  .set('legal_name', 'p_legal_name')
  .set('modified', 'SYSTIMESTAMP')
  .where('id = p_id')

const postOrganization = new Procedure('post_organization', 'Create or update an organization')
  .addParameter('p_id', pt.Integer, 'Organization ID (null for insert)', 'IN', { notNull: false })
  .addParameter('p_legal_name', pt.String, 'Legal name', 'IN')
  .navigationGuard('role', 'crm')
  .upsertStatement(organizationUpsert)

export const crmPackage = new Package('pck_crm_v2', 'CRM Package')
  .editionable()
  .addProcedure(getPersons)
  .addProcedure(postPerson)
  .addProcedure(postOrganization)
