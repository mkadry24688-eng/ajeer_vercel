
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_type TEXT DEFAULT 'تعاقد أجير',
    contract_number TEXT UNIQUE,
    worker_name TEXT,
    worker_profession TEXT,
    worker_id_number TEXT,
    worker_nationality TEXT,
    provider_entity TEXT,
    provider_hr_id TEXT,
    beneficiary_entity TEXT,
    beneficiary_hr_id TEXT,
    contract_summary TEXT,
    start_date TEXT,
    end_date TEXT,
    work_locations TEXT,
    is_blocked BOOLEAN DEFAULT false,
    blocked_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for users" ON users;
CREATE POLICY "Enable all access for users" ON users FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all access for contracts" ON contracts;
CREATE POLICY "Enable all access for contracts" ON contracts FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all access for health_certificates" ON health_certificates;
CREATE POLICY "Enable all access for health_certificates" ON health_certificates FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE users IS 'Stores system users and login credentials';
COMMENT ON TABLE contracts IS 'Stores worker contracts for the Ajeer system';
COMMENT ON TABLE health_certificates IS 'Stores health certificates and worker medical data';