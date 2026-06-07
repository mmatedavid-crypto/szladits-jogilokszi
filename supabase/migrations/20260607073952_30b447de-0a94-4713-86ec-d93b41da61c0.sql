
-- Matters table: stores the full CaseFile JSON per user
CREATE TABLE public.matters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cimke text NOT NULL DEFAULT 'Új ügy',
  ugy_azonosito text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  letrehozva timestamptz NOT NULL DEFAULT now(),
  utoljara_mentve timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX matters_user_id_idx ON public.matters(user_id, utoljara_mentve DESC) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matters TO authenticated;
GRANT ALL ON public.matters TO service_role;

ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own matters" ON public.matters
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own matters" ON public.matters
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own matters" ON public.matters
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own matters" ON public.matters
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Intake tokens: separate table so we can resolve token -> matter without exposing matters
CREATE TABLE public.intake_tokens (
  token text PRIMARY KEY,
  matter_id uuid NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  szerep text NOT NULL CHECK (szerep IN ('elado','vevo')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX intake_tokens_matter_idx ON public.intake_tokens(matter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_tokens TO authenticated;
GRANT ALL ON public.intake_tokens TO service_role;

ALTER TABLE public.intake_tokens ENABLE ROW LEVEL SECURITY;

-- Owner of the matter manages its tokens
CREATE POLICY "Owner manages intake_tokens" ON public.intake_tokens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matters m WHERE m.id = matter_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.matters m WHERE m.id = matter_id AND m.user_id = auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER matters_set_updated_at
  BEFORE UPDATE ON public.matters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SECURITY DEFINER: public intake page can fetch the matter data by token,
-- without ever being able to list matters or read by id.
CREATE OR REPLACE FUNCTION public.get_matter_for_intake(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _matter_id uuid;
  _data jsonb;
BEGIN
  SELECT matter_id INTO _matter_id FROM public.intake_tokens WHERE token = _token;
  IF _matter_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT data INTO _data FROM public.matters WHERE id = _matter_id AND deleted_at IS NULL;
  RETURN _data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_matter_for_intake(text) TO anon, authenticated;

-- SECURITY DEFINER: public intake page can save back the data jsonb (full payload
-- accepted; the server-side merge is by the intake page only writing intake-related
-- subkeys client-side). Tightening to specific paths is a follow-up.
CREATE OR REPLACE FUNCTION public.save_matter_for_intake(_token text, _data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _matter_id uuid;
BEGIN
  SELECT matter_id INTO _matter_id FROM public.intake_tokens WHERE token = _token;
  IF _matter_id IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.matters
    SET data = _data,
        utoljara_mentve = now()
    WHERE id = _matter_id AND deleted_at IS NULL;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_matter_for_intake(text, jsonb) TO anon, authenticated;
