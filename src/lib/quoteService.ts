import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import type { HotelRate } from "@/lib/rates";

export type Quote = Database["public"]["Tables"]["quotes"]["Row"];
export type QuoteItem = Database["public"]["Tables"]["quote_items"]["Row"];
export type QuoteItemWithRate = QuoteItem & { hotel_rates: HotelRate | null };

export const ACTIVE_QUOTE_KEY = ["active_quote"] as const;
export const quoteItemsKey = (qid: string | null | undefined) => ["quote_items", qid] as const;

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function invalidateQuoteFlow(
  qc: ReturnType<typeof useQueryClient>,
  quoteId: string | null | undefined,
) {
  qc.invalidateQueries({ queryKey: ACTIVE_QUOTE_KEY });
  qc.invalidateQueries({ queryKey: ["quotes_list"] });
  if (quoteId) qc.invalidateQueries({ queryKey: quoteItemsKey(quoteId) });
}

/** Get current user id (cached for one render). */
async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not authenticated");
  return data.user.id;
}

/** Find latest draft quote for current user. Returns null if none. */
export async function fetchActiveDraft(userId: string): Promise<Quote | null> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("created_by", userId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Quote | null) ?? null;
}

/** Ensure an active draft quote exists for the current user. Returns the quote id. */
export async function createDraftQuoteIfNeeded(): Promise<Quote> {
  const userId = await getUserId();
  const existing = await fetchActiveDraft(userId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("quotes")
    .insert({ created_by: userId, status: "draft" })
    .select("*")
    .single();
  if (error) throw error;
  return data as Quote;
}

async function addRatesToDraft(rateIds: string[]) {
  const ids = uniqueIds(rateIds);
  const quote = await createDraftQuoteIfNeeded();
  if (!ids.length) return { quote, insertedCount: 0, skippedCount: 0 };

  const { data: existing, error: existingError } = await supabase
    .from("quote_items")
    .select("hotel_rate_id")
    .eq("quote_id", quote.id)
    .in("hotel_rate_id", ids);
  if (existingError) throw existingError;

  const existingIds = new Set((existing ?? []).map((row) => row.hotel_rate_id));
  const missingIds = ids.filter((id) => !existingIds.has(id));
  if (!missingIds.length) {
    return { quote, insertedCount: 0, skippedCount: ids.length };
  }

  const { error } = await supabase
    .from("quote_items")
    .insert(missingIds.map((hotel_rate_id) => ({ quote_id: quote.id, hotel_rate_id })));
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { quote, insertedCount: 0, skippedCount: ids.length };
    }
    throw error;
  }

  return { quote, insertedCount: missingIds.length, skippedCount: ids.length - missingIds.length };
}

/** Hook: current user's active draft quote (or null until first add). */
export function useActiveQuote() {
  return useQuery({
    queryKey: ACTIVE_QUOTE_KEY,
    queryFn: async () => {
      const userId = await getUserId();
      return await fetchActiveDraft(userId);
    },
  });
}

/** Hook: items for a quote, joined with hotel_rates. */
export function useQuoteItems(quoteId: string | null | undefined) {
  return useQuery({
    queryKey: quoteItemsKey(quoteId),
    enabled: !!quoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_items")
        .select("*, hotel_rates(*)")
        .eq("quote_id", quoteId as string)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as QuoteItemWithRate[];
    },
  });
}

/** Hook: add a hotel rate to the current user's active draft quote. */
export function useAddRateToQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rateId: string) => await addRatesToDraft([rateId]),
    onSuccess: ({ quote, insertedCount }) => {
      qc.setQueryData(ACTIVE_QUOTE_KEY, quote);
      invalidateQuoteFlow(qc, quote.id);
      if (insertedCount > 0) toast.success("تمت الإضافة لعرض السعر");
      else toast.info("العرض مضاف بالفعل");
    },
    onError: (err: Error) => {
      toast.error("تعذر إضافة العرض: " + (err.message || ""));
    },
  });
}

/** Hook: add many hotel rates to the current user's active draft quote. */
export function useAddRatesToQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rateIds: string[]) => await addRatesToDraft(rateIds),
    onSuccess: ({ quote, insertedCount, skippedCount }) => {
      qc.setQueryData(ACTIVE_QUOTE_KEY, quote);
      invalidateQuoteFlow(qc, quote.id);
      if (insertedCount > 0) {
        toast.success(`تمت إضافة ${insertedCount} عرض لعرض السعر`);
      } else if (skippedCount > 0) {
        toast.info("كل العروض مضافة بالفعل");
      }
    },
    onError: (err: Error) => {
      toast.error("تعذر إضافة العروض: " + (err.message || ""));
    },
  });
}

/** Hook: create/open a draft quote when the user starts from Quotes. */
export function useEnsureDraftQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDraftQuoteIfNeeded,
    onSuccess: (quote) => {
      qc.setQueryData(ACTIVE_QUOTE_KEY, quote);
      invalidateQuoteFlow(qc, quote.id);
    },
    onError: (err: Error) => toast.error("تعذر تجهيز عرض سعر جديد: " + err.message),
  });
}

/** Hook: remove a quote item by id. */
export function useRemoveQuoteItem(quoteId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("quote_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateQuoteFlow(qc, quoteId);
    },
    onError: (err: Error) => toast.error("تعذر الحذف: " + err.message),
  });
}

/** Hook: remove by rate id (for toggling from the package view). */
export function useRemoveRateFromQuote(quoteId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rateId: string) => {
      if (!quoteId) return;
      const { error } = await supabase
        .from("quote_items")
        .delete()
        .eq("quote_id", quoteId)
        .eq("hotel_rate_id", rateId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateQuoteFlow(qc, quoteId);
    },
    onError: (err: Error) => toast.error("تعذر الإزالة: " + err.message),
  });
}

/** Hook: update quote fields (client info, status, notes). */
export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      patch: Partial<Pick<Quote, "client_name" | "client_phone" | "client_notes" | "status">>;
    }) => {
      const { data, error } = await supabase
        .from("quotes")
        .update(args.patch)
        .eq("id", args.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Quote;
    },
    onSuccess: (quote) => {
      qc.invalidateQueries({ queryKey: ACTIVE_QUOTE_KEY });
      qc.invalidateQueries({ queryKey: ["quote", quote.id] });
      qc.invalidateQueries({ queryKey: ["quotes_list"] });
    },
  });
}

/** Convenience: list all quotes visible to current user (RLS filters). */
export function useQuotesList() {
  return useQuery({
    queryKey: ["quotes_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, quote_items(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (Quote & { quote_items: { count: number }[] })[];
    },
  });
}
