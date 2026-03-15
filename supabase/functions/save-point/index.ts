import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SavePointPayload {
  shop_domain: string;
  order_id: string;
  order_name: string;
  customer_email: string;
  packeta_point_id: string;
  packeta_point_name: string;
  packeta_point_address: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (req.method === "POST") {
      const body: SavePointPayload = await req.json();

      const { shop_domain, order_id, order_name, customer_email, packeta_point_id, packeta_point_name, packeta_point_address } = body;

      if (!shop_domain || !order_id || !packeta_point_id) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: shop_domain, order_id, packeta_point_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("order_pickups")
        .insert({
          shop_domain,
          order_id,
          order_name: order_name ?? "",
          customer_email: customer_email ?? "",
          packeta_point_id,
          packeta_point_name,
          packeta_point_address,
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const shopDomain = url.searchParams.get("shop_domain");

      if (!shopDomain) {
        return new Response(
          JSON.stringify({ error: "shop_domain query param required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("order_pickups")
        .select("*")
        .eq("shop_domain", shopDomain)
        .order("created_at", { ascending: false })
        .limit(50);

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
