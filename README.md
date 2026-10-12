# Peerly

A college-exclusive social platform where students connect within their campus community. Posts, anonymous confessions, community chats, and a global feed — all scoped to verified college email addresses.

---

## Features

- **Email-verified onboarding** — only students with a recognised college domain can register
- **Campus feed** — see posts from your own campus, sorted by latest, top, or trending (heat score)
- **Global feed** — cross-campus posts visible to all verified users
- **Anonymous posting** — post or confess without revealing your identity
- **Communities** — campus-scoped or global groups with role-based membership (owner → admin → moderator → member)
- **Real-time community chat** — Socket.IO-powered messaging with typing indicators and persistent history
- **Post votes & heat score** — upvote/downvote system with a computed trending score
- **Nested comments** — threaded replies on posts
- **Image uploads** — Cloudinary-backed media for posts and community messages
- **Post reporting** — flag spam, harassment, misinformation, or inappropriate content
- **Admin panel** — manage colleges, domains, and moderate reported content
- **Password reset** — email-based flow via Gmail SMTP
- **Google OAuth** — sign in with Google

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TailwindCSS 4, TanStack Query |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL via Supabase |
| Real-time | Socket.IO |
| Cache / Rate-limit | Redis (Upstash) |
| Image storage | Cloudinary |
| Auth | JWT (access + refresh tokens), Google OAuth |
| Email | Nodemailer + Gmail SMTP |
| Logging | Winston + Morgan |

---

## Project Structure

```
peerly/
├── client/          # Next.js frontend
│   ├── app/         # App Router pages
│   ├── components/  # Shared UI components
│   └── lib/         # API client, hooks, utilities
└── server/          # Express backend
    ├── database/    # SQL schema
    └── src/
        ├── modules/ # Feature modules (auth, posts, communities, …)
        ├── middleware/
        ├── integrations/
        └── shared/
```

---

## Prerequisites

- Node.js ≥ 20
- A [Supabase](https://supabase.com) project (free tier works)
- A [Cloudinary](https://cloudinary.com) account (free tier works)
- A [Upstash Redis](https://upstash.com) database (free tier works)
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) generated
- *(Optional)* A Google OAuth Client ID for Google sign-in

---

## Database Setup

1. Open your Supabase project → **SQL Editor** → **New Query**
2. Paste the entire contents of `server/database/schema.sql`
3. Click **Run**

All tables, indexes, and constraints will be created.

---

## Environment Variables

### Server — `server/.env`

Copy `server/.env.example` to `server/.env` and fill in every value:

```env
PORT=5000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# JWT
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Gmail SMTP
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password

# Google OAuth
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com

# Redis — Upstash
REDIS_URL=rediss://default:your_password@your-host.upstash.io:6379
```

### Client — `client/.env.local`

Copy `client/.env.local.example` to `client/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
```

> For the Cloudinary upload preset, create an **unsigned** preset in your Cloudinary dashboard under Settings → Upload → Upload Presets.

---

## Running Locally

### 1. Install dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Start the server

```bash
cd server
npm run dev
```

The API will be available at `http://localhost:5000`.  
Health check: `http://localhost:5000/health`

### 3. Start the client

```bash
cd client
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Seeding Data

To seed colleges and domains for local development:

```bash
cd server
npm run seed
```

---

## Production Build

### Server

```bash
cd server
npm run build      # compiles TypeScript → dist/
npm start          # runs dist/server.js
```

### Client

```bash
cd client
npm run build      # Next.js production build
npm start          # starts production server on port 3000
```

---

## API Overview

All routes are prefixed with `/api` and require a `Bearer <token>` header unless noted.

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register with email |
| POST | `/api/auth/login` | Login, returns access + refresh tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| POST | `/api/auth/forgot-password` | Send password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/google` | Google OAuth sign-in |
| GET | `/api/posts/campus` | Campus feed |
| GET | `/api/posts/global` | Global feed |
| POST | `/api/posts` | Create a post |
| DELETE | `/api/posts/:id` | Delete a post |
| POST | `/api/posts/:id/vote` | Upvote or downvote |
| GET | `/api/posts/:id/comments` | Get comments |
| POST | `/api/posts/:id/comments` | Add a comment |
| GET | `/api/posts/user/:username` | Get user's posts |
| GET | `/api/communities` | List communities |
| POST | `/api/communities` | Create a community |
| GET | `/api/communities/:id` | Get a community |
| POST | `/api/communities/:id/join` | Join a community |
| POST | `/api/communities/:id/leave` | Leave a community |
| GET | `/api/communities/:id/messages` | Fetch message history |
| GET | `/api/profile` | Get own profile |
| PATCH | `/api/profile` | Update own profile |
| GET | `/api/profile/:username` | Get public profile |
| POST | `/api/onboarding` | Complete onboarding |
| GET | `/api/admin/colleges` | List colleges (admin) |
| POST | `/api/admin/colleges` | Add a college (admin) |

---

## WebSocket Events (Socket.IO)

Connect to the server with a valid JWT in the `auth` handshake:

```js
const socket = io('http://localhost:5000/communities', {
  auth: { token: 'your_jwt_access_token' }
});
```

| Event (emit) | Payload | Description |
|---|---|---|
| `join_room` | `{ communityId }` | Join a community chat room |
| `leave_room` | `{ communityId }` | Leave a room |
| `send_message` | `{ communityId, content, image_url? }` | Send a message |
| `typing` | `{ communityId }` | Broadcast typing indicator |

| Event (listen) | Payload | Description |
|---|---|---|
| `new_message` | message object | New message in a room |
| `typing_indicator` | `{ communityId, username }` | Someone is typing |
| `error` | `{ message }` | Error from server |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes with a descriptive message
4. Push and open a pull request

---

