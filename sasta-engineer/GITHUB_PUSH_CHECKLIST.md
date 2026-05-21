# GitHub push checklist

Run from repo root: `c:\Users\shubh\OneDrive\Desktop\sasta-engineer`

## Before commit

```powershell
git status
git diff --stat
```

Confirm **NOT staged**:

- `backend/.env`, `backend/config.env`
- `backend/node_modules/`, `frontend/node_modules/`
- uploaded files in `backend/uploads/` (except `.gitkeep`)

## Stage production structure

```powershell
git add sasta-engineer/backend/src/
git add sasta-engineer/backend/server.js
git add sasta-engineer/backend/package.json
git add sasta-engineer/backend/package-lock.json
git add sasta-engineer/backend/.env.example
git add sasta-engineer/backend/Dockerfile
git add sasta-engineer/backend/.dockerignore
git add sasta-engineer/backend/uploads/.gitkeep
git add sasta-engineer/frontend/
git add sasta-engineer/README.md
git add sasta-engineer/docker-compose.yml
git add sasta-engineer/render.yaml
git add sasta-engineer/.gitignore
git add -u sasta-engineer/
```

## Secret scan (manual)

Search for accidental keys:

```powershell
git grep -i "mongodb+srv://" 
git grep -i "JWT_SECRET="
```

## Commit

```powershell
git commit -m "Production refactor: backend src layout, security fixes, Docker and deploy configs"
```

## Push

```powershell
git push origin main
```
