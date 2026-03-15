import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const shopDomain = url.searchParams.get("shop_domain");

    if (!shopDomain) {
      return new Response(
        JSON.stringify({ error: "shop_domain query param required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("app_config")
        .select("id, shop_domain, packeta_api_key, is_active, shopify_access_token, shopify_shop_domain, updated_at")
        .eq("shop_domain", shopDomain)
        .maybeSingle();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { packeta_api_key, is_active, shopify_access_token, shopify_shop_domain } = body;

      const { data: existing } = await supabase
        .from("app_config")
        .select("id")
        .eq("shop_domain", shopDomain)
        .maybeSingle();

      const payload: Record<string, unknown> = {};
      if (packeta_api_key !== undefined) payload.packeta_api_key = packeta_api_key;
      if (is_active !== undefined) payload.is_active = is_active;
      if (shopify_access_token !== undefined) payload.shopify_access_token = shopify_access_token;
      if (shopify_shop_domain !== undefined) payload.shopify_shop_domain = shopify_shop_domain;

      let result;
      if (existing) {
        result = await supabase
          .from("app_config")
          .update(payload)
          .eq("shop_domain", shopDomain)
          .select("id, shop_domain, packeta_api_key, is_active, shopify_access_token, shopify_shop_domain, updated_at")
          .single();
      } else {
        result = await supabase
          .from("app_config")
          .insert({ shop_domain: shopDomain, ...payload })
          .select("id, shop_domain, packeta_api_key, is_active, shopify_access_token, shopify_shop_domain, updated_at")
          .single();
      }

      if (result.error) {
        return new Response(
          JSON.stringify({ error: result.error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: result.data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
