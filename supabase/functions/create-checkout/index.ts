// create-checkout/index.ts
// Supabase Edge Function — creates a Stripe Checkout session
// Deploy at: Supabase Dashboard → Edge Functions → create-checkout

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.10.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// REPLACE the 4 placeholder keys below with your real Stripe Price IDs.
// In Stripe Dashboard: tap each product → tap the price line → copy the ID (starts with price_1...)
const PACKAGES: Record<string, { coins: number; name: string }> = {
  "price_1T8lRkFMGqaFujiFyLzD2olL": { coins: 100,  name: "100 Coins"  },
  "price_1T8lUTFMGqaFujiF79xn3U0O": { coins: 500,  name: "500 Coins"  },
  "price_1T8lWCFMGqaFujiFZAhjMh5r": { coins: 1000, name: "1000 Coins" },
  "price_1T8lY0FMGqaFujiFbLaGJUDi": { coins: 5000, name: "5000 Coins" },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://satsarcadehub.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Invalid session");

    const { priceId } = await req.json();
    const pkg = PACKAGES[priceId];
    if (!pkg) throw new Error("Invalid package");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: user.id,
        coins: pkg.coins.toString(),
      },
      success_url: "https://satsarcadehub.com/?purchase=success",
      cancel_url:  "https://satsarcadehub.com/?purchase=cancelled",
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
