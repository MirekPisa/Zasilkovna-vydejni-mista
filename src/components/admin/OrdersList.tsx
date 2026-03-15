import { useState, useEffect } from 'react';
import { Package, MapPin, Mail, RefreshCw, Inbox } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { functionsUrl, functionsHeaders, type OrderPickup } from '../../lib/supabase';

const DEMO_SHOP = 'demo-shop.myshopify.com';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'právě teď';
  if (mins < 60) return `před ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `před ${hrs} hod`;
  const days = Math.floor(hrs / 24);
  return `před ${days} ${days === 1 ? 'dnem' : days < 5 ? 'dny' : 'dny'}`;
}

export function OrdersList() {
  const [orders, setOrders] = useState<OrderPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${functionsUrl}/save-point?shop_domain=${encodeURIComponent(DEMO_SHOP)}`,
        { headers: functionsHeaders }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Nepodařilo se načíst objednávky');
      setOrders(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nepodařilo se načíst objednávky');
    } finally {
      setLoading(false);
    }
  }

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
                {loading ? 'Načítám...' : error ? 'Chyba při načítání' : orders.length === 0 ? 'Žádné objednávky' : `${orders.length} ${orders.length === 1 ? 'objednávka' : orders.length < 5 ? 'objednávky' : 'objednávek'} celkem`}
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
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardBody>
      ) : error ? (
        <CardBody>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="w-12 h-12 text-red-200 mb-3" />
            <p className="text-gray-600 font-medium">Chyba při načítání objednávek</p>
            <p className="text-sm text-gray-400 mt-1">{error}</p>
            <Button variant="secondary" size="sm" onClick={loadOrders} className="mt-4">
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
              Jakmile zákazník vybere výdejní místo Zásilkovny v pokladně, objednávka se zde zobrazí.
            </p>
          </div>
        </CardBody>
      ) : (
        <div className="divide-y divide-gray-100">
          {orders.map(order => (
            <div key={order.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 flex-shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{order.order_name || order.order_id}</span>
                      <Badge variant="success">Zásilkovna</Badge>
                      <span className="text-xs text-gray-400 font-mono">ID: {order.packeta_point_id}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{order.packeta_point_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {order.packeta_point_address}
                    </p>
                    {order.customer_email && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        {order.customer_email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(order.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
