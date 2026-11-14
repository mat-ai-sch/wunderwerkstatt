window.WW_AUTH_CONFIG = Object.freeze({
  // These two public values are supplied by the Supabase project.
  // The publishable key is intentionally safe to use in browser code.
  supabaseUrl: "",
  supabasePublishableKey: "",

  // Provider buttons are only shown after that provider is configured in Supabase.
  providers: Object.freeze({
    google: false,
    azure: false,
    apple: false,
  }),
});
