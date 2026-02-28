-- BookKpr Supabase Schema
-- Designed for Max Performance and Relational Integrity

-- 0. User Profiles (Tier Management)
CREATE TYPE membership_tier AS ENUM ('free', 'premium', 'admin');

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tier membership_tier DEFAULT 'free',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
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
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL, -- Snapshot name in case product is deleted
    qty INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    buyer_name TEXT DEFAULT 'Guest',
    voided BOOLEAN DEFAULT false,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Product Types (Dynamic Managed List)
CREATE TABLE IF NOT EXISTS product_types (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 4. Status Tags (Dynamic Managed List)
CREATE TABLE IF NOT EXISTS status_tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 5. Row Level Security (RLS) Policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_tags ENABLE ROW LEVEL SECURITY;

-- Simple Policy: Users can only see/edit their own data
CREATE POLICY "Users can only access their own products" ON products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own sales" ON sales FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own types" ON product_types FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own tags" ON status_tags FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);

-- 6. Helper: Enforce Limits (Logic Example)
-- This would be handled via a Database Trigger or Edge Function
-- to prevent 'free' users from exceeding say 20 products.
