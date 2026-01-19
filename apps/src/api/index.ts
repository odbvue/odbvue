import { Schema, Entity } from '../__db__/'

const appUsers = new Entity('app_users', {
  description: 'Table for storing and processing user data',
})
  .addAttribute('id', 'id', { description: 'Primary key' })
  .addAttribute('uuid', 'guid', { description: 'Unique user identifier' })
  .addAttribute('username', 'string200', { required: true, description: 'Username' })
  .addAttribute('password', 'string2000', { required: true, description: 'Password' })
  .addAttribute('fullname', 'string200', { required: true, description: 'Full name' })
  .addAttribute('status', 'char', {
    required: true,
    default: 'A',
    description: 'Status (A - active; D - disabled; N - uNverified)',
  })
  .addAttribute('created', 'now', { description: 'Date and time when user was created' })
  .addAttribute('attempts', 'integer', {
    required: true,
    default: '0',
    description: 'Number of authentication attempts',
  })
  .addAttribute('accessed', 'timestamp', {
    description: 'Date and time when user performed last successful login',
  })
  .addAttribute('attempted', 'timestamp', { description: 'Timestamp of the last login attempt' })
  .primaryKey('id')
  .unique('username')
  .indexes('status', 'created')
  .check('status', ['A', 'D', 'N'])

const appSchema = new Schema('odbvue').addEntity(appUsers)

export default appSchema
