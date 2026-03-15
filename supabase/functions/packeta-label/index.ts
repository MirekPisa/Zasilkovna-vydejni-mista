import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PACKETA_API_URL = "https://www.zasilkovna.cz/api/rest";

interface CreateLabelRequest {
  shop_domain: string;
  order_id: string;
  order_name: string;
  customer_name: string;
  customer_email: string;
  packeta_point_id: string;
  order_value: string;
  currency: string;
}

function parseXmlValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].trim() : '';
}

function checkXmlFault(xml: string): string | null {
  const faultString = parseXmlValue(xml, 'faultString');
  if (faultString) return faultString;
  const message = parseXmlValue(xml, 'message');
  if (message && xml.includes('<fault>')) return message;
  return null;
}

async function callPacketaApi(body: string): Promise<string> {
  const res = await fetch(PACKETA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Accept': 'application/xml',
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Packeta API HTTP ${res.status}: ${await res.text()}`);
  }
  return res.text();
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

    const payload: CreateLabelRequest = await req.json();
    const { shop_domain, order_id, order_name, customer_name, customer_email, packeta_point_id, order_value, currency } = payload;

    if (!shop_domain || !order_id || !packeta_point_id) {
      return new Response(
        JSON.stringify({ error: "Chybí povinné parametry: shop_domain, order_id, packeta_point_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: config } = await supabase
      .from("app_config")
      .select("packeta_api_password")
      .eq("shop_domain", shop_domain)
      .maybeSingle();

    if (!config?.packeta_api_password) {
      return new Response(
        JSON.stringify({ error: "NO_PASSWORD", message: "Packeta API heslo není nastaveno. Zadejte ho v Nastavení." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiPassword = config.packeta_api_password;

    const nameParts = (customer_name ?? '').trim().split(/\s+/);
    const firstName = nameParts.slice(0, -1).join(' ') || nameParts[0] || 'Zákazník';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

    const orderNum = order_name.replace(/^#/, '');
    const value = parseFloat(order_value) || 0;

    const createPacketXml = `<?xml version="1.0" encoding="utf-8"?>
<createPacket>
  <apiPassword>${apiPassword}</apiPassword>
  <packetAttributes>
    <number>${orderNum}</number>
    <name>${escapeXml(firstName)}</name>
    <surname>${escapeXml(lastName)}</surname>
    <email>${escapeXml(customer_email ?? '')}</email>
    <addressId>${packeta_point_id}</addressId>
    <value>${value.toFixed(2)}</value>
    <weight>1</weight>
    <eshop>printybob.cz</eshop>
    <currency>${currency || 'CZK'}</currency>
  </packetAttributes>
</createPacket>`;

    const createResponse = await callPacketaApi(createPacketXml);

    const createFault = checkXmlFault(createResponse);
    if (createFault) {
      return new Response(
        JSON.stringify({ error: "PACKETA_ERROR", message: `createPacket selhalo: ${createFault}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const barcode = parseXmlValue(createResponse, 'barcode');
    if (!barcode) {
      return new Response(
        JSON.stringify({ error: "NO_BARCODE", message: "Packeta nevrátila barcode. Odpověď: " + createResponse.substring(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const labelXml = `<?xml version="1.0" encoding="utf-8"?>
<packetLabelPdf>
  <apiPassword>${apiPassword}</apiPassword>
  <packetId>${barcode}</packetId>
  <format>A7 on A4</format>
  <offset>0</offset>
</packetLabelPdf>`;

    const labelResponse = await callPacketaApi(labelXml);

    const labelFault = checkXmlFault(labelResponse);
    if (labelFault) {
      return new Response(
        JSON.stringify({ error: "LABEL_ERROR", message: `packetLabelPdf selhalo: ${labelFault}`, barcode }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBase64 = parseXmlValue(labelResponse, 'result') || parseXmlValue(labelResponse, 'labelContents') || parseXmlValue(labelResponse, 'string');
    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: "NO_PDF", message: "Packeta nevrátila PDF data.", barcode }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("packeta_labels").insert({
      shop_domain,
      order_id: String(order_id),
      order_name,
      barcode,
    });

    return new Response(
      JSON.stringify({ success: true, barcode, pdf_base64: pdfBase64 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
