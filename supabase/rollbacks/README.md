# Rollbacks

These are **undo** scripts — one per migration in `../migrations/`. They are
kept OUT of the migrations folder on purpose so `supabase db push` never applies
them automatically.

## Normal operation
Apply the **forward** migrations only, in numeric order (`0001 … 0009`), from
`../migrations/`. You never run anything here during normal setup.

## To undo a migration
Run the matching `000N_*_down.sql` here (dashboard SQL editor) **only** when you
want to revert that specific migration. Roll back in reverse order if undoing
several (e.g. `0009_down` before `0008_down`). Rollbacks drop columns/tables, so
they destroy any data those held.
