# CRM Module

## General instructions

.github\copilot-instructions.md

## Stories

### Surveys

User with role CRM must be able to view list of surveys
User with role CRM must be able to create new survey
User with role CRM must be able to edit survey

### Products

User with role CRM must be able to view list of products
User with role CRM must be able to create new product
User with role CRM must be able to edit existing product

..

## Data model

### crm_products

id: number generated always primary key
guid: guid default unique not null
code: string 200 unique not null
name: string 200 not null
description: string 2000
price: number not null
status: A | I (Active | Inactive) default A
created: timestamp not null default systimestamp
modified: timestamp

### crm_surveys

id: number generated always primary key
code: hex virtual always generate from id unique
title: string 200
description: string 2000
valid_from: timestamp not null default systimestamp
valid_to: timestamp
active: Y | N
author: fk to app_users.uuid not null
created: timestamp not null default systimestamp
editor: fk to app_users.uuid
updated: timestamp

crm_survey_responses:
id: number generated always primary key
survey_id: fk to crm_surveys.id
responses: json
author: fk to app_users.uuid not null
created: timestamp not null default systimestamp

crm_survey_questions:
id: number generated always primary key
survey_id: fk to crm_surveys.id
position: number
question: text | multiline text for choices
type: free text | number | single choice | multiple choices | rating 5 | none
required: Y | N

## API

### Products

get:
products:
query params:
filter: string
sort: string
limit: number default 10
offset: number default 0
output:
products: [id, code, name, description, price, status, created]

post:
product:
body params:
id: guid (null for insert)
code: string
name: string
description: string
price: number

### Surveys

get:
surveys:
query params:
search: string
limit: number default 10
offset: number default 0
output:
data: [code, title, description, validFrom, validTo, author, created, editor, updated, active, count_questions, count_survey_responses]

surveys-questions:
query params:
filter: string - code:[code]
limit: number default 10
offset: number default 0
output:
data: [id, position, question, type, required]

surveys-responses:
query params:
code: crm_surveys.code
output:
download file

post:
survey:
body params:
data: [code, title, description, validFrom, validTo, questions]

survey-question:
body params:
data: [id, code, position, question, type, required]

survey-question-up:
body params:
data: [id]

survey-question-down:
body params:
data: [id]

survey-question-delete:
body params:
data: [id]

survey-response:
body params:
data: [code, responses]

## UI

### crm (main page)

Tab: Products - VOvTable with product list, columns: code, name, description, price
Actions: Add new product, Edit product (row action)

### crm/surveys

OV Table with survey list and actions: add, edit, download results

### crm/surveys/:code

OV Form for editing survey

OV Table for listing questions with actions add, edit, move up, move down, delete

### survey/:code

One-by-one stepper with questions at the end submits all responses

Do not show stepper or step x of y. Just next | prev / next | prev / finish buttons

If required is not answered - next | finish is disabled

## Security

surveys\* access and visibility with a role CRM - any user with role can view all responses

survey/:code - access always, visibility none

## Notes

Download format for surveys-responses: JSON

crm_survey_questions.type = 'none' means that there is no question expected - it is intended as static greeting / farewell etc text

survey_questions_question is clob in markdown format

POST survey-response format - json [{id, answer},..]

GET survey-responses format in JSON:

{
survey: {
code: 12ab
title: survey title
},
responses:
[
submitted_by: fullname
submitted_at: timestamp
responses: [
{
question: question
answer: answer
},
..
]
]
}

Rating 5 is stars 1-5, stored in responses as number value

POST survey code - if null then new record, otherwise update
