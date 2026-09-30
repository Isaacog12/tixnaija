-- Add verification tick to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified_organizer boolean DEFAULT false;

-- Allow only admins to update it, though typically we do it via edge functions or dashboard. 
-- Assuming RLS is already active, we don't need a specific policy if it's updated securely by an admin RPC or service role.
-- But let's create a helper RPC for admins just in case.

CREATE OR REPLACE FUNCTION admin_verify_organizer(p_user_id uuid, p_verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Basic check if caller is admin (assuming user_roles or is_admin logic exists in this app, or we can just rely on RLS/is_admin in profiles)
  -- In this schema we saw `user_roles` with `role = 'admin'` or `is_admin` on profiles
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    -- Try checking user_roles as fallback
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;

  UPDATE public.profiles SET is_verified_organizer = p_verified WHERE id = p_user_id;
END;
$$;

-- Ticket Transfer RPC
CREATE OR REPLACE FUNCTION transfer_ticket(p_ticket_code text, p_new_email text, p_new_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket_id uuid;
  v_order_item_id uuid;
  v_buyer_id uuid;
  v_owner_id uuid;
BEGIN
  -- Find the ticket
  SELECT t.id, t.order_item_id
  INTO v_ticket_id, v_order_item_id
  FROM public.tickets t
  WHERE t.code = p_ticket_code AND t.status = 'valid';

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found or already used/cancelled.';
  END IF;

  -- Verify ownership (must be the buyer/owner of the ticket)
  SELECT o.user_id, t.owner_id
  INTO v_buyer_id, v_owner_id
  FROM public.tickets t
  JOIN public.order_items oi ON t.order_item_id = oi.id
  JOIN public.orders o ON oi.order_id = o.id
  WHERE t.id = v_ticket_id;

  -- The person calling this must be the owner of the ticket or the buyer of the order
  IF auth.uid() IS NULL OR (auth.uid() != v_buyer_id AND auth.uid() != v_owner_id) THEN
     RAISE EXCEPTION 'You do not have permission to transfer this ticket.';
  END IF;

  -- Update the attendee details and wipe the owner_id (it will be claimed by the new person if they sign up, or just remain guest)
  -- If we want a secure code rotation so the old owner can't use the old QR code:
  -- We can regenerate the ticket code!
  UPDATE public.tickets 
  SET attendee_email = p_new_email,
      attendee_name = p_new_name,
      owner_id = NULL,
      code = 'TIX-' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 8)) -- New random code for security
  WHERE id = v_ticket_id;

END;
$$;
