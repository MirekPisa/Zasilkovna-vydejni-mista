import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FulfillOrderRequest {
  shop_domain: string;
  order_id: string;
  tracking_number: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: FulfillOrderRequest = await req.json();
    const { shop_domain, order_id, tracking_number } = payload;

    if (!order_id || !tracking_number) {
      return new Response(
        JSON.stringify({ error: "Chybí povinné parametry: order_id, tracking_number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let { data: config } = await supabase
      .from("app_config")
      .select("shopify_access_token, shopify_shop_domain")
      .eq("shop_domain", shop_domain ?? "")
      .maybeSingle();

    if (!config) {
      const { data: fallback } = await supabase
        .from("app_config")
        .select("shopify_access_token, shopify_shop_domain")
        .limit(1)
        .maybeSingle();
      config = fallback;
    }

    if (!config?.shopify_access_token) {
      return new Response(
        JSON.stringify({ error: "NO_TOKEN", message: "Shopify přístupový token není nastaven." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shopDomain = config.shopify_shop_domain || shop_domain;
    const token = config.shopify_access_token;

    const foRes = await fetch(
      `https://${shopDomain}/admin/api/2025-01/orders/${order_id}/fulfillment_orders.json`,
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      }
    );

    if (!foRes.ok) {
      const text = await foRes.text();
      return new Response(
        JSON.stringify({ error: "SHOPIFY_FO_ERROR", message: `Nepodařilo se načíst fulfillment orders: ${foRes.status}`, details: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const foData = await foRes.json();
    const fulfillmentOrders: Array<{ id: number; status: string }> = foData.fulfillment_orders ?? [];
    const openFO = fulfillmentOrders.find(fo => fo.status === "open");

    if (!openFO) {
      return new Response(
        JSON.stringify({ error: "NO_OPEN_FO", message: "Objednávka nemá žádný otevřený fulfillment order (možná již byla expedována)." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trackingUrl = `https://tracking.packeta.com/cs/?id=${tracking_number}`;

    const fulfillRes = await fetch(
      `https://${shopDomain}/admin/api/2025-01/fulfillments.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fulfillment: {
            message: "Balíček odeslán přes Zásilkovnu",
            notify_customer: true,
            tracking_info: {
              number: tracking_number,
              url: trackingUrl,
              company: "Zásilkovna",
            },
            line_items_by_fulfillment_order: [
              { fulfillment_order_id: openFO.id },
            ],
          },
        }),
      }
    );

    if (!fulfillRes.ok) {
      const text = await fulfillRes.text();
      return new Response(
        JSON.stringify({ error: "SHOPIFY_FULFILL_ERROR", message: `Shopify fulfillment selhal: ${fulfillRes.status}`, details: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fulfillData = await fulfillRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        fulfillment_id: fulfillData.fulfillment?.id,
        tracking_url: trackingUrl,
        tracking_number,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
