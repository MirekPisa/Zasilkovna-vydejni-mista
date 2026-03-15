import { useState, useEffect, useRef, useCallback } from 'react';
import { Scan, CheckCircle, XCircle, Clock, Package, Loader2, FolderOpen, AlertTriangle, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { functionsUrl, functionsHeaders } from '../../lib/supabase';
import { loadDirectoryHandle, savePdfToFolder } from '../../lib/hotFolder';
import { playSuccess, playError } from '../../lib/audio';

const DEMO_SHOP = 'demo-shop.myshopify.com';

interface ScanRecord {
  id: string;
  time: Date;
  orderName: string;
  status: 'success' | 'warning' | 'error';
  barcode?: string;
  trackingUrl?: string;
  message?: string;
  fulfilled?: boolean;
}

type ProcessState = 'idle' | 'processing';
type ProcessStep = 'order' | 'label' | 'fulfill';

interface ShopifyOrder {
  id: number;
  name: string;
  total_price: string;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  packeta_point_id: string;
}

function cleanBase64(s: string): string {
  return s.replace(/\s/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
}

function downloadPdf(base64: string, filename: string) {
  const cleaned = cleanBase64(base64);
  console.log('[downloadPdf] typeof base64:', typeof base64);
  console.log('[downloadPdf] raw length:', base64.length, '| cleaned length:', cleaned.length);
  console.log('[downloadPdf] first 100 chars (cleaned):', cleaned.substring(0, 100));
  try {
    atob(cleaned);
    console.log('[downloadPdf] atob() OK');
  } catch (e) {
    console.error('[downloadPdf] atob() FAILED:', e, '| first invalid chars around pos:', (() => {
      for (let i = 0; i < cleaned.length; i += 4) {
        try { atob(cleaned.substring(i, i + 4)); } catch { return i; }
      }
      return 'unknown';
    })());
    throw new Error(`Neplatná base64 data štítku (délka: ${cleaned.length}, první znaky: ${cleaned.substring(0, 30)})`);
  }
  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${cleaned}`;
  link.download = filename;
  link.click();
}

function parseOrderNumber(raw: string): string {
  const trimmed = raw.trim();
  const expMatch = trimmed.match(/^EXP#?(\d+)$/i);
  if (expMatch) return expMatch[1];
  return trimmed.replace(/^#/, '');
}

export function Expedice() {
  const [input, setInput] = useState('');
  const [processState, setProcessState] = useState<ProcessState>('idle');
  const [processStep, setProcessStep] = useState<ProcessStep>('order');
  const [currentOrder, setCurrentOrder] = useState('');
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirHandleLost, setDirHandleLost] = useState(false);
  const [shopDomain, setShopDomain] = useState(DEMO_SHOP);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDirectoryHandle().then(handle => {
      if (handle) {
        setDirHandle(handle);
        setDirHandleLost(true);
      }
    }).catch(() => {});

    fetch(`${functionsUrl}/manage-config?shop_domain=${encodeURIComponent(DEMO_SHOP)}`, {
      headers: functionsHeaders,
    })
      .then(r => r.json())
      .then(json => {
        if (json.data?.shopify_shop_domain) setShopDomain(json.data.shopify_shop_domain);
      })
      .catch(() => {});
  }, []);

  const focusInput = useCallback(() => {
    if (inputRef.current && processState === 'idle') {
      inputRef.current.focus();
    }
  }, [processState]);

  useEffect(() => {
    focusInput();
  }, [processState, focusInput]);

  useEffect(() => {
    const handler = () => focusInput();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [focusInput]);

  async function processOrder(raw: string) {
    const orderName = parseOrderNumber(raw);
    if (!orderName) return;

    setInput('');
    setProcessState('processing');
    setProcessStep('order');
    setCurrentOrder(orderName);

    try {
      let resolvedShopDomain = shopDomain;
      if (resolvedShopDomain === DEMO_SHOP) {
        try {
          const cfgRes = await fetch(`${functionsUrl}/manage-config?shop_domain=${encodeURIComponent(DEMO_SHOP)}`, {
            headers: functionsHeaders,
          });
          const cfgJson = await cfgRes.json();
          if (cfgJson.data?.shopify_shop_domain) {
            resolvedShopDomain = cfgJson.data.shopify_shop_domain;
            setShopDomain(resolvedShopDomain);
          }
        } catch {
        }
      }

      const ordersRes = await fetch(
        `${functionsUrl}/shopify-orders?shop_domain=${encodeURIComponent(resolvedShopDomain)}`,
        { headers: functionsHeaders }
      );
      const ordersJson = await ordersRes.json();

      if (!ordersRes.ok) {
        throw new Error(ordersJson.message ?? ordersJson.error ?? 'Nepodařilo se načíst objednávky ze Shopify');
      }

      const orders: ShopifyOrder[] = ordersJson.data ?? [];
      const order = orders.find(o =>
        o.name === `#${orderName}` || o.name === orderName || String(o.id) === orderName
      );

      if (!order) {
        throw new Error(`Objednávka #${orderName} nebyla nalezena v Shopify`);
      }

      if (!order.packeta_point_id) {
        throw new Error(`Objednávka #${orderName} nemá nastavené výdejní místo Zásilkovny`);
      }

      setProcessStep('label');

      const labelRes = await fetch(`${functionsUrl}/packeta-label?debug=1`, {
        method: 'POST',
        headers: functionsHeaders,
        body: JSON.stringify({
          shop_domain: resolvedShopDomain,
          order_id: String(order.id),
          order_name: order.name,
          customer_name: order.customer_name ?? '',
          customer_email: order.customer_email ?? '',
          packeta_point_id: order.packeta_point_id,
          order_value: order.total_price,
          currency: order.currency,
        }),
      });

      const labelJson = await labelRes.json();

      console.log('[packeta-label] HTTP status:', labelRes.status);
      console.log('[packeta-label] full response:', JSON.stringify(labelJson, null, 2));
      if (labelJson.debug) {
        console.log('[packeta-label] DEBUG LOG:');
        (labelJson.debug as string[]).forEach((line: string) => console.log(' ', line));
      }
      if (labelJson.pdf_base64) {
        console.log('[packeta-label] pdf_base64 typeof:', typeof labelJson.pdf_base64);
        console.log('[packeta-label] pdf_base64 length:', labelJson.pdf_base64.length);
        console.log('[packeta-label] pdf_base64 first 100:', String(labelJson.pdf_base64).substring(0, 100));
      }

      if (!labelRes.ok || !labelJson.success) {
        const debugInfo = labelJson.debug ? `\nDEBUG: ${(labelJson.debug as string[]).join(' | ')}` : '';
        throw new Error((labelJson.message ?? labelJson.error ?? 'Generování štítku selhalo') + debugInfo);
      }

      const filename = `zasilkovna-${orderName}.pdf`;
      let savedToFolder = false;

      if (dirHandle) {
        try {
          await dirHandle.getFileHandle('__test_write__', { create: true })
            .then(fh => fh.createWritable())
            .then(w => w.close())
            .catch(() => {});
          await savePdfToFolder(dirHandle, filename, cleanBase64(labelJson.pdf_base64));
          savedToFolder = true;
        } catch {
          setDirHandleLost(true);
          downloadPdf(labelJson.pdf_base64, filename);
        }
      } else {
        downloadPdf(labelJson.pdf_base64, filename);
      }

      setProcessStep('fulfill');

      let fulfilled = false;
      let trackingUrl: string | undefined;
      let fulfillWarning: string | undefined;

      try {
        const fulfillRes = await fetch(`${functionsUrl}/fulfill-order`, {
          method: 'POST',
          headers: functionsHeaders,
          body: JSON.stringify({
            shop_domain: resolvedShopDomain,
            order_id: String(order.id),
            tracking_number: labelJson.barcode,
          }),
        });
        const fulfillJson = await fulfillRes.json();

        if (fulfillRes.ok && fulfillJson.success) {
          fulfilled = true;
          trackingUrl = fulfillJson.tracking_url;
        } else {
          fulfillWarning = fulfillJson.message ?? fulfillJson.error ?? 'Shopify fulfill selhal';
        }
      } catch {
        fulfillWarning = 'Nepodařilo se označit objednávku jako odeslanou v Shopify';
      }

      playSuccess();

      const pdfMsg = savedToFolder ? `Uloženo do složky jako ${filename}` : 'Staženo jako PDF';
      const statusMsg = fulfilled
        ? `${pdfMsg} · Expedováno + Označeno v Shopify`
        : `${pdfMsg}${fulfillWarning ? ` · Varování: ${fulfillWarning}` : ''}`;

      setHistory(prev => [{
        id: crypto.randomUUID(),
        time: new Date(),
        orderName: `#${orderName}`,
        status: fulfilled ? 'success' : 'warning',
        barcode: labelJson.barcode,
        trackingUrl,
        message: statusMsg,
        fulfilled,
      }, ...prev].slice(0, 50));
    } catch (err) {
      playError();
      setHistory(prev => [{
        id: crypto.randomUUID(),
        time: new Date(),
        orderName: `#${orderName}`,
        status: 'error',
        message: err instanceof Error ? err.message : 'Neznámá chyba',
      }, ...prev].slice(0, 50));
    } finally {
      setProcessState('idle');
      setCurrentOrder('');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      processOrder(input);
    }
  }

  const todayCount = history.filter(r =>
    (r.status === 'success' || r.status === 'warning') &&
    r.time.toDateString() === new Date().toDateString()
  ).length;

  function getStepLabel() {
    switch (processStep) {
      case 'order': return { main: `Načítám objednávku #${currentOrder}...`, sub: 'Ověřuji objednávku v Shopify...' };
      case 'label': return { main: `Generuji štítek pro objednávku #${currentOrder}...`, sub: 'Komunikuji s Packeta API...' };
      case 'fulfill': return { main: `Označuji objednávku #${currentOrder} jako odesláno...`, sub: 'Aktualizuji stav v Shopify...' };
    }
  }

  const stepLabel = getStepLabel();

  return (
    <div className="space-y-6">
      {dirHandleLost && dirHandle && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            Hot folder byl nastaven, ale po obnovení stránky je potřeba ho vybrat znovu. Jděte do <strong>Nastavení</strong> a znovu vyberte složku.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#008060]/10">
                <Scan className="w-5 h-5 text-[#008060]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Skener čárových kódů</h2>
                <p className="text-sm text-gray-500">Naskenujte číslo objednávky — štítek se vygeneruje automaticky</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Dnes: {todayCount} balíčků</span>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {processState === 'idle' ? (
            <div className="space-y-3">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Naskenujte číslo objednávky..."
                  autoFocus
                  className="w-full px-4 py-4 text-xl font-mono rounded-xl border-2 border-gray-200 focus:border-[#008060] focus:outline-none focus:ring-4 focus:ring-[#008060]/10 transition-all placeholder:text-gray-300 bg-gray-50 focus:bg-white"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Scan className="w-6 h-6 text-gray-300" />
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Podporované formáty: <span className="font-mono">1039</span>, <span className="font-mono">#1039</span>, <span className="font-mono">EXP1039</span>, <span className="font-mono">EXP#1039</span>
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="w-10 h-10 text-[#008060] animate-spin" />
              <div className="text-center">
                <p className="text-base font-semibold text-gray-900">{stepLabel.main}</p>
                <p className="text-sm text-gray-500 mt-1">{stepLabel.sub}</p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {(['order', 'label', 'fulfill'] as ProcessStep[]).map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full transition-colors ${
                      processStep === step
                        ? 'bg-[#008060] animate-pulse'
                        : (['order', 'label', 'fulfill'] as ProcessStep[]).indexOf(processStep) > i
                          ? 'bg-emerald-400'
                          : 'bg-gray-200'
                    }`} />
                    {i < 2 && <div className="w-6 h-px bg-gray-200" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Historie expedice (aktuální session)</h3>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-gray-100">
              {history.map(record => (
                <div key={record.id} className="flex items-start gap-4 px-5 py-3.5">
                  <div className="flex-shrink-0 mt-0.5">
                    {record.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : record.status === 'warning' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{record.orderName}</span>
                      {record.barcode && (
                        <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                          {record.barcode}
                        </span>
                      )}
                      {record.trackingUrl && (
                        <a
                          href={record.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#008060] hover:underline"
                        >
                          Sledovat
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    {record.message && (
                      <p className={`text-xs mt-0.5 ${
                        record.status === 'error' ? 'text-red-600' :
                        record.status === 'warning' ? 'text-amber-600' :
                        'text-gray-500'
                      }`}>
                        {record.message}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      record.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : record.status === 'warning'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                    }`}>
                      {record.status === 'success' ? 'Expedováno + Označeno' :
                       record.status === 'warning' ? 'Štítek OK' : 'Chyba'}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {record.time.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {history.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">Zatím žádné expedice</p>
          <p className="text-xs text-gray-400 mt-1">Naskenujte první objednávku a začněte expedovat</p>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <div className="flex items-start gap-2.5">
          <FolderOpen className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-gray-600">
              {dirHandle && !dirHandleLost
                ? `Hot folder: ${dirHandle.name} — PDF se ukládají přímo do složky`
                : 'Hot folder není nastaven — PDF se stahují klasicky do složky Stažené'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Nastavte hot folder v záložce <strong>Nastavení</strong> pro automatické ukládání štítků.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
