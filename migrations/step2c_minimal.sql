CREATE TABLE company_members (
  user_id UUID,
  company_id UUID,
  role user_role,
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  company_id UUID,
  user_id UUID,
  action VARCHAR(100),
  created_at TIMESTAMP
);
