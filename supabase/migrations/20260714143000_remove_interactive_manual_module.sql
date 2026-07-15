-- Remove the interactive usage manual module.
-- The product no longer exposes the manual in the internal app or client portal.

DROP FUNCTION IF EXISTS public.get_manual_adoption_snapshot(text, text, integer);

DROP TABLE IF EXISTS public.manual_user_progress CASCADE;
DROP TABLE IF EXISTS public.manual_user_state CASCADE;
