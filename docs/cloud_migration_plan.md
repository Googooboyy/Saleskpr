# Task: Cloud Migration Implementation Plan

This plan tracks the step-by-step transition of the Awesome Printing Company Dashboard from a local prototype to a secure, cloud-hosted application.

## Current Progress: [        ] 0%

---

## Phase 1: Secure Baseline (Git & Environment)
- [>] **Current Focus**: Install Node.js LTS and Git (User Action)
- [ ] Initialize Git repository (`git init`)
- [ ] Create strict `.gitignore` (Block `.env`, `node_modules`, etc.)
- [ ] Create Private GitHub Repository and link locally
- [ ] Push initial code to Private GitHub

## Phase 2: Modernization (Vite Transition)
- [ ] Initialize Vite project structure
- [ ] Migrate `index.html`, `style.css`, and `app.js` into Vite (ESM)
- [ ] Set up `.env` template
- [ ] Verify local development server (`npm run dev`)

## Phase 3: Cloud Infrastructure (Supabase)
- [ ] Provision Supabase Project
- [ ] Schema Design (Create `products`, `sales`, `types`, `statuses` tables)
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Configure Email/Password Authentication

## Phase 4: Application Logic (Integration)
- [ ] Install Supabase Client Library
- [ ] Implement Auth Guard (Login/Logout flow)
- [ ] Swap `localStorage` logic for Supabase CRUD
- [ ] Implement Real-time synchronization (optional)

## Phase 5: Production & CI/CD (Vercel)
- [ ] Link GitHub to Vercel
- [ ] Configure Production Environment Variables
- [ ] Perform security audit and final deployment
