# App Recreation Prompt: BookKpr Cloud (Supabase SDK Edition)

This document provides the high-performance blueprint to recreate the **BookKpr** Sales Dashboard as a scalable, cloud-backed application using a "No-Build" architecture.

**Brand Identity**: *Hybrid Jury*  
**Motto**: *Max in. Max out.*  
**Aesthetic**: *Retro-Futurist / Paper & Ink / High-Contrast Precision.*

---

## 1. The Architectural Strategy: "Native ESM"
The core philosophy is **Max Performance with Minimum Bloat**. Avoid build tools (like Vite/Webpack) to maintain the "No-Build Flex."

### Tech Stack & Delivery
- **Frontend**: Modern Vanilla JavaScript utilizing native **ES Modules** (`type="module"`).
- **Backend**: **Supabase** (PostgreSQL, Auth, Storage, Realtime).
- **Organization**: Refactor the monolithic `app.js` into a modularized directory structure:
    - `/src/lib/supabase-client.js`: Initializes connection via CDN SDK.
    - `/src/lib/api.js`: All DB CRUD operations.
    - `/src/lib/auth.js`: Google OAuth flow logic.
    - `/src/ui/`: Components for Inventory, Rankings, and Cart.
- **Hosting**: Direct static file deployment to **VPS (Nginx)**.

---

## 2. Infrastructure Foundations

### PostgreSQL Database Schema
Recreate the following tables in Supabase to ensure relational integrity and RLS security:

```sql
-- 1. Products Table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    image_url TEXT,
    status TEXT[] DEFAULT '{}',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Sales Table
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    buyer_name TEXT DEFAULT 'Guest',
    voided BOOLEAN DEFAULT false,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Dynamic Metadata (Managed Lists)
CREATE TABLE product_types (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE status_tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
-- Policies: Users can only see/edit their own data (auth.uid() = user_id)
```

### Google OAuth Integration
1.  **Whitelisting**: Use the Supabase Callback URL (`https://[PROJECT-ID].supabase.co/auth/v1/callback`) in the Google Cloud Console.
2.  **Credentials**: Enter the Google **Client ID** and **Client Secret** into the Supabase Auth Dashboard.
3.  **UI**: Implement a prominent "Sign in with Google" button using the "Hybrid Jury" high-contrast aesthetic.

---

## 3. Core Requirements & Performance Logic

### Data Migration (The "Legacy" Bridge)
Implement a one-time migration script that:
- Detects existing `localStorage` keys (`bookmaker_products`, `bookmaker_sales`).
- Automatically prompts the user to migrate data to Supabase upon first login.
- Deletes the local keys after a successful cloud sync to prevent duplicates.

### Authentication
- Integrate **Supabase Auth** with OAuth providers (Google). Secure all database operations with **Row Level Security (RLS)**.

### Membership & Subscription Logic
- **User Tiers**:
    - `Free`: Limited products (e.g., 20), one image per product.
    - `Premium`: Unlimited products, high-res image hosting, analytics export.
    - `Admin`: Full system access, global product management, and a dedicated **Special Admin Backend Page**.
- **Tier Gating**: The frontend must dynamically toggle the "Admin Dashboard" link and enforcement limits based on the user's `profile.tier` record.

### Performance Refactor (The "Max Out" Logic)
- **Surgical DOM Updates**: Do not use `innerHTML` to overwrite entire lists. Use `DocumentFragment` or target specific `textContent` updates based on state changes.
- **Optimistic UI**: When updating stock (+1/-1), update the UI immediately and sync with Supabase in the background. If the request fails, rollback the UI and flash an error.
- **Real-time Subscriptions**: Listen to `INSERT/UPDATE` events on the `sales` and `products` tables to sync data across all open dashboard tabs.

---

## 4. Design Guidelines (The HJ Manual)
- **Typography**: `Outfit` for general text. `Fira Code` for all numerical data.
- **Color Palette**: 
    - BG: `#F9F7F2` (Creamy Paper)
    - Ink: `#1C1C1C` (Deep Charcoal)
    - Alerts: `#00B894` (Success), `#D63031` (Danger).
- **Execution**: Zero gradients. Hard 4px "Brutalist" shadows. Transitions must be instant and crisp.

---

## 5. Interaction Workflow Prompt for AI
"Act as a Principal Software Engineer. Rebuild this dashboard using a 'No-Build/No-Framework' philosophy. Implement surgical Native ES Modules. Integrate Supabase for Auth, Storage, and Database. Focus on 'Max Output' performance—zero visible latency and optimistic UI updates. Prioritize the 'Hybrid Jury' aesthetics: sharp, determined, and paper-precise. Ensure the migration from localStorage is seamless and data-loss proof."
