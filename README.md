# Ripple - Social Media Platform (CodeAlpha Task 2)

A mini social network built with **HTML, CSS, vanilla JavaScript**, **Node.js + Express**, **MongoDB (Mongoose)** and **Cloudinary** for photo uploads.

## Features
- Sign up, log in, log out (bcrypt + JWT)
- User profiles: photo, bio, post / follower / following counts, edit profile
- Posts with text and photos (280 characters), delete your own posts
- Home feed (you + people you follow) and Explore feed, with "Load more" pagination
- Like / unlike with instant (optimistic) updates
- Comments on posts, delete your own comments (or any comment on your post)
- Follow / unfollow, "Who to follow" suggestions, people search
- Profile tabs: Posts and Likes
- Light and dark mode, responsive layout (sidebar on desktop, tab bar on mobile)
- Security: helmet (CSP), rate limiting, input validation, Cloudinary-only image URLs

## Database collections
`users` (followers and following stored on the user), `posts` (likes stored on the post), `comments`

## Run locally
```bash
npm install
copy .env.example .env      # Mac/Linux: cp .env.example .env
npm start
```
Open http://localhost:3000. Fill `.env` (see below).

### .env
| Variable | What it is |
|---|---|
| `MONGO_URI` | MongoDB connection string, ending with `/ripple_social` |
| `JWT_SECRET` | any long random text |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | from cloudinary.com > Dashboard > API Keys |

Photo upload is signed by the server and sent straight from the browser to Cloudinary, so large images never pass through the serverless function. Without Cloudinary keys everything else works; only photo upload shows "not configured".

## Deploy on Vercel
1. Push this folder to GitHub (never commit `.env`).
2. Vercel > Add New > Project > import the repo.
3. Add the 5 environment variables above (Framework preset: Other), then Deploy.

## API
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | Create account / log in |
| GET | /api/auth/me | Current user |
| GET | /api/users/search?q= , /api/users/suggestions | Find people |
| GET | /api/users/:username | Profile |
| PUT | /api/users/me | Update name, bio, photo |
| POST | /api/users/:username/follow | Follow / unfollow (toggle) |
| GET | /api/posts?feed=following\|explore&author=&liked=&before= | Feeds, profile posts, liked posts |
| POST | /api/posts | Create post |
| DELETE | /api/posts/:id | Delete own post |
| POST | /api/posts/:id/like | Like / unlike (toggle) |
| GET, POST | /api/posts/:id/comments | List / add comments |
| DELETE | /api/posts/:id/comments/:commentId | Delete comment |
| GET | /api/upload/sign | Signed Cloudinary upload params |

## Structure
```
CodeAlpha_SocialMediaApp/
├── server.js  api/index.js  vercel.json
├── models/ (User, Post, Comment)
├── routes/ (auth, users, posts, upload)
├── middleware/auth.js   lib/util.js
└── public/ (index.html, style.css, app.js, favicon.svg)
```
