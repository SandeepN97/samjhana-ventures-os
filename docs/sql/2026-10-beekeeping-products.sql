-- Beekeeping shop: run on Supabase STAGING (ddl-auto: validate) before deploying the branch that adds it.
-- Production (ddl-auto: update) creates the table itself; running this first is harmless there too.
-- Column types match the BeekeepingProduct entity.

CREATE TABLE IF NOT EXISTS beekeeping_products (
    id              uuid PRIMARY KEY,
    name            varchar(255)  NOT NULL,
    name_nepali     varchar(255),
    sku             varchar(80)   NOT NULL,
    slug            varchar(80)   NOT NULL,
    category        varchar(20)   NOT NULL,
    purchase_price  numeric(12,2),
    selling_price   numeric(12,2),
    stock_qty       integer       NOT NULL DEFAULT 0,
    reorder_level   integer       NOT NULL DEFAULT 2,
    description     text,
    badge           varchar(80),
    details         text,
    show_on_website boolean       NOT NULL DEFAULT true,
    deleted_at      timestamp(6),
    created_at      timestamp(6),
    updated_at      timestamp(6),
    CONSTRAINT beekeeping_products_category_check
        CHECK (category IN ('HIVE','GEAR','TOOL','HONEY','KIT','OTHER')),
    CONSTRAINT beekeeping_products_stock_nonnegative CHECK (stock_qty >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_beekeeping_sku  ON beekeeping_products (sku);
CREATE UNIQUE INDEX IF NOT EXISTS idx_beekeeping_slug ON beekeeping_products (slug);
CREATE INDEX        IF NOT EXISTS idx_beekeeping_category ON beekeeping_products (category);
