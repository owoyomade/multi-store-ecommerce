-- Integration tests run against their own database so they can wipe tables
-- freely without touching your development data.
CREATE DATABASE shop_test OWNER shop;
