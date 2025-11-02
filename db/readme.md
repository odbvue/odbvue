
git checkout -b feat/cicd-db
mkdir db
cd db

sql /nolog
project init -name odbvue-db
# Your project has been successfully created
!git add .
!git commit -m "db init project"

project release -version v0.0.0
!git add .
!git commit -m "db init project release"

000_before_deploy.sql
777_marker.sql
999_after_deploy.sql
install.sql

.gitignore
.env

deploy.sh

release-tag.yml
deploy.yml

changeset

proj config set -name schemas -value odbvue

---
# dx

git checkout main
git pull origin main
git checkout -b feat/[feature-name]

mkdir db
cd db

sql /nolog
project init -name odbvue-db
# Your project has been successfully created
proj config set -name schemas -value odbvue
# Process completed successfully
!git add .
!git commit -m "db - project init"


---


### Step 1. Start new feature

./begin-new-feature.sh [feature-name]

git checkout main
git pull origin main
git checkout -b feat/[feature-name]

### Step 2. Develop


#### Database First 

#### Database DDL

#### Database DML

development in local db

project export
git add .
git commit
project stage 
git add .
git commit


changest

git push -u origin feat/your-feature-name
```

Then on GitHub:

- Open a PR against `main`
- Request reviews
- Address feedback and push updates
- Ensure CI/CD checks pass

### Step 6. Merge to main

```bash
git checkout main
git pull origin main
git merge --squash feat/your-feature-name
git push

bump json package
git add .
git commit
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

---

# Example Template

The introduction summarizes the purpose and function of the project, and should be concise (a brief paragraph or two). This introduction may be the same as the first paragraph on the project page.

For a full description of the module, visit the
[project page](https://www.oracle.com).

Submit bug reports and feature suggestions, or track changes in the
[issue queue](https://www.oracle.com).


## Table of contents (optional)

- Requirements
- Installation
- Configuration
- Troubleshooting
- FAQ
- Maintainers


## Requirements (required)

This project requires the following:

- [Hard Work](https://www.noMorePlay.com)


## Installation (required, unless a separate INSTALL.md is provided)

Install as you would normally install.

## Configuration (optional)

## Troubleshooting (optional)

## FAQ (optional)

**Q: How do I write a README?**

**A:** Follow this template. It's fun and easy!

## Maintainers (optional)


## For more information about SQLcl Projects:
Reach out to the SQLcl Project Extension documentation by visiting the [Database Application CI/CD Doc Link](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/24.3/sqcug/database-application-ci-cd.html).
