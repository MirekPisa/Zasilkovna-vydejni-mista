import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ShopifyNoteAttribute {
  name: string;
  value: string;
}

interface ShopifyShippingLine {
  title: string;
  price: string;
}

interface ShopifyCustomer {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

interface ShopifyAddress {
  first_name: string;
  last_name: string;
  address1: string;
  address2: string | null;
  city: string;
  zip: string;
  country_code: string;
  phone: string | null;
}

interface ShopifyOrder {
  id: number;
  name: string;
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
  phone: string | null;
  note_attributes: ShopifyNoteAttribute[];
  shipping_lines: ShopifyShippingLine[];
  customer: ShopifyCustomer | null;
  shipping_address: ShopifyAddress | null;
}

function getAttr(attrs: ShopifyNoteAttribute[], key: string): string {
  return attrs.find(a => a.name === key)?.value ?? '';
}

function isZasilkovnaOrder(order: ShopifyOrder): boolean {
  const hasShipping = order.shipping_lines?.some(s =>
    s.title?.toLowerCase().includes('zásilkovna') ||
    s.title?.toLowerCase().includes('zasilkovna') ||
    s.title?.toLowerCase().includes('packeta') ||
    s.title?.toLowerCase().includes('z-box')
  );
  const hasAttr = order.note_attributes?.some(a =>
    a.name === 'packeta_point_id' && a.value
  );
  return hasShipping || hasAttr;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const configShopDomain = url.searchParams.get("shop_domain") ?? "demo-shop.myshopify.com";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let { data: config, error: configError } = await supabase
      .from("app_config")
      .select("shopify_access_token, shopify_shop_domain")
      .eq("shop_domain", configShopDomain)
      .maybeSingle();

    if (configError) {
      return new Response(
        JSON.stringify({ error: configError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config) {
      const { data: fallback, error: fallbackError } = await supabase
        .from("app_config")
        .select("shopify_access_token, shopify_shop_domain")
        .limit(1)
        .maybeSingle();

      if (fallbackError) {
        return new Response(
          JSON.stringify({ error: fallbackError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      config = fallback;
    }

    if (!config?.shopify_access_token) {
      return new Response(
        JSON.stringify({ error: "NO_TOKEN", message: "Shopify přístupový token není nastaven. Zadejte ho v Nastavení." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shopDomain = config.shopify_shop_domain || configShopDomain;
    const token = config.shopify_access_token;

    const shopifyUrl = `https://${shopDomain}/admin/api/2025-01/orders.json?status=any&limit=100&fields=id,name,created_at,financial_status,fulfillment_status,total_price,currency,phone,note_attributes,shipping_lines,customer,shipping_address`;

    const shopifyRes = await fetch(shopifyUrl, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });

    if (!shopifyRes.ok) {
      const text = await shopifyRes.text();
      if (shopifyRes.status === 401) {
        return new Response(
          JSON.stringify({ error: "INVALID_TOKEN", message: "Neplatný Shopify přístupový token. Zkontrolujte nastavení." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Shopify API error: ${shopifyRes.status}`, details: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shopifyData = await shopifyRes.json();
    const allOrders: ShopifyOrder[] = shopifyData.orders ?? [];

    const zasilkovnaOrders = allOrders
      .filter(isZasilkovnaOrder)
      .map(order => ({
        id: order.id,
        name: order.name,
        created_at: order.created_at,
        financial_status: order.financial_status,
        fulfillment_status: order.fulfillment_status,
        total_price: order.total_price,
        currency: order.currency,
        customer_name: order.customer
          ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
          : null,
        customer_email: order.customer?.email ?? null,
        customer_phone: order.shipping_address?.phone || order.phone || order.customer?.phone || null,
        shipping_title: order.shipping_lines?.[0]?.title ?? null,
        packeta_point_id: getAttr(order.note_attributes, 'packeta_point_id'),
        packeta_point_name: getAttr(order.note_attributes, 'packeta_point_name'),
        packeta_point_address: getAttr(order.note_attributes, 'packeta_point_address'),
        shipping_address: order.shipping_address ?? null,
      }));

    return new Response(
      JSON.stringify({ data: zasilkovnaOrders, total: allOrders.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
