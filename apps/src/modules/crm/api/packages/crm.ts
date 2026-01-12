import { ParamType as pt, Procedure, Package } from '../../../../apis/package'
import { Query } from '../../../../apis/query'
import { Upsert } from '../../../../apis/upsert'

// Products Query
const productsQuery = new Query()
  .from('crm_products')
  .select([
    'code AS "id"',
    'code AS "code"',
    'name AS "name"',
    'description AS "description"',
    'price AS "price"',
    'status AS "status"',
    'created AS "created"',
  ])
  .orderBy('name', 'ASC')
  .offsetP('p_offset')
  .limitP('p_limit')

const getProducts = new Procedure('get_products', 'Gets list of products')
  .addQueryParameter('p_filter', pt.String, 'Filter for products')
  .addQueryParameter('p_sort', pt.String, 'Sort order for products')
  .addQueryParameter('p_limit', pt.Integer, 'Limit number of products')
  .addQueryParameter('p_offset', pt.Integer, 'Offset for pagination')
  .addResponse('r_products', pt.Object, 'List of products')
  .navigationGuard('role', 'crm')
  .returnQuery(productsQuery, 'r_products')

const productUpsert = new Upsert()
  .table_name('crm_products')
  .set('code', 'p_code')
  .set('name', 'p_name')
  .set('description', 'p_description')
  .set('price', 'p_price')
  .set('modified', 'SYSTIMESTAMP')
  .where('code = p_code')

const postProduct = new Procedure('post_product', 'Create or update a product')
  .addParameter('p_code', pt.String, 'Product code', 'IN')
  .addParameter('p_name', pt.String, 'Product name', 'IN')
  .addParameter('p_description', pt.String, 'Product description', 'IN', { notNull: false })
  .addParameter('p_price', pt.Number, 'Product price', 'IN')
  .navigationGuard('role', 'crm')
  .upsertStatement(productUpsert)

// Persons Query
const query = new Query()
  .from('crm_persons')
  .select([
    'guid AS "id"',
    "TRIM(first_name || ' ' || last_name || ' ' || legal_name) AS \"fullname\"",
    'type AS "type"',
    'phone AS "phone"',
    'email AS "email"',
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
  .set('type', "'I'")
  .set('first_name', 'p_first_name')
  .set('last_name', 'p_last_name')
  .set('phone', 'p_phone')
  .set('email', 'p_email')
  .set('modified', 'SYSTIMESTAMP')
  .where('id = p_id')

const postPerson = new Procedure('post_person', 'Create or update a person')
  .addParameter('p_id', pt.Integer, 'Person ID (null for insert)', 'IN', { notNull: false })
  .addParameter('p_first_name', pt.String, 'First name', 'IN')
  .addParameter('p_last_name', pt.String, 'Last name', 'IN')
  .addParameter('p_phone', pt.String, 'Phone number', 'IN')
  .addParameter('p_email', pt.String, 'Email address', 'IN')
  .navigationGuard('role', 'crm')
  .upsertStatement(personUpsert)

const organizationUpsert = new Upsert()
  .table_name('crm_persons')
  .set('type', "'O'")
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
  .addProcedure(getProducts)
  .addProcedure(postProduct)
  .addProcedure(getPersons)
  .addProcedure(postPerson)
  .addProcedure(postOrganization)
