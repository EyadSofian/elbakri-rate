
-- Backfill hotel_id on hotel_rates from matching hotel_name so RLS scoping + UI joins work
UPDATE public.hotel_rates r
SET hotel_id = h.id
FROM public.hotels h
WHERE r.hotel_id IS NULL
  AND lower(trim(r.hotel_name)) = lower(trim(h.hotel_name));
