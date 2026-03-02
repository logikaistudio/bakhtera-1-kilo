-- 1. Drop existing constraint that points to freight_vendors
ALTER TABLE blink_purchase_orders 
  DROP CONSTRAINT IF EXISTS blink_purchase_orders_vendor_id_fkey;

-- 2. Convert vendor_id column type from TEXT to UUID (because blink_business_partners.id is UUID)
ALTER TABLE blink_purchase_orders 
  ALTER COLUMN vendor_id TYPE UUID USING vendor_id::uuid;

-- 3. Add the correct foreign key constraint to blink_business_partners
ALTER TABLE blink_purchase_orders
  ADD CONSTRAINT blink_purchase_orders_vendor_id_fkey 
  FOREIGN KEY (vendor_id) 
  REFERENCES blink_business_partners(id) ON DELETE SET NULL;
