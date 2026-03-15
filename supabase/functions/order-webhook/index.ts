import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Shopify-Hmac-SHA256, X-Shopify-Shop-Domain, X-Shopify-Topic",
};

function parsePacketaAddress(address: string): { address1: string; city: string; zip: string } {
  const lastComma = address.lastIndexOf(",");
  if (lastComma === -1) {
    return { address1: address.trim(), city: "", zip: "" };
  }

  const address1 = address.substring(0, lastComma).trim();
  const cityZipPart = address.substring(lastComma + 1).trim();

  const zipMatch = cityZipPart.match(/(\d{3}\s?\d{2})\s*$/);
  if (!zipMatch) {
    return { address1, city: cityZipPart, zip: "" };
  }

  const zip = zipMatch[1].replace(/\s/g, " ").trim();
  const city = cityZipPart.substring(0, cityZipPart.length - zipMatch[0].length).trim();

  return { address1, city, zip };
}

async function verifyHmac(body: string, hmacHeader: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return computed === hmacHeader;
}

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

    const rawBody = await req.text();
    const hmacHeader = req.headers.get("X-Shopify-Hmac-SHA256") ?? "";
    const shopDomain = req.headers.get("X-Shopify-Shop-Domain") ?? "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: config, error: configError } = await supabase
      .from("app_config")
      .select("shopify_access_token, shopify_shop_domain, overwrite_shipping_address")
      .eq("shop_domain", shopDomain || "demo-shop.myshopify.com")
      .maybeSingle();

    if (configError || !config) {
      const { data: fallback } = await supabase
        .from("app_config")
        .select("shopify_access_token, shopify_shop_domain, overwrite_shipping_address")
        .limit(1)
        .maybeSingle();

      if (!fallback) {
        return new Response(
          JSON.stringify({ error: "Config not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      Object.assign(config ?? {}, fallback);
    }

    const activeConfig = config ?? {};

    if (activeConfig.overwrite_shipping_address === false) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "overwrite_shipping_address disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookSecret = Deno.env.get("SHOPIFY_WEBHOOK_SECRET");
    if (webhookSecret && hmacHeader) {
      const valid = await verifyHmac(rawBody, hmacHeader, webhookSecret);
      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Invalid HMAC signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let order: Record<string, unknown>;
    try {
      order = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderId = order.id as string | number;
    const noteAttributes = (order.note_attributes as Array<{ name: string; value: string }>) ?? [];
    const shippingAddress = (order.shipping_address as Record<string, string>) ?? {};
    const currentNote = (order.note as string) ?? "";

    const pointName = noteAttributes.find(a => a.name === "packeta_point_name")?.value ?? "";
    const pointAddress = noteAttributes.find(a => a.name === "packeta_point_address")?.value ?? "";
    const pointId = noteAttributes.find(a => a.name === "packeta_point_id")?.value ?? "";

    if (!pointName && !pointId) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "No Packeta point in order" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { address1, city, zip } = parsePacketaAddress(pointAddress);

    const newShippingAddress = {
      first_name: shippingAddress.first_name ?? "",
      last_name: shippingAddress.last_name ?? "",
      company: `Zásilkovna - ${pointName}`,
      address1: address1 || pointAddress,
      address2: "",
      city: city || "",
      zip: zip || "",
      country_code: "CZ",
      phone: shippingAddress.phone ?? "",
    };

    const noteAddition = `Výdejní místo Zásilkovna: ${pointName}, ID: ${pointId}`;
    const newNote = currentNote
      ? `${currentNote}\n${noteAddition}`
      : noteAddition;

    const resolvedShopDomain = activeConfig.shopify_shop_domain as string;
    const accessToken = activeConfig.shopify_access_token as string;

    if (!resolvedShopDomain || !accessToken) {
      return new Response(
        JSON.stringify({ error: "Shopify credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shopifyRes = await fetch(
      `https://${resolvedShopDomain}/admin/api/2024-01/orders/${orderId}.json`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          order: {
            id: orderId,
            shipping_address: newShippingAddress,
            note: newNote,
          },
        }),
      }
    );

    if (!shopifyRes.ok) {
      const errText = await shopifyRes.text();
      return new Response(
        JSON.stringify({ error: "Shopify API error", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, order_id: orderId, point_name: pointName }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
