import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const shopDomain: string = body.shop_domain ?? "demo-shop.myshopify.com";
    const webhookUrl: string = body.webhook_url ?? "";

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ error: "webhook_url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let config = null;
    const { data: configByDomain } = await supabase
      .from("app_config")
      .select("shopify_access_token, shopify_shop_domain")
      .eq("shop_domain", shopDomain)
      .maybeSingle();

    if (configByDomain) {
      config = configByDomain;
    } else {
      const { data: fallback } = await supabase
        .from("app_config")
        .select("shopify_access_token, shopify_shop_domain")
        .limit(1)
        .maybeSingle();
      config = fallback;
    }

    if (!config?.shopify_access_token || !config?.shopify_shop_domain) {
      return new Response(
        JSON.stringify({ error: "Shopify credentials not configured. Save your Shopify token and domain first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listRes = await fetch(
      `https://${config.shopify_shop_domain}/admin/api/2024-01/webhooks.json?topic=orders/create`,
      {
        headers: {
          "X-Shopify-Access-Token": config.shopify_access_token,
          "Content-Type": "application/json",
        },
      }
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      return new Response(
        JSON.stringify({ error: "Failed to list webhooks", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listData = await listRes.json();
    const existing = (listData.webhooks ?? []).find(
      (w: { address: string }) => w.address === webhookUrl
    );

    if (existing) {
      return new Response(
        JSON.stringify({ ok: true, already_exists: true, webhook: existing }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const createRes = await fetch(
      `https://${config.shopify_shop_domain}/admin/api/2024-01/webhooks.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": config.shopify_access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhook: {
            topic: "orders/create",
            address: webhookUrl,
            format: "json",
          },
        }),
      }
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      return new Response(
        JSON.stringify({ error: "Failed to register webhook", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const created = await createRes.json();
    return new Response(
      JSON.stringify({ ok: true, webhook: created.webhook }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
