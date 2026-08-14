CREATE TABLE company_members (
  user_id UUID,
  company_id UUID,
  role VARCHAR(50),
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  user_id UUID,
  action VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
