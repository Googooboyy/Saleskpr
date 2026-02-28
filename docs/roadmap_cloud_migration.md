# Roadmap: Transitioning to a Secure Cloud Application

This document outlines the 5-phase plan to upgrade the **Awesome Printing Company Dashboard** from a local prototype to a professional, secure, and cloud-synchronized application using Supabase, GitHub, and Vite.

---

## Phase 1: Local Environment Setup
Before development, your workstation needs the industry-standard toolchain.

1.  **Node.js**: Install the **LTS (Long Term Support)** version from [nodejs.org](https://nodejs.org/). This provides the `npm` package manager needed for modern web dependencies.
2.  **Git**: Install from [git-scm.com](https://git-scm.com/). This allows for version control and change tracking.
3.  **Verification**: Open your terminal (PowerShell) and verify installations:
    - `node -v`
    - `npm -v`
    - `git --version`

---

## Phase 2: Version Control & Privacy (The Shield)
GitHub will host your code, but we must ensure sensitive data never leaks.

1.  **Initialize Git**: Run `git init` in the project root.
2.  **The `.gitignore` (CRITICAL)**: Create a file named `.gitignore` to prevent the following from being uploaded:
    - `.env` (Sensitive API Keys)
    - `node_modules/` (Bulky dependencies)
    - `dist/` (Production builds)
3.  **GitHub Connection**: 
    - Create a **Private** repository on GitHub.
    - Path: `git remote add origin <your-repo-url>`
    - Path: `git push -u origin main`

---

## Phase 3: Supabase Infrastructure (The Brain)
Supabase replaces `localStorage` with a robust PostgreSQL database and Auth system.

1.  **Database Tables**: Create relational tables for `products`, `sales`, and `lookup_types`.
2.  **Authentication**: Enable **Email/Password** or **Google OAuth** in the Supabase Auth dashboard.
3.  **Row Level Security (RLS)**: 
    - **Security First**: Enable RLS on all tables.
    - Implement policies ensuring users can only `SELECT`, `INSERT`, `UPDATE`, or `DELETE` rows that match their unique `auth.uid()`.

---

## Phase 4: Integration & Security (The Transition)
Moving the application logic to a modern framework.

1.  **Vite Transition**: Bundle the app using Vite to support **Environment Variables**.
2.  **Secret Management**: Store the `SUPABASE_URL` and `SUPABASE_ANON_KEY` in a local `.env` file. These are injected at build time and never committed to Git.
3.  **Data Engine Rewrite**: 
    - Replace synchronous `localStorage` calls with asynchronous `async/await` Supabase calls.
    - Implement a `Login` component that guards the main dashboard state.

---

## Phase 5: Automated Deployment (CI/CD)
1.  **Vercel/Netlify Integration**: Connect your GitHub repository to a hosting provider.
2.  **Encrypted Secrets**: Manually add your Supabase credentials to the hosting provider's "Environment Variables" settings.
3.  **Automatic Deployment**: Every time you commit and push code to the `main` branch, the app will automatically build and deploy the latest secure version.

---

## Security Reminders
- **NEVER** commit your `.env` file to GitHub.
- Always use **Private** repositories for projects containing business logic.
- Ensure **Row Level Security** is enabled before the first production deploy.
