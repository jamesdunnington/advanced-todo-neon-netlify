# Advanced Todo (Neon + Netlify)

A modern Todo app with advanced features, built as a Vite SPA with a Netlify Functions API backed by Neon Postgres.

Theme: pink, white, and black.

## Features

- CRUD tasks: title, notes, tags, due date, priority, completed
- Search, filter by status, and sorting (created/due/priority)
- Serverless API via Netlify Functions
- Neon Postgres for persistence
- SPA redirect configured for deep links

## Stack

- Vite + vanilla JS
- Netlify Functions (Node 18, ESM)
- Neon Postgres (`@neondatabase/serverless`)

## Project Structure

```
advanced-todo/
  index.html
  src/
    main.js
    api.js
    styles.css
  netlify/
    functions/
      tasks.mjs
  public/
    _redirects
  sql/
    schema.sql
  netlify.toml
  package.json
  .env.example
```

## Local Dev

1. Install deps
   ```bash
   npm install
   npm run dev
   ```
   Note: API calls expect Netlify Functions. For a true local API, use `netlify dev` in another terminal or deploy.

## Database (Neon)

1. Create a Neon project and a database.
2. Copy the connection string and set it as `NEON_DATABASE_URL` (ensure `sslmode=require`).
3. Run `sql/schema.sql` in the Neon SQL Editor to create the `tasks` table and indexes.

## Deploy (Netlify)

1. Create a new GitHub repo and push this project.
2. In Netlify, New site from Git → select repo.
3. Build command: `npm run build`  |  Publish directory: `dist`
4. Add env var: `NEON_DATABASE_URL` (from Neon).
5. Deploy. The SPA redirect is configured via `public/_redirects` and `netlify.toml`.

## API

Base: `/.netlify/functions/tasks`

- GET `/tasks` (query: `q`, `status`=all|active|completed, `sort`=created|due|priority)
- GET `/tasks/:id`
- POST `/tasks` `{ title, notes?, tags?: string[], due_date?: ISO, priority?: 1|2|3, completed?: boolean }`
- PUT `/tasks/:id` partial body to update any field
- DELETE `/tasks/:id`

All responses are JSON. CORS enabled (wide-open by default).

## Notes

- Netlify Functions use native ESM with Node 18.
- The Neon serverless driver is used; no TCP pooling required.
- For auth/multi-user separation, add an auth layer and per-user scoping columns.

