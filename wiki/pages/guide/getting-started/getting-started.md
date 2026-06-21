# Creating Project

## Create Remote Repository

### Github

1. Sign in at github.com.
2. Click **+** (top-right) → **New repository**.
3. **Repository name**: enter a name.
4. Choose **Public** or **Private**.
5. **Important:** **leave UNCHECKED**: _Add a README_, _.gitignore_, _License_ (this keeps it empty).
6. Click **Create repository**.
7. Copy the repo URL (HTTPS or SSH), e.g.
   - HTTPS: `https://github.com/USER/REPO.git`
   - SSH: `git@github.com:USER/REPO.git`

### Bitbucket

1. Sign in at bitbucket.org.
2. Click **Create** → **Repository**.
3. **Repository name**: enter a name.
4. Choose **Public** or **Private**.
5. **Important:** uncheck _Include a README_ and _Include .gitignore_.
6. Click **Create repository**.
7. Copy the repo URL (HTTPS or SSH), e.g.
   - HTTPS: `https://bitbucket.org/USER/REPO.git`
   - SSH: `git@bitbucket.org:USER/REPO.git`

### GitLab

1. Sign in at gitlab.com.
2. Click **+** → **New project/repository** → **Create blank project**.
3. **Project name**: enter a name.
4. Choose **Public** or **Private**.
5. **Important:** uncheck _Initialize repository with a README_.
6. Click **Create project**.
7. Copy the repo URL (HTTPS or SSH), e.g.
   - HTTPS: `https://gitlab.com/USER/REPO.git`
   - SSH: `git@gitlab.com:USER/REPO.git`

## Setup Local Project

In VSCode Terminal:

1. Configure Git (first time only):

   ```bash
   git config --global core.autocrlf false
   git config --global user.email "your@email.address"
   git config --global user.name "Your Name"
   ```

2. Clone the repository:

   ```bash
   git clone <repository-url>
   cd <repository-name>
   ```
