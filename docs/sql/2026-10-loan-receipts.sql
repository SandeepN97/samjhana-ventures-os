-- Bank-loan payment receipts (PR: feat/bank-loan-payment-receipts-and-admin-review).
-- Run on Supabase STAGING (then PROD at release) BEFORE deploying: staging uses ddl-auto: validate.
-- Safe to re-run.

-- Photos of the bank's receipt for a loan payment. PRIVATE: only the backend reads this table, and it only
-- hands a photo to a signed-in admin or manager (never under /api/public).
CREATE TABLE IF NOT EXISTS loan_receipts (
    id             UUID PRIMARY KEY,
    content_type   VARCHAR(40)  NOT NULL,
    size_bytes     BIGINT       NOT NULL,
    uploaded_by    VARCHAR(100) NOT NULL,
    transaction_id UUID,
    data           BYTEA        NOT NULL,
    deleted_at     TIMESTAMP,
    created_at     TIMESTAMP
);

-- Same rule as every other table: nobody but the backend's own database login can read it.
ALTER TABLE loan_receipts ENABLE ROW LEVEL SECURITY;
