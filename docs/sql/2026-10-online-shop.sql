-- Online shop + admin-managed website (PR: feat/ecommerce-storefront-managed-from-admin).
-- Run on Supabase STAGING (then PROD at release) BEFORE deploying: staging/prod use ddl-auto: validate.
-- Run docs/sql/2026-10-beekeeping-products.sql first. Safe to re-run.

-- Pictures uploaded in the admin, stored in the database and served at /api/public/media/{id}.
CREATE TABLE IF NOT EXISTS media_assets (
    id            UUID PRIMARY KEY,
    content_type  VARCHAR(40)  NOT NULL,
    size_bytes    BIGINT       NOT NULL,
    original_name VARCHAR(200),
    uploaded_by   VARCHAR(100),
    data          BYTEA        NOT NULL,
    deleted_at    TIMESTAMP,
    created_at    TIMESTAMP
);

-- Website text/picture choices, one JSON document per section (identity, contact, hours, hub, ...).
CREATE TABLE IF NOT EXISTS site_content (
    content_key   VARCHAR(60) PRIMARY KEY,
    content_value TEXT        NOT NULL,
    updated_by    VARCHAR(100),
    updated_at    TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurant_dishes (
    id              UUID PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    name_nepali     VARCHAR(255),
    description     TEXT,
    price           NUMERIC(12,2),
    veg             BOOLEAN      NOT NULL DEFAULT TRUE,
    course          VARCHAR(20)  NOT NULL,
    meal_periods    VARCHAR(60)  NOT NULL,
    image_id        UUID,
    available       BOOLEAN      NOT NULL DEFAULT TRUE,
    show_on_website BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP,
    updated_at      TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dish_sort ON restaurant_dishes (sort_order);

CREATE TABLE IF NOT EXISTS shop_orders (
    id                UUID PRIMARY KEY,
    order_number      VARCHAR(20)  NOT NULL,
    customer_name     VARCHAR(100) NOT NULL,
    customer_phone    VARCHAR(30)  NOT NULL,
    customer_email    VARCHAR(120),
    fulfilment        VARCHAR(20)  NOT NULL,
    address_line      VARCHAR(200),
    city              VARCHAR(100),
    landmark          VARCHAR(200),
    payment_method    VARCHAR(20)  NOT NULL,
    customer_notes    TEXT,
    internal_notes    TEXT,
    status            VARCHAR(20)  NOT NULL,
    subtotal          NUMERIC(12,2) NOT NULL,
    delivery_fee      NUMERIC(12,2) NOT NULL DEFAULT 0,
    total             NUMERIC(12,2) NOT NULL,
    cancel_reason     VARCHAR(300),
    status_updated_by VARCHAR(100),
    completed_at      TIMESTAMP,
    created_at        TIMESTAMP,
    updated_at        TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_order_number ON shop_orders (order_number);
CREATE INDEX IF NOT EXISTS idx_shop_order_status ON shop_orders (status);

CREATE TABLE IF NOT EXISTS shop_order_lines (
    id           UUID PRIMARY KEY,
    order_id     UUID         NOT NULL REFERENCES shop_orders (id),
    product_type VARCHAR(20)  NOT NULL,
    product_id   UUID         NOT NULL,
    product_slug VARCHAR(80)  NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    unit_price   NUMERIC(12,2) NOT NULL,
    quantity     INTEGER      NOT NULL,
    line_total   NUMERIC(12,2) NOT NULL
);

-- Furniture products gain a website address, badge, pictures and a show/hide switch.
ALTER TABLE furniture_items ADD COLUMN IF NOT EXISTS slug            VARCHAR(80);
ALTER TABLE furniture_items ADD COLUMN IF NOT EXISTS badge           VARCHAR(80);
ALTER TABLE furniture_items ADD COLUMN IF NOT EXISTS image_ids       TEXT;
ALTER TABLE furniture_items ADD COLUMN IF NOT EXISTS show_on_website BOOLEAN;

-- Beekeeping products gain pictures (run only if 2026-10-beekeeping-products.sql did not already create it).
ALTER TABLE beekeeping_products ADD COLUMN IF NOT EXISTS image_ids TEXT;
