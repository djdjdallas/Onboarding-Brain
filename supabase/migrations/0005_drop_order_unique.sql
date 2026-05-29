-- =============================================================================
-- Drop unique(dealer_id, priority_order) on pmas + priority_models
-- =============================================================================
-- Reordering in the dealer settings UI updates priority_order in place. With
-- the unique constraint AND the CHECK (priority_order between 1 and 9), there's
-- no spare value range to stage a swap, and delete-and-reinsert would cascade
-- away keyword_targets. Dropping the uniqueness lets us update rows in place
-- while keeping PMA/model ids stable (so keyword_targets + primary_pma_id
-- survive a reorder). Ordering correctness is enforced by the app.
-- =============================================================================
alter table public.pmas
  drop constraint if exists pmas_dealer_id_priority_order_key;

alter table public.priority_models
  drop constraint if exists priority_models_dealer_id_priority_order_key;
