-- Seed data for NovaMart demo
-- Run this in Supabase SQL Editor after phase2_schema.sql

-- Create the NovaMart organization
INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'NovaMart');

-- Link user as admin of NovaMart
INSERT INTO profiles (id, org_id, role, display_name)
VALUES (
  '12cfee0d-6935-4585-b5a1-a1e69902c3e1',
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'Himanshu Goyal'
);

-- Create spaces for organizing documents
INSERT INTO spaces (org_id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Engineering', 'Architecture docs, runbooks, API specs'),
  ('00000000-0000-0000-0000-000000000001', 'HR & Policies', 'Company handbook, leave policy, benefits'),
  ('00000000-0000-0000-0000-000000000001', 'Onboarding', 'New employee setup and first week guides');
