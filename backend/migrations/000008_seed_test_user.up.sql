-- Seed test user for development
-- Email: test@bytebox.dev / Password: Test@1234
-- bcrypt hash of "Test@1234" with cost 10
INSERT INTO users (id, email, password_hash, display_name, storage_used, storage_limit, plan, is_active, is_admin, email_verified)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'test@bytebox.dev',
    '$2a$10$PTGuZVuoLdbs.tDjXpQFPO83KocoGcuSKLRjkm/mECG733H8ccn.G',
    'Test User',
    0,
    5368709120,
    'free',
    true,
    false,
    true
) ON CONFLICT (email) DO NOTHING;

-- Seed admin test user
-- Email: admin@bytebox.dev / Password: Admin@1234
INSERT INTO users (id, email, password_hash, display_name, storage_used, storage_limit, plan, is_active, is_admin, email_verified)
VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'admin@bytebox.dev',
    '$2a$10$5CNTvtTBu7h8dDpWH35gEuOe346bQnw0WXY.EvXndIo0LYjCZ6Pza',
    'Admin User',
    0,
    53687091200,
    'premium',
    true,
    true,
    true
) ON CONFLICT (email) DO NOTHING;
