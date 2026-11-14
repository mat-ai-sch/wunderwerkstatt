window.WW_AUTH_CONFIG = Object.freeze({
  // These two public values are supplied by the Supabase project.
  // The publishable key is intentionally safe to use in browser code.
  supabaseUrl: "https://lvereygccmzxdkdagwmu.supabase.co",
  supabasePublishableKey: "sb_publishable_-d_03wCmfVTLWsQ-zE7KHw_MIX4i9_x",

  // Conservative fallback values. The live website auto-detects enabled
  // providers from Supabase via the auth-capabilities Edge Function.
  providers: Object.freeze({
    google: false,
    apple: false,
    amazon: false,
    azure: false,
  }),
});
