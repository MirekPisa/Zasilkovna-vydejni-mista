import { useState, useEffect } from 'react';
import { Package, MapPin, Mail, RefreshCw, Inbox } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { supabase, type OrderPickup } from '../../lib/supabase';

const DEMO_SHOP = 'demo-shop.myshopify.com';

const DEMO_ORDERS: OrderPickup[] = [
  {
    id: '1',
    shop_domain: DEMO_SHOP,
    order_id: 'gid://shopify/Order/5001',
    order_name: '#1001',
    packeta_point_id: '10623',
    packeta_point_name: 'Praha 1 - Náměstí Republiky',
    packeta_point_address: 'Náměstí Republiky 1, 110 00 Praha 1',
    customer_email: 'jan.novak@example.cz',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    shop_domain: DEMO_SHOP,
    order_id: 'gid://shopify/Order/5002',
    order_name: '#1002',
    packeta_point_id: '14455',
    packeta_point_name: 'Brno - Tesco Futurum',
    packeta_point_address: 'Heršpická 21, 639 00 Brno',
    customer_email: 'marie.svobodova@example.cz',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    shop_domain: DEMO_SHOP,
    order_id: 'gid://shopify/Order/5003',
    order_name: '#1003',
    packeta_point_id: '22110',
    packeta_point_name: 'Ostrava - Avion Shopping Park',
    packeta_point_address: 'Rudná 3114/114, 700 30 Ostrava',
    customer_email: 'petr.kral@example.cz',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `před ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `před ${hrs} hod`;
  const days = Math.floor(hrs / 24);
  return `před ${days} dny`;
}

export function OrdersList() {
  const [orders, setOrders] = useState<OrderPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [useDemoData, setUseDemoData] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    const { data } = await supabase
      .from('order_pickups')
      .select('*')
      .eq('shop_domain', DEMO_SHOP)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      setOrders(data);
      setUseDemoData(false);
    } else {
      setOrders(DEMO_ORDERS);
      setUseDemoData(true);
    }
    setLoading(false);
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
                {useDemoData ? 'Ukázková data — reálná data se zobrazí po integraci' : `${orders.length} objednávek celkem`}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={loadOrders}>
            <RefreshCw className="w-3.5 h-3.5" />
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
      ) : orders.length === 0 ? (
        <CardBody>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Zatím žádné objednávky</p>
            <p className="text-sm text-gray-400 mt-1">Objednávky se zde zobrazí po výběru výdejního místa zákazníkem</p>
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
                      <span className="font-semibold text-sm text-gray-900">{order.order_name}</span>
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
                  <span className="text-xs text-gray-400">{timeAgo(order.created_at)}</span>
                  {useDemoData && (
                    <p className="text-xs text-amber-500 mt-1">Demo</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
