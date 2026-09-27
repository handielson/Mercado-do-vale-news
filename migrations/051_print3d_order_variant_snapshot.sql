-- Historical orders remain NULL: current catalog attributes cannot reconstruct
-- the variant description at the time of an earlier purchase.
ALTER TABLE print3d_order_item_plans ADD COLUMN variant_snapshot JSON NULL;
