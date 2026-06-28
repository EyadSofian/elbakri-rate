
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'operations', 'sales');
CREATE TYPE public.rate_status AS ENUM ('Draft', 'Ready', 'Archived');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role app_role NOT NULL DEFAULT 'sales',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- has_role function (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Profile policies
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR id = auth.uid());
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup; first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count int;
  assigned_role app_role;
BEGIN
  SELECT count(*) INTO user_count FROM public.profiles;
  IF user_count = 0 THEN assigned_role := 'admin'; ELSE assigned_role := 'sales'; END IF;
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), assigned_role);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  NEW.last_updated = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

-- HOTEL RATES
CREATE TABLE public.hotel_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id TEXT UNIQUE,
  category TEXT,
  region TEXT NOT NULL,
  sub_region TEXT,
  hotel_name TEXT NOT NULL,
  hotel_group TEXT,
  package_name TEXT NOT NULL,
  offer_name TEXT,
  season_name TEXT,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  days INT,
  nights INT,
  room_type TEXT NOT NULL,
  occupancy TEXT,
  meal_plan TEXT NOT NULL,
  pricing_basis TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EGP',
  adult_price NUMERIC NOT NULL,
  child_price NUMERIC,
  child_age_from NUMERIC,
  child_age_to NUMERIC,
  child_policy TEXT,
  transfer_included TEXT,
  transfer_details TEXT,
  cancellation_policy TEXT,
  booking_notes TEXT,
  source_sheet TEXT,
  source_cell TEXT,
  status rate_status NOT NULL DEFAULT 'Draft',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_rates TO authenticated;
GRANT ALL ON public.hotel_rates TO service_role;
ALTER TABLE public.hotel_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rates_select_staff" ON public.hotel_rates FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operations')
    OR (public.has_role(auth.uid(), 'sales') AND status = 'Ready')
  );
CREATE POLICY "rates_insert_ops" ON public.hotel_rates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));
CREATE POLICY "rates_update_ops" ON public.hotel_rates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));
CREATE POLICY "rates_delete_ops" ON public.hotel_rates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));

CREATE TRIGGER trg_hotel_rates_updated BEFORE UPDATE ON public.hotel_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_rates_status ON public.hotel_rates(status);
CREATE INDEX idx_rates_region ON public.hotel_rates(region);
CREATE INDEX idx_rates_hotel ON public.hotel_rates(hotel_name);
CREATE INDEX idx_rates_dates ON public.hotel_rates(date_from, date_to);

-- SAVED QUOTES
CREATE TABLE public.saved_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT UNIQUE NOT NULL DEFAULT ('Q-' || to_char(now(), 'YYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  selected_rate_ids UUID[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_quotes TO authenticated;
GRANT ALL ON public.saved_quotes TO service_role;
ALTER TABLE public.saved_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select" ON public.saved_quotes FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "quotes_insert" ON public.saved_quotes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "quotes_update" ON public.saved_quotes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "quotes_delete" ON public.saved_quotes FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
