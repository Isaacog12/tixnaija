-- Staff-approved fallback knowledge for the deterministic support assistant.
-- Static intent answers stay in code; this table covers safe paraphrases without
-- making the assistant invent policy or claim that an action has already happened.

CREATE TABLE IF NOT EXISTS public.support_bot_knowledge (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(120) NOT NULL,
  category    VARCHAR(32) NOT NULL DEFAULT 'general',
  content     TEXT NOT NULL,
  triggers    TEXT[] NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS support_bot_knowledge_title_key
ON public.support_bot_knowledge (title);

ALTER TABLE public.support_bot_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view bot knowledge" ON public.support_bot_knowledge;
CREATE POLICY "Staff can view bot knowledge"
ON public.support_bot_knowledge FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'customer_care'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Staff can manage bot knowledge" ON public.support_bot_knowledge;
CREATE POLICY "Staff can manage bot knowledge"
ON public.support_bot_knowledge FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'customer_care'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'customer_care'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

REVOKE ALL ON public.support_bot_knowledge FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_bot_knowledge TO authenticated;
GRANT ALL ON public.support_bot_knowledge TO service_role;

INSERT INTO public.support_bot_knowledge (title, category, content, triggers)
VALUES
  (
    'Ticket delivery and resend links',
    'tickets',
    $answer$Open /my-tickets and enter the email you bought with plus the purchase date. That resends only the links for that day's orders. Check spam or promotions too. Signed-in buyers can also open /tickets. If the ticket is still missing, say "talk to a person" and support will investigate.$answer$,
    ARRAY['ticket not delivered', 'email not received', 'where is my ticket', 'resend ticket', 'ticket missing', 'no qr code']
  ),
  (
    'Reassign a ticket to another person',
    'tickets',
    $answer$Sign in and open /tickets, find the ticket, then choose Reassign Ticket. Update the attendee name and email before doors open and before the ticket is checked in. Changing the email invalidates the old QR code and sends the updated ticket to the new attendee.$answer$,
    ARRAY['give ticket to someone', 'change ticket holder', 'wrong attendee', 'update attendee', 'ticket for another person']
  ),
  (
    'Wrong email entered at checkout',
    'account',
    $answer$A ticket sent to the wrong checkout email needs support to verify the order before it can be reissued. Say "talk to a person" with the event name and order reference. Do not send a card number, PIN, OTP or password in chat.$answer$,
    ARRAY['wrong checkout email', 'email typo at checkout', 'ticket sent to wrong email', 'incorrect purchase email']
  ),
  (
    'Guest ticket access',
    'tickets',
    $answer$You do not need an account to buy. Use the ticket link from your email, or open /my-tickets and enter the purchase email and date. Creating an account later makes future orders easier to find.$answer$,
    ARRAY['bought as guest', 'guest ticket', 'no account ticket', 'find guest order']
  ),
  (
    'Bank transfer payment delay',
    'payments',
    $answer$Bank transfers can take 2–10 minutes to confirm. Do not pay again while the transfer is pending. If money left your account and there is still no confirmed order after 15 minutes, support needs to reconcile it; a failed order is not proof that no debit happened.$answer$,
    ARRAY['bank transfer delay', 'transfer pending', 'debited no ticket', 'payment successful no ticket']
  ),
  (
    'Refund review and payout timing',
    'refunds',
    $answer$Refund requests are reviewed within 3 business days. Approved refunds usually return through Paystack to the original card or bank account within 3–7 business days. The full policy is at /refunds.$answer$,
    ARRAY['refund taking long', 'refund timeline', 'when refund arrives', 'refund not received']
  ),
  (
    'Postponed or cancelled event refunds',
    'refunds',
    $answer$If an organizer cancels an event, buyers are emailed and the organizer handles the refund through Paystack. After a postponement or venue change, a refund can be requested within 14 calendar days of the notice. See /refunds for the full policy.$answer$,
    ARRAY['cancelled event refund', 'postponed event refund', 'event moved refund', 'refund after postponement']
  ),
  (
    'Gate entry and QR scanning',
    'checkin',
    $answer$Open the live QR code from /tickets or the ticket email and turn up screen brightness. Gate staff can check you in manually using the order reference or purchase email if scanning fails. If you were turned away, say "talk to a person" so support can investigate.$answer$,
    ARRAY['qr not scanning', 'cannot enter event', 'gate rejected ticket', 'manual check in']
  ),
  (
    'Organizer fees and payouts',
    'organizer',
    $answer$TixNaija retains 10% of paid ticket sales. Paystack processing charges are deducted on settlement. Connect a Paystack subaccount in /account, then track payouts in the dashboard's Payouts tab.$answer$,
    ARRAY['organizer commission', 'platform fee', 'payout account', 'how organizer gets paid']
  ),
  (
    'Android app download',
    'technical',
    $answer$The TixNaija Android APK is available directly at /Tixnaija.apk. An iPhone version has not been released yet.$answer$,
    ARRAY['get android app', 'install tixnaija', 'apk link', 'mobile download']
  ),
  (
    'Support contact and opening hours',
    'general',
    $answer$Email tixnaijaapp@gmail.com or call +234 901 127 5275, Monday to Friday, 9am–6pm WAT. For an event-specific question, the organizer's contact is also listed on the event page.$answer$,
    ARRAY['how to contact support', 'support opening hours', 'customer care number', 'official support email']
  )
ON CONFLICT (title) DO UPDATE SET
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  triggers = EXCLUDED.triggers,
  active = TRUE,
  updated_at = now();

COMMENT ON TABLE public.support_bot_knowledge IS
  'Staff-approved fallback answers for the support assistant. Only active rows are read by the Edge Function.';
