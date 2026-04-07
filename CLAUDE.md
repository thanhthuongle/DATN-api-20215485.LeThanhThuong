# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Node.js + Express.js + MongoDB** backend API for a personal finance management application called "Hey Money". The application supports:
- User authentication (register, login, JWT refresh tokens)
- Family/group finance management
- Transaction tracking (expenses, income, transfers, loans, borrowing)
- Budgets, savings, and accumulation goals
- Bank account management
- Notifications system
- Real-time features via Socket.IO
- Background job processing via Agenda

The codebase follows a **layered architecture**:
- **Routes** (`src/routes/`) - Define API endpoints and HTTP method mappings
- **Controllers** (`src/controllers/`) - Handle HTTP request/response logic
- **Services** (`src/services/`) - Business logic layer
- **Models** (`src/models/`) - Data access layer (MongoDB collections with Joi validation)
- **Middlewares** (`src/middlewares/`) - Express middleware (auth, CORS, error handling, file uploads)
- **Validations** (`src/validations/`) - Request validation schemas using Joi
- **Providers** (`src/providers/`) - External service integrations (Cloudinary, Brevo email, JWT)
- **Utils** (`src/utils/`) - Helper utilities (constants, formatters, seed data)
- **Agenda** (`src/agenda/`) - Background job scheduler setup

## Development Setup

### Prerequisites
- Node.js (v16+)
- MongoDB (with Replication enabled - required for change streams/change streams features)
- Yarn or npm

### Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in all required environment variables in `.env`:
   - `MONGODB_URI_DEVELOPMENT` / `MONGODB_URI_PRODUCTION` - MongoDB connection strings
   - `DATABASE_NAME` - Database name
   - `BUILD_MODE` - Set to `dev` or `production`
   - `LOCAL_DEV_APP_HOST` and `LOCAL_DEV_APP_PORT` - For local development
   - `ACCESS_TOKEN_SECRET_SIGNATURE` and `REFRESH_TOKEN_SECRET_SIGNATURE` - JWT secrets
   - `ACCESS_TOKEN_LIFE` and `REFRESH_TOKEN_LIFE` - Token expiry (ms format, e.g., `14d`)
   - `BREVO_API_KEY`, `ADMIN_EMAIL_ADDRESS`, `ADMIN_EMAIL_NAME` - Email service
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - File uploads
   - `WEBSITE_DOMAIN_DEVELOPMENT` / `WEBSITE_DOMAIN_PRODUCTION` - For CORS and links
   - `AUTHOR` - Displayed in server logs

**Important**: The backend requires MongoDB with Replication support (Replica Set) as Agenda and some features may depend on MongoDB change streams.

### Installation
```bash
yarn install
```

### Running the Application

**Development mode** (with hot reload via nodemon):
```bash
yarn dev
```
Server runs on `http://LOCAL_DEV_APP_HOST:LOCAL_DEV_APP_PORT` (defined in `.env` or defaults).

**Production mode** (compiled Babel output):
```bash
yarn production
```
Server runs on `process.env.PORT`.

### Code Quality

**Linting** (ESLint with Babel parser):
```bash
yarn lint
```

**Building** (transpile ES6+ to ES5 via Babel):
```bash
yarn build
```
Output goes to `./build/` directory.

## Project Structure

```
src/
├── agenda/              # Agenda job scheduler setup
│   ├── agenda.js        # Agenda configuration and job definitions
│   └── loadSystemTasks.js # Loads recurring system tasks
├── config/              # Configuration files
│   ├── cors.js          # CORS policy (whitelist-based)
│   ├── environment.js   # Environment variables wrapper
│   └── mongodb.js       # MongoDB connection helpers
├── controllers/         # Request handlers (one per domain)
│   ├── userController.js
│   ├── transactionController.js
│   └── ...
├── data/                # Static/seed data
│   ├── banks.js         # Bank list data
│   └── categoriesDefault.js
├── middlewares/         # Express middlewares
│   ├── authMiddleware.js       # JWT verification
│   ├── errorHandlingMiddleware.js # Central error handler
│   ├── familyMiddleware.js     # Family membership checks
│   └── multerUploadMiddleware.js # File upload handling
├── models/              # MongoDB collection access (data layer)
│   ├── userModel.js
│   ├── transactionModel.js
│   └── ...
├── providers/           # External service integrations
│   ├── BrevoProvider.js # Email service
│   ├── CloudinaryProvider.js # Image upload
│   └── JwtProvider.js   # JWT sign/verify
├── routes/              # Express routers (API endpoint definitions)
│   ├── index.js         # Mounts all route modules
│   ├── userRoutes.js
│   └── ...
├── services/            # Business logic
│   ├── userService.js
│   └── ...
├── sockets/             # Socket.IO real-time setup
├── systemTasks/         # Background job definitions (Agenda jobs)
├── utils/               # Utilities
│   ├── ApiError.js      # Custom error class
│   ├── constants.js     # App constants (enums, whitelist)
│   ├── validators.js    # Reusable Joi validators
│   └── ...
├── validations/         # Request validation schemas (Joi)
│   ├── userValidation.js
│   └── ...
└── server.js            # Application entry point - sets up Express, DB, Agenda, Socket.IO
```

