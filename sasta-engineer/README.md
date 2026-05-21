# FIXGHAR — Home Service Booking Platform

HTML/CSS/JS frontend + Node.js/Express/MongoDB backend.

## Project structure

```
backend/
  src/           # config, controllers, routes, models, middleware, utils
  uploads/       # fixer profile & document uploads
  server.js      # entry point
  package.json
  .env.example

frontend/
  assets/        # images & icons
  css/
  js/
  pages/         # user & fixer dashboards
  index.html
  vercel.json
```

## Prerequisites

- Node.js 18+
- MongoDB Atlas cluster
- (Optional) MSG91 or Twilio for OTP SMS

## Local setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — set MONGODB_URI, JWT_SECRET, CORS_ORIGINS
npm run dev
```

Backend runs at `http://localhost:5000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3030` (see `frontend/http-server.js`).

### 3. Run both (from project root)

```bash
npm install
npm run install-all
npm run dev
```

## Scripts

| Location   | Command        | Description              |
|-----------|----------------|--------------------------|
| `backend/` | `npm run dev`  | Nodemon API server       |
| `backend/` | `npm start`    | Production API server    |
| `frontend/` | `npm start` | Static frontend server   |
| root      | `npm run dev`  | Backend + frontend       |

## Environment variables

See `backend/.env.example`. Required for production:

- `PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`
- `CORS_ORIGINS` — include your Vercel URL and `http://localhost:3030`

## API testing (Thunder Client / Postman)

Base URL: `http://localhost:5000/api`

### Health

```
GET /health
```

### User signup

```
POST /auth/user/signup
Content-Type: application/json

{
  "name": "Test User",
  "email": "user@example.com",
  "phone": "9876543210",
  "password": "Test@1234",
  "address": {
    "street": "12 Main St",
    "city": "Noida",
    "state": "UP",
    "zipCode": "201301"
  }
}
```

### Fixer signup

```
POST /auth/fixer/signup
Content-Type: application/json

{
  "name": "Test Fixer",
  "username": "fixer_test",
  "email": "fixer@example.com",
  "phone": "9876543211",
  "password": "Test@1234",
  "serviceCategory": "Plumbing",
  "address": {
    "street": "12 Main St",
    "city": "Noida",
    "state": "UP",
    "zipCode": "201301"
  }
}
```

### Verify OTP (after signup)

```
POST /auth/verify-otp

{
  "phone": "+919876543210",
  "otp": "123456",
  "userType": "user"
}
```

### Login (user or fixer)

```
POST /auth/login

{
  "email": "user@example.com",
  "password": "Test@1234",
  "role": "user"
}
```

Use `"role": "fixer"` for fixer accounts. Response includes `data.token`; cookies `fixghar_token` are also set when using a browser.

### Current user

```
GET /auth/me
Authorization: Bearer <token>
```

### Logout

```
POST /auth/logout
Authorization: Bearer <token>
```

## Deployment

### Backend (Render)

- Root directory: `backend`
- Build: `npm install`
- Start: `npm start`
- Set env vars from `.env.example` in Render dashboard

### Frontend (Vercel)

- Root directory: `frontend`
- Framework: Other (static)
- Set `frontend/config.js` production API URL to your Render URL if different from default

## Security notes

- Never commit `.env` or `config.env`
- Passwords are hashed with bcrypt
- Helmet, rate limiting, and upload validation are enabled
- OTP codes are not returned in production signup responses
