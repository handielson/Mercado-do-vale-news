ALTER TABLE company_accountant_access
  MODIFY customer_id VARCHAR(80)
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  NOT NULL;