## Key Conventions

### Routing Pattern
- Routes are organized by domain (e.g., `/users`, `/transactions`)
- Each route file exports a single `express.Router()` instance
- All routes mounted in `src/routes/index.js` under the `APIs`router

### Controller Pattern
- Controllers receive `(req, res, next)` parameters
- Business logic delegated to Services
- Errors passed to `next(error)` for centralized error handling
- Use `StatusCodes` from `http-status-codes` for response statuses
- Authentication tokens stored in HTTP-only cookies (`accessToken`, `refreshToken`)

### Service Pattern
- Services contain business logic and coordinate between models
- Services throw errors (caught in controllers)
- Services return plain objects/arrays

### Model Pattern
- Each model defines:
  - `COLLECTION_NAME` - MongoDB collection name
  - `COLLECTION_SCHEMA` - Joi validation schema for data integrity
  - CRUD operations (`createNew`, `findOneById`, `update`, etc.)
- Uses `GET_DB()` from `~/config/mongodb` to get the database connection
- IDs converted to `ObjectId` for queries
- Soft delete supported via `_destroy` field

### Validation Pattern
- Request validation uses Joi schemas defined in `src/validations/`
- Validation middleware applied in routes before controllers
- Example: `userValidation.createNew` validates registration payload

### Authentication & Authorization
- JWT-based authentication with access and refresh tokens
- Access token verified via `authMiddleware.isAuthorized`
- Refresh token endpoint at `/users/refresh_token`
- Tokens stored in HTTP-only, secure cookies (sameSite: 'none')
- `req.jwtDecoded` populated after auth middleware

### Middlewares Stack Order (in server.js)
1. Cache-Control header (no-store)
2. Cookie parser
3. CORS (with whitelist for production)
4. `express.json()` body parser
5. `express.urlencoded()` for form data
6. API routes mounted at `/`
7. Error handling middleware (catch-all)

### Error Handling
- Centralized in `src/middlewares/errorHandlingMiddleware.js`
- Custom `ApiError` class used throughout
- Errors passed via `next(error)` to be caught by error middleware

### Background Jobs (Agenda)
- Agenda configured in `src/agenda/agenda.js`
- System tasks defined in `src/systemTasks/`
- Tasks loaded via `loadSystemTasks(agenda)`
- Uses MongoDB for job persistence
- Common job types: reminders, budget repeat notifications, auto-processing savings

### File Uploads
- Multer middleware: `multerUploadMiddleware`
- Single file upload: `.single('fieldName')`
- Files uploaded to Cloudinary via `CloudinaryProvider`

### Database Requirements
- MongoDB **with Replication** (Replica Set) required
- Change streams used by some features (Agenda may also use MongoDB job storage)

## Common Development Tasks

### Add a New API Endpoint
1. Define validation schema in `src/validations/` (e.g., `myResourceValidation.js`)
2. Add controller methods in `src/controllers/myResourceController.js`
3. Add business logic in `src/services/myResourceService.js`
4. Define data model in `src/models/myResourceModel.js` (with Joi schema)
5. Create routes in `src/routes/myResourceRoutes.js` using `Router` and apply middlewares
6. Register router in `src/routes/index.js` with `Router.use('/myresources', myResourceRoutes)`

### Add a New Background Job
1. Create job definition in `src/systemTasks/` using Agenda's job API
2. Register in `src/agenda/loadSystemTasks.js` using `agenda.define()`
3. Optionally schedule with `agenda.every()` or `agenda.schedule()`

### Modify Database Schema
- Update `COLLECTION_SCHEMA` in the corresponding model file
- Add/remove fields with appropriate Joi validators
- Remember to handle migrations if changing existing fields

## Notes
- Babel is configured with `module-resolver` alias `~` pointing to `./src`
- ESLint uses `@babel/eslint-parser` with relaxed settings (no import restrictions)
- Socket.IO initialized in `src/sockets/` and attached to HTTP server
- CORS allows credentials; whitelist domains in production (see `src/utils/constants.js`)
- Environment-specific configuration via `BUILD_MODE` switch
- Server start sequence: Connect DB → Seed default data (banks) → Start Agenda → Start HTTP server
