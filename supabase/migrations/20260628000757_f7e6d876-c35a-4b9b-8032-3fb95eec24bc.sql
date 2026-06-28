
-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.hotel_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  brand_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_groups TO authenticated;
GRANT ALL ON public.hotel_groups TO service_role;
ALTER TABLE public.hotel_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_group_id uuid REFERENCES public.hotel_groups(id) ON DELETE SET NULL,
  hotel_name text NOT NULL,
  region text NOT NULL,
  sub_region text,
  star_rating int CHECK (star_rating BETWEEN 1 AND 7),
  address text,
  description text,
  facilities text,
  child_policy_default text,
  transfer_notes_default text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_name, region)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotels TO authenticated;
GRANT ALL ON public.hotels TO service_role;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hotels_group ON public.hotels(hotel_group_id);
CREATE INDEX IF NOT EXISTS idx_hotels_region ON public.hotels(region);

CREATE TABLE IF NOT EXISTS public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name text NOT NULL UNIQUE,
  package_type text,
  region text,
  hotel_group_id uuid REFERENCES public.hotel_groups(id) ON DELETE SET NULL,
  description text,
  default_meal_plan text,
  default_pricing_basis text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.package_hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, hotel_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_hotels TO authenticated;
GRANT ALL ON public.package_hotels TO service_role;
ALTER TABLE public.package_hotels ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hotel_rates
  ADD COLUMN IF NOT EXISTS hotel_id uuid REFERENCES public.hotels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hotel_group_id_fk uuid REFERENCES public.hotel_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_rates_hotel_id ON public.hotel_rates(hotel_id);
CREATE INDEX IF NOT EXISTS idx_rates_package_id ON public.hotel_rates(package_id);

CREATE TABLE IF NOT EXISTS public.user_access_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('all','region','hotel_group','hotel','package')),
  scope_id text,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_access_rules TO authenticated;
GRANT ALL ON public.user_access_rules TO service_role;
ALTER TABLE public.user_access_rules ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_uar_user ON public.user_access_rules(user_id);

CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text NOT NULL UNIQUE DEFAULT ('Q-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  client_name text NOT NULL,
  client_phone text,
  client_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  hotel_rate_id uuid NOT NULL REFERENCES public.hotel_rates(id) ON DELETE CASCADE,
  custom_note text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON public.quote_items(quote_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_hg_upd ON public.hotel_groups;
CREATE TRIGGER trg_hg_upd BEFORE UPDATE ON public.hotel_groups FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_h_upd ON public.hotels;
CREATE TRIGGER trg_h_upd BEFORE UPDATE ON public.hotels FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_p_upd ON public.packages;
CREATE TRIGGER trg_p_upd BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_q_upd ON public.quotes;
CREATE TRIGGER trg_q_upd BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper function: scope-aware access check
CREATE OR REPLACE FUNCTION public.user_has_rate_access(_user_id uuid, _region text, _hotel_id uuid, _hotel_group_id uuid, _package_id uuid, _need text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_access_rules r
      WHERE r.user_id = _user_id
        AND ( (_need='view' AND r.can_view) OR (_need='edit' AND r.can_edit) OR (_need='export' AND r.can_export) )
        AND (
          r.scope_type = 'all'
          OR (r.scope_type = 'region'      AND r.scope_id = _region)
          OR (r.scope_type = 'hotel'       AND _hotel_id IS NOT NULL AND r.scope_id::uuid = _hotel_id)
          OR (r.scope_type = 'hotel_group' AND _hotel_group_id IS NOT NULL AND r.scope_id::uuid = _hotel_group_id)
          OR (r.scope_type = 'package'     AND _package_id IS NOT NULL AND r.scope_id::uuid = _package_id)
        )
    );
$$;
REVOKE EXECUTE ON FUNCTION public.user_has_rate_access(uuid, text, uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_rate_access(uuid, text, uuid, uuid, uuid, text) TO authenticated;

-- Profiles policies
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR id = auth.uid());

-- Library RLS
DROP POLICY IF EXISTS hg_select ON public.hotel_groups;
CREATE POLICY hg_select ON public.hotel_groups FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS hg_write ON public.hotel_groups;
CREATE POLICY hg_write ON public.hotel_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

DROP POLICY IF EXISTS h_select ON public.hotels;
CREATE POLICY h_select ON public.hotels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS h_write ON public.hotels;
CREATE POLICY h_write ON public.hotels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

DROP POLICY IF EXISTS p_select ON public.packages;
CREATE POLICY p_select ON public.packages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_write ON public.packages;
CREATE POLICY p_write ON public.packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

DROP POLICY IF EXISTS ph_select ON public.package_hotels;
CREATE POLICY ph_select ON public.package_hotels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ph_write ON public.package_hotels;
CREATE POLICY ph_write ON public.package_hotels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

DROP POLICY IF EXISTS uar_admin ON public.user_access_rules;
CREATE POLICY uar_admin ON public.user_access_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS q_select ON public.quotes;
CREATE POLICY q_select ON public.quotes FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS q_insert ON public.quotes;
CREATE POLICY q_insert ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS q_update ON public.quotes;
CREATE POLICY q_update ON public.quotes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS q_delete ON public.quotes;
CREATE POLICY q_delete ON public.quotes FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS qi_all ON public.quote_items;
CREATE POLICY qi_all ON public.quote_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND (q.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND (q.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- Scope-aware hotel_rates SELECT
DROP POLICY IF EXISTS rates_select_staff ON public.hotel_rates;
DROP POLICY IF EXISTS rates_select_scoped ON public.hotel_rates;
CREATE POLICY rates_select_scoped ON public.hotel_rates FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'operations')
    OR (public.has_role(auth.uid(),'sales') AND status = 'Ready'
        AND public.user_has_rate_access(auth.uid(), region, hotel_id, hotel_group_id_fk, package_id, 'view'))
    OR (public.has_role(auth.uid(),'viewer')
        AND public.user_has_rate_access(auth.uid(), region, hotel_id, hotel_group_id_fk, package_id, 'view'))
  );

UPDATE public.profiles p SET email = u.email
FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count int; assigned_role app_role;
BEGIN
  SELECT count(*) INTO user_count FROM public.profiles;
  IF user_count = 0 THEN assigned_role := 'admin'; ELSE assigned_role := 'sales'; END IF;
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, assigned_role);
  RETURN NEW;
END; $$;

INSERT INTO public.hotel_groups (name) VALUES
  ('مجموعة الباتروس'),('مجموعة نيفرلاند'),('نوفوتيل'),('هاني مون'),('رحلات وانتقالات')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.packages (package_name, region, hotel_group_id)
SELECT v.name, v.region, hg.id FROM (VALUES
  ('مجموعة الباتروس شرم الشيخ','شرم الشيخ','مجموعة الباتروس'),
  ('مجموعة الباتروس الغردقة','الغردقة','مجموعة الباتروس'),
  ('مجموعة الباتروس مرسى علم','مرسى علم','مجموعة الباتروس'),
  ('مجموعة نيفرلاند',NULL,'مجموعة نيفرلاند'),
  ('باقة سيليكت',NULL,NULL),
  ('باقة بريميوم',NULL,NULL),
  ('باقة إيليت',NULL,NULL),
  ('هاني مون الغردقة','الغردقة','هاني مون'),
  ('هاني مون شرم الشيخ','شرم الشيخ','هاني مون'),
  ('هاني مون مرسى علم','مرسى علم','هاني مون'),
  ('هاني مون دهب','دهب','هاني مون'),
  ('رحلات + انتقالات',NULL,'رحلات وانتقالات')
) AS v(name, region, group_name)
LEFT JOIN public.hotel_groups hg ON hg.name = v.group_name
ON CONFLICT (package_name) DO NOTHING;
