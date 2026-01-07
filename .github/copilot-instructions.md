# Copilot Instructions for OdbVue

## Code Style

### Typescript

Do not use `any` and do not disable linting rules. Always prefer strong typing.
Do not use eslint/no-unused-vars disable comments. Remove unused variables instead.

## Instructions

### Database

Conventions to follow when generating code for data base: apps\wiki\guide\apis\conventions.md

Sample DB package: 
- db\src\database\odbvue\package_specs\pck_adm.sql
- db\src\database\odbvue\package_bodies\pck_adm.sql

Put generated database scripts in: db\src\database\odbvue

### Vue

Conventions - sample app - to follow when generating code for vue: apps\src\pages\admin