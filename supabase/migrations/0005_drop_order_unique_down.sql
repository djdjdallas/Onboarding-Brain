-- Rollback for 0005. Re-adds the unique constraints. Will fail if any dealer
-- currently has duplicate priority_order values — dedupe first if so.
alter table public.pmas
  add constraint pmas_dealer_id_priority_order_key unique (dealer_id, priority_order);

alter table public.priority_models
  add constraint priority_models_dealer_id_priority_order_key unique (dealer_id, priority_order);
