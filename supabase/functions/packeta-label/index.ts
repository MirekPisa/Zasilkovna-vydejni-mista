import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PACKETA_API_URL = "https://www.zasilkovna.cz/api/rest";

interface ShippingAddress {
  first_name: string;
  last_name: string;
  address1: string;
  address2: string | null;
  city: string;
  zip: string;
  country_code: string;
  phone: string | null;
}

interface CreateLabelRequest {
  shop_domain: string;
  order_id: string;
  order_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  packeta_point_id: string | null;
  shipping_address: ShippingAddress | null;
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

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
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
    const url = new URL(req.url);
    const debugMode = url.searchParams.get('debug') === '1';
    const debugLog: string[] = [];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: CreateLabelRequest = await req.json();
    const { shop_domain, order_id, order_name, customer_name, customer_email, customer_phone, packeta_point_id, shipping_address, order_value, currency } = payload;

    if (!shop_domain || !order_id) {
      return new Response(
        JSON.stringify({ error: "Chybí povinné parametry: shop_domain, order_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!packeta_point_id && !shipping_address) {
      return new Response(
        JSON.stringify({ error: "Chybí adresa doručení: zadejte packeta_point_id nebo shipping_address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let { data: config } = await supabase
      .from("app_config")
      .select("packeta_api_password, label_format, label_offset, label_type, zpl_dpi, hd_address_id")
      .eq("shop_domain", shop_domain)
      .maybeSingle();

    if (!config) {
      const { data: fallback } = await supabase
        .from("app_config")
        .select("packeta_api_password, label_format, label_offset, label_type, zpl_dpi, hd_address_id")
        .limit(1)
        .maybeSingle();
      config = fallback;
    }

    if (!config?.packeta_api_password) {
      return new Response(
        JSON.stringify({ error: "NO_PASSWORD", message: "Packeta API heslo není nastaveno. Zadejte ho v Nastavení." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiPassword = config.packeta_api_password;
    const labelFormat: string = config.label_format ?? 'A6 on A6';
    const labelOffset: number = config.label_offset ?? 0;
    const labelType: string = config.label_type ?? 'pdf';
    const zplDpi: number = config.zpl_dpi ?? 203;
    const hdAddressId: number = config.hd_address_id ?? 106;

    const nameParts = (customer_name ?? '').trim().split(/\s+/);
    const firstName = nameParts.slice(0, -1).join(' ') || nameParts[0] || 'Zákazník';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

    const orderNum = order_name.replace(/^#/, '');
    const value = parseFloat(order_value) || 0;

    let createPacketXml: string;

    if (packeta_point_id) {
      createPacketXml = `<?xml version="1.0" encoding="utf-8"?>
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
    } else {
      const addr = shipping_address!;
      const addrFirstName = addr.first_name || firstName;
      const addrLastName = addr.last_name || lastName;
      const phone = addr.phone || customer_phone || '+420000000000';
      createPacketXml = `<?xml version="1.0" encoding="utf-8"?>
<createPacket>
  <apiPassword>${apiPassword}</apiPassword>
  <packetAttributes>
    <number>${orderNum}</number>
    <name>${escapeXml(addrFirstName)}</name>
    <surname>${escapeXml(addrLastName)}</surname>
    <email>${escapeXml(customer_email ?? '')}</email>
    <addressId>${hdAddressId}</addressId>
    <street>${escapeXml(addr.address1)}</street>
    <city>${escapeXml(addr.city)}</city>
    <zip>${escapeXml(addr.zip)}</zip>
    <phone>${escapeXml(phone)}</phone>
    <value>${value.toFixed(2)}</value>
    <weight>1</weight>
    <eshop>printybob.cz</eshop>
    <currency>${currency || 'CZK'}</currency>
  </packetAttributes>
</createPacket>`;
    }

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

    let labelXml: string;
    if (labelType === 'zpl') {
      labelXml = `<?xml version="1.0" encoding="utf-8"?>
<packetLabelZpl>
  <apiPassword>${apiPassword}</apiPassword>
  <packetId>${barcode}</packetId>
  <dpi>${zplDpi}</dpi>
</packetLabelZpl>`;
    } else {
      labelXml = `<?xml version="1.0" encoding="utf-8"?>
<packetLabelPdf>
  <apiPassword>${apiPassword}</apiPassword>
  <packetId>${barcode}</packetId>
  <format>${escapeXml(labelFormat)}</format>
  <offset>${labelOffset}</offset>
</packetLabelPdf>`;
    }

    if (debugMode) debugLog.push(`[labelXml] ${labelXml}`);

    const labelResponse = await callPacketaApi(labelXml);

    if (debugMode) debugLog.push(`[labelResponse_raw200] ${labelResponse.substring(0, 200)}`);

    const labelFault = checkXmlFault(labelResponse);
    if (labelFault) {
      return new Response(
        JSON.stringify({ error: "LABEL_ERROR", message: `packetLabel${labelType === 'zpl' ? 'Zpl' : 'Pdf'} selhalo: ${labelFault}`, barcode, ...(debugMode ? { debug: debugLog } : {}) }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawFileData = parseXmlValue(labelResponse, 'result') || parseXmlValue(labelResponse, 'labelContents') || parseXmlValue(labelResponse, 'string');

    if (debugMode) debugLog.push(`[rawFileData_first100] ${rawFileData.substring(0, 100)}`);
    if (debugMode) debugLog.push(`[rawFileData_length] ${rawFileData.length}`);

    if (!rawFileData) {
      return new Response(
        JSON.stringify({ error: "NO_LABEL_DATA", message: "Packeta nevrátila data štítku.", barcode, raw: labelResponse.substring(0, 500), ...(debugMode ? { debug: debugLog } : {}) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const fileData = rawFileData.replace(/\s/g, '');

    if (debugMode) debugLog.push(`[fileData_first100] ${fileData.substring(0, 100)}`);
    if (debugMode) debugLog.push(`[fileData_length] ${fileData.length}`);

    await supabase.from("packeta_labels").insert({
      shop_domain,
      order_id: String(order_id),
      order_name,
      barcode,
    });

    return new Response(
      JSON.stringify({
        success: true,
        barcode,
        pdf_base64: fileData,
        label_type: labelType,
        ...(debugMode ? { debug: debugLog } : {}),
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
