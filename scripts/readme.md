# Scripts Summary

## Setup

1. Copy `.env.example` to `.env` and configure your values
2. Load environment before running scripts:

```bash
bash load-env.sh
```

## Available Scripts

| Script | Params | Description |
|--------|--------|-------------|
| `create-feature.sh` | `<feature-name>` | Creates a new feature branch (`feat/<feature-name>`) from main |
| `close-feature.sh` | None | Closes current feature branch, squash-merges to main, deletes local and remote branch |
| `db-export.sh` | `<CommitMessage> <Connection>` | Exports database project changes and commits to git |
| `db-add-custom.sh` | `<path-to-file> <commit-message>` | Stages custom database file and commits |
| `submit-pr.sh` | `<Connection>` | Stages database changes, creates changeset, commits and pushes to remote |
| `release.sh` | `[-m "message"]` | Increments version, creates release tag, publishes to git |

