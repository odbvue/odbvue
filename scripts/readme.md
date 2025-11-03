
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

```bash
mkdir db
cd db
sql /nolog
project init -name odbvue-db
# Your project has been successfully created
proj config set -name schemas -value odbvue
# Process completed successfully
!git add .
!git commit -m "db - project init"
exit
cd ..
```

---

### Step 1. Create new feature

#### `./create-feature.sh [feature-name]`

```bash
git checkout main
git pull origin main
git checkout -b feat/[feature-name]
```

### Step X. Develop Database

#### creating and altering objects in local db
project export
git add .
git commit

#### inserting and updating data
project stage add-custom -file-name [file-name]
git add .
git commit

### Step X. Stage Database changes

Commits and stages database changes.

#### `./scripts/stage-db.sh [connection-string] [commit-message]`

```bash
#./scripts/stage-db.ps1 "admin/MySecurePass123!@127.0.0.1:1521/myatp" "test staging"
cd db
git add .
git commit "db: [commit-message]"
sql /nolog
> connect [connection-string]
> project stage 
> exit
git add .
git commit "db stage: [commit-message]"
echo "Database changes staged anb committed: [commit-message]"
cd ..
```

### Step X. Create PR

Check if all code is committed, create changeset, push to origin

#### `./scripts/submit-pr.sh`

```bash
cd apps
pnpm changeset
```

You'll be prompted to:

- Choose the version bump type: patch, minor, or major
- Write a concise [summary-of-the-changes]
- Select which packages changed (usually main app)

```bash
git add .
git commit -m "changeset: [summary-of-the-changes]"
git push -u origin feat/your-feature-name
cd ..
```

### Step X. Approve PR

On GitHub - create, review, approve and merge pull request

- Open a PR against `main`
- Request reviews
- Address feedback and push updates
- Ensure CI/CD checks pass

### Step X. Close feature

#### `./scripts/close-feature.sh`

```bash
git checkout main
git pull origin main
git merge --squash [current-branch]
git push
git branch -d [current-branch]
git push origin --delete [current-branch]
echo "Feature closed"
```

### Step X. Release

Create and publish release

#### `./scripts/release.sh [version] [message]`

```bash
git checkout main
git pull origin main

bump json packages version to [version] (remove v prefix)

# todo later: sql /nolog

git add .
git commit -m "release: [version] [message]"

git tag -a [version] -m "Release [version] [message]"
git push origin [version]
```
