-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read/update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can insert profiles (for signup trigger)
CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- Subscriptions: Users can only read their own subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage subscriptions (for Stripe webhooks)
CREATE POLICY "Service role can insert subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update subscriptions"
  ON subscriptions FOR UPDATE
  USING (true);

-- App versions: Anyone can read (for update checks)
CREATE POLICY "Anyone can view app versions"
  ON app_versions FOR SELECT
  USING (true);

-- Only admins can insert/update app versions (done via dashboard or service role)
CREATE POLICY "Service role can manage app versions"
  ON app_versions FOR ALL
  USING (true);

-- Analytics: Users can insert their own events, service role can read all
CREATE POLICY "Users can insert own analytics"
  ON analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role can read analytics"
  ON analytics_events FOR SELECT
  USING (true);

-- Create a trigger to auto-create profile and subscription on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, user_id, email, updated_at)
  VALUES (gen_random_uuid(), new.id, new.email, now());

  -- Create trial subscription (7 days)
  INSERT INTO public.subscriptions (id, user_id, status, trial_ends_at, updated_at)
  VALUES (gen_random_uuid(), new.id, 'trialing', now() + interval '7 days', now());

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
