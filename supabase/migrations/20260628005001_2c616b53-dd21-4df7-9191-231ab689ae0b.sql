
-- 1) quote_status enum
DO $$ BEGIN
  CREATE TYPE public.quote_status AS ENUM ('draft','ready','sent','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) quotes: add status, allow nullable client_name for drafts
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS status public.quote_status NOT NULL DEFAULT 'draft';
ALTER TABLE public.quotes ALTER COLUMN client_name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_created_by_status
  ON public.quotes (created_by, status);

-- 3) quote_items: prevent duplicates per quote
DO $$ BEGIN
  ALTER TABLE public.quote_items
    ADD CONSTRAINT quote_items_unique_rate_per_quote UNIQUE (quote_id, hotel_rate_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- 4) Update RLS so operations can preview (SELECT) but not mutate ownership
DROP POLICY IF EXISTS q_select ON public.quotes;
CREATE POLICY q_select ON public.quotes
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operations')
  );

DROP POLICY IF EXISTS qi_all ON public.quote_items;
CREATE POLICY qi_select ON public.quote_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (
        q.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'operations')
      )
  ));
CREATE POLICY qi_write ON public.quote_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (q.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (q.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

-- 5) Reinforce grants (idempotent)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quotes TO service_role;
GRANT ALL ON public.quote_items TO service_role;
