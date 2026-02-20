-- Função RPC para incrementar uses_count de forma atômica e segura
CREATE OR REPLACE FUNCTION increment_coupon_uses(coupon_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE coupons
    SET uses_count = uses_count + 1
    WHERE id = coupon_id;
$$;
