CREATE TABLE IF NOT EXISTS mandi_history (
    id SERIAL PRIMARY KEY,
    arrival_date DATE,
    state TEXT,
    district TEXT,
    market TEXT,
    commodity TEXT,
    variety TEXT,
    min_price NUMERIC,
    max_price NUMERIC,
    modal_price NUMERIC
);

CREATE INDEX IF NOT EXISTS ix_mandi_history_arrival_date ON mandi_history (arrival_date);
CREATE INDEX IF NOT EXISTS ix_mandi_history_state ON mandi_history (state);
CREATE INDEX IF NOT EXISTS ix_mandi_history_market ON mandi_history (market);
CREATE INDEX IF NOT EXISTS ix_mandi_history_commodity ON mandi_history (commodity);
