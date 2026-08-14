INSERT INTO companies (id, name, slug, plan, status, owner_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Master Company', 'master', 'enterprise', 'active', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, company_id, email, full_name, role, status, email_verified, password_hash)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'kairolopesoficial@gmail.com', 'Master Admin', 'owner', 'active', true, '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/e1e')
ON CONFLICT (email) DO NOTHING;
