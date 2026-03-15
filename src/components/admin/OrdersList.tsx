import { useState, useEffect, useCallback } from 'react';
import { Package, MapPin, Mail, RefreshCw, Inbox, User, CreditCard, AlertCircle, Settings, Printer, CheckCircle, Tag } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { functionsUrl, functionsHeaders } from '../../lib/supabase';

const DEMO_SHOP = 'demo-shop.myshopify.com';

interface ShopifyOrder {
  id: number;
  name: string;
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  shipping_title: string | null;
  packeta_point_id: string;
  packeta_point_name: string;
  packeta_point_address: string;
}

type LabelState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; barcode: string }
  | { status: 'error'; message: string };

const FINANCIAL_STATUS_LABELS: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
  paid: { label: 'Zaplaceno', variant: 'success' },
  pending: { label: 'Čeká na platbu', variant: 'warning' },
  refunded: { label: 'Vráceno', variant: 'default' },
  voided: { label: 'Zrušeno', variant: 'error' },
  partially_paid: { label: 'Částečně zaplaceno', variant: 'warning' },
  partially_refunded: { label: 'Částečně vráceno', variant: 'default' },
};

const FULFILLMENT_STATUS_LABELS: Record<string, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  fulfilled: { label: 'Odesláno', variant: 'success' },
  partial: { label: 'Částečně odesláno', variant: 'warning' },
  null: { label: 'Nezpracováno', variant: 'default' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatPrice(price: string, currency: string): string {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(parseFloat(price));
}

function downloadPdf(base64: string, filename: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function OrdersList() {
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; type?: string } | null>(null);
  const [totalFetched, setTotalFetched] = useState<number | null>(null);
  const [labelStates, setLabelStates] = useState<Record<number, LabelState>>({});

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${functionsUrl}/shopify-orders?shop_domain=${encodeURIComponent(DEMO_SHOP)}`,
        { headers: functionsHeaders }
      );
      const json = await res.json();
      if (!res.ok) {
        setError({ message: json.message ?? json.error ?? 'Nepodařilo se načíst objednávky', type: json.error });
        return;
      }
      setOrders(json.data ?? []);
      setTotalFetched(json.total ?? null);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : 'Nepodařilo se načíst objednávky' });
    } finally {
      setLoading(false);
    }
  }

  const setLabelState = useCallback((orderId: number, state: LabelState) => {
    setLabelStates(prev => ({ ...prev, [orderId]: state }));
  }, []);

  async function handleCreateLabel(order: ShopifyOrder) {
    setLabelState(order.id, { status: 'loading' });
    try {
      const res = await fetch(`${functionsUrl}/packeta-label`, {
        method: 'POST',
        headers: functionsHeaders,
        body: JSON.stringify({
          shop_domain: DEMO_SHOP,
          order_id: String(order.id),
          order_name: order.name,
          customer_name: order.customer_name ?? '',
          customer_email: order.customer_email ?? '',
          packeta_point_id: order.packeta_point_id,
          order_value: order.total_price,
          currency: order.currency,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLabelState(order.id, { status: 'error', message: json.message ?? json.error ?? 'Chyba při generování štítku' });
        return;
      }
      setLabelState(order.id, { status: 'done', barcode: json.barcode });
      const safeOrderName = order.name.replace(/[^a-zA-Z0-9-]/g, '');
      downloadPdf(json.pdf_base64, `zasilkovna-${safeOrderName}.pdf`);
    } catch (e) {
      setLabelState(order.id, { status: 'error', message: e instanceof Error ? e.message : 'Chyba sítě' });
    }
  }

  const financialInfo = (status: string) => FINANCIAL_STATUS_LABELS[status] ?? { label: status, variant: 'default' as const };
  const fulfillmentInfo = (status: string | null) => FULFILLMENT_STATUS_LABELS[status ?? 'null'] ?? { label: status ?? 'Nezpracováno', variant: 'default' as const };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Objednávky na Zásilkovnu</h2>
              <p className="text-sm text-gray-500">
                {loading
                  ? 'Načítám ze Shopify...'
                  : error
                  ? 'Chyba při načítání'
                  : orders.length === 0
                  ? 'Žádné objednávky'
                  : `${orders.length} ${orders.length === 1 ? 'objednávka' : orders.length < 5 ? 'objednávky' : 'objednávek'} Zásilkovna${totalFetched !== null ? ` z celkem ${totalFetched} objednávek` : ''}`}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={loadOrders} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Obnovit
          </Button>
        </div>
      </CardHeader>

      {loading ? (
        <CardBody>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardBody>
      ) : error ? (
        <CardBody>
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            {error.type === 'NO_TOKEN' ? (
              <>
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-gray-700 font-medium">Shopify API token není nastaven</p>
                  <p className="text-sm text-gray-400 mt-1 max-w-sm">
                    Přejděte do záložky Nastavení, zadejte Shopify Admin API token a shop domain, a uložte.
                  </p>
                </div>
              </>
            ) : error.type === 'INVALID_TOKEN' ? (
              <>
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-gray-700 font-medium">Neplatný Shopify API token</p>
                  <p className="text-sm text-gray-400 mt-1 max-w-sm">
                    Token byl odmítnut Shopify API. Zkontrolujte token v Nastavení a ujistěte se, že má oprávnění Orders - Read.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-gray-700 font-medium">Chyba při načítání objednávek</p>
                  <p className="text-sm text-gray-400 mt-1">{error.message}</p>
                </div>
              </>
            )}
            <Button variant="secondary" size="sm" onClick={loadOrders}>
              Zkusit znovu
            </Button>
          </div>
        </CardBody>
      ) : orders.length === 0 ? (
        <CardBody>
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Inbox className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">Zatím žádné objednávky s výdejním místem</p>
            <p className="text-sm text-gray-400 mt-1 max-w-sm">
              {totalFetched !== null && totalFetched > 0
                ? `Zkontrolováno ${totalFetched} objednávek — žádná neobsahuje Zásilkovnu jako metodu dopravy ani packeta atributy.`
                : 'Jakmile zákazník odešle objednávku se Zásilkovnou, zobrazí se zde.'}
            </p>
          </div>
        </CardBody>
      ) : (
        <div className="divide-y divide-gray-100">
          {orders.map(order => {
            const fin = financialInfo(order.financial_status);
            const ful = fulfillmentInfo(order.fulfillment_status);
            const hasPacketaData = !!(order.packeta_point_id || order.packeta_point_name);
            const labelState = labelStates[order.id] ?? { status: 'idle' };
            const canCreateLabel = hasPacketaData && order.packeta_point_id;

            return (
              <div key={order.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 flex-shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm text-gray-900">{order.name}</span>
                        <Badge variant={fin.variant}>{fin.label}</Badge>
                        <Badge variant={ful.variant}>{ful.label}</Badge>
                        {labelState.status === 'done' && (
                          <Badge variant="success">Odesláno do Zásilkovny</Badge>
                        )}
                      </div>

                      {order.shipping_title && (
                        <p className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                          <Package className="w-3 h-3 flex-shrink-0" />
                          {order.shipping_title}
                        </p>
                      )}

                      {hasPacketaData && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2 mb-1.5 space-y-0.5">
                          {order.packeta_point_name && (
                            <p className="text-xs font-medium text-emerald-800">{order.packeta_point_name}</p>
                          )}
                          {order.packeta_point_address && (
                            <p className="text-xs text-emerald-700 flex items-center gap-1">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {order.packeta_point_address}
                            </p>
                          )}
                          {order.packeta_point_id && (
                            <p className="text-xs text-emerald-600 font-mono">ID: {order.packeta_point_id}</p>
                          )}
                        </div>
                      )}

                      {labelState.status === 'done' && (
                        <div className="flex items-center gap-1.5 mb-1.5 text-xs text-emerald-700 font-medium">
                          <Tag className="w-3.5 h-3.5" />
                          Barcode: <span className="font-mono">{labelState.barcode}</span>
                        </div>
                      )}

                      {labelState.status === 'error' && (
                        <div className="flex items-start gap-1.5 mb-1.5 p-2 rounded-md bg-red-50 border border-red-100">
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700">{labelState.message}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        {order.customer_name && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {order.customer_name}
                          </span>
                        )}
                        {order.customer_email && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {order.customer_email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                      {formatPrice(order.total_price, order.currency)}
                    </p>
                    <p className="text-xs text-gray-400 whitespace-nowrap">{formatDate(order.created_at)}</p>

                    {labelState.status === 'done' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Štítek vytvořen
                      </span>
                    ) : (
                      <div className="relative group">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canCreateLabel || labelState.status === 'loading'}
                          loading={labelState.status === 'loading'}
                          onClick={() => handleCreateLabel(order)}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Vytvořit štítek
                        </Button>
                        {!canCreateLabel && (
                          <div className="absolute bottom-full right-0 mb-1.5 w-44 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal text-center leading-snug z-10">
                            Chybí výdejní místo — zákazník nevybral pobočku Zásilkovny
                            <span className="absolute top-full right-3 border-4 border-transparent border-t-gray-900" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
