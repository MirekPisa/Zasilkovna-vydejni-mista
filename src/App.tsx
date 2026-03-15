import { useState, useEffect, useCallback, useRef } from 'react';
import { Settings2, Package, BookOpen, LayoutDashboard, MapPin, TrendingUp, ShoppingBag, Scan, RefreshCw, AlertCircle, CheckCircle, ArrowRight, Smartphone, ShoppingCart, Tag, Truck, BarChart3, Clock, Zap, X } from 'lucide-react';
import { Settings } from './components/admin/Settings';
import { OrdersList } from './components/admin/OrdersList';
import { SetupGuide } from './components/admin/SetupGuide';
import { WidgetPreview } from './components/admin/WidgetPreview';
import { Expedice } from './components/admin/Expedice';
import { functionsUrl, functionsHeaders } from './lib/supabase';
import { useBarcodeScanner } from './lib/barcodeScanner';

interface ScanToast {
  id: string;
  code: string;
}

type Tab = 'dashboard' | 'settings' | 'orders' | 'expedice' | 'setup';

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Přehled', icon: LayoutDashboard },
  { id: 'settings', label: 'Nastavení', icon: Settings2 },
  { id: 'orders', label: 'Objednávky', icon: Package },
  { id: 'expedice', label: 'Expedice', icon: Scan },
  { id: 'setup', label: 'Průvodce', icon: BookOpen },
];

const DEMO_SHOP = 'demo-shop.myshopify.com';

interface DashboardStats {
  total: number;
  thisWeek: number;
  uniquePoints: number;
  fulfilled: number;
  paid: number;
  pending: number;
}

function StatCard({ label, value, sub, icon: Icon, color, loading }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-500">{label}</p>
          {loading ? (
            <div className="h-8 w-16 bg-gray-100 rounded-md animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          )}
          {sub && !loading && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [pendingScan, setPendingScan] = useState<string | null>(null);
  const [scanToasts, setScanToasts] = useState<ScanToast[]>([]);
  const scannerActive = useRef(true);

  useEffect(() => {
    if (activeTab === 'dashboard') loadStats();
  }, [activeTab]);

  const handleGlobalScan = useCallback((code: string) => {
    const toastId = crypto.randomUUID();
    setScanToasts(prev => [...prev, { id: toastId, code }]);
    setTimeout(() => {
      setScanToasts(prev => prev.filter(t => t.id !== toastId));
    }, 3500);

    setPendingScan(code);
    setActiveTab('expedice');
  }, []);

  useBarcodeScanner(handleGlobalScan);

  async function loadStats() {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch(
        `${functionsUrl}/shopify-orders?shop_domain=${encodeURIComponent(DEMO_SHOP)}`,
        { headers: functionsHeaders }
      );
      const json = await res.json();
      if (!res.ok) {
        setStatsError(json.message ?? json.error ?? 'Nepodařilo se načíst data');
        setStats(null);
        return;
      }
      const orders = json.data ?? [];
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisWeek = orders.filter((o: { created_at: string }) => new Date(o.created_at) >= weekAgo).length;
      const uniquePoints = new Set(orders.map((o: { packeta_point_id: string }) => o.packeta_point_id).filter(Boolean)).size;
      const fulfilled = orders.filter((o: { fulfillment_status: string | null }) => o.fulfillment_status === 'fulfilled').length;
      const paid = orders.filter((o: { financial_status: string }) => o.financial_status === 'paid').length;
      const pending = orders.filter((o: { fulfillment_status: string | null }) => !o.fulfillment_status).length;
      setStats({ total: orders.length, thisWeek, uniquePoints, fulfilled, paid, pending });
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : 'Chyba sítě');
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F6F7]">
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {scanToasts.map(toast => (
          <div
            key={toast.id}
            className="flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl text-sm font-medium animate-in slide-in-from-right-4 duration-300 pointer-events-auto"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#008060] flex-shrink-0">
              <Scan className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400 leading-none mb-0.5">Scan detekován</p>
              <p className="font-mono text-white leading-none">{toast.code}</p>
            </div>
            <button
              onClick={() => setScanToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-4 h-14">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900 leading-tight">Zásilkovna</h1>
                <p className="text-xs text-gray-400 leading-tight">pro Shopify</p>
              </div>
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <nav className="flex items-center gap-1 flex-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </nav>
            <div
              title="Globální scanner aktivní — skenujte kdekoliv v aplikaci"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 cursor-default select-none"
              ref={scannerActive as React.RefObject<HTMLDivElement>}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <Scan className="w-3 h-3 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700 hidden sm:block">Scanner</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Přehled</h2>
                <p className="text-sm text-gray-500 mt-0.5">Živá data z vašeho Shopify obchodu</p>
              </div>
              <button
                onClick={loadStats}
                disabled={statsLoading}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
                Obnovit
              </button>
            </div>

            {statsError && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Data se nepodařilo načíst ze Shopify</p>
                  <p className="text-xs text-amber-700 mt-0.5">{statsError} — zkontrolujte Shopify token v <button onClick={() => setActiveTab('settings')} className="underline font-medium">Nastavení</button>.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Objednávky celkem"
                value={stats?.total ?? '—'}
                sub={stats ? `${stats.paid} zaplaceno` : undefined}
                icon={ShoppingBag}
                color="bg-blue-50 text-blue-600"
                loading={statsLoading}
              />
              <StatCard
                label="Tento týden"
                value={stats?.thisWeek ?? '—'}
                sub="posledních 7 dní"
                icon={TrendingUp}
                color="bg-emerald-50 text-emerald-600"
                loading={statsLoading}
              />
              <StatCard
                label="Unikátní výdejní místa"
                value={stats?.uniquePoints ?? '—'}
                sub="různých poboček"
                icon={MapPin}
                color="bg-red-50 text-red-500"
                loading={statsLoading}
              />
              <StatCard
                label="Čeká na expedici"
                value={stats?.pending ?? '—'}
                sub="bez fulfillmentu"
                icon={Clock}
                color="bg-orange-50 text-orange-500"
                loading={statsLoading}
              />
            </div>

            {stats && !statsLoading && stats.total > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-400" />
                    Stav objednávek
                  </h3>
                  <button onClick={() => setActiveTab('orders')} className="text-xs text-[#008060] hover:text-[#006e52] font-medium flex items-center gap-1 transition-colors">
                    Zobrazit vše <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Zaplaceno', value: stats.paid, total: stats.total, color: 'bg-emerald-500' },
                    { label: 'Odesláno', value: stats.fulfilled, total: stats.total, color: 'bg-blue-500' },
                    { label: 'Čeká', value: stats.pending, total: stats.total, color: 'bg-orange-400' },
                  ].map(bar => (
                    <div key={bar.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-500">{bar.label}</span>
                        <span className="text-xs font-semibold text-gray-900">{bar.value}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${bar.color}`}
                          style={{ width: bar.total > 0 ? `${Math.round((bar.value / bar.total) * 100)}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WidgetPreview />

              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-gray-400" />
                    Jak celý systém funguje
                  </h3>

                  <div className="space-y-0">
                    {[
                      {
                        icon: Smartphone,
                        color: 'bg-blue-50 text-blue-600',
                        title: 'Zákazník vybere Zásilkovnu',
                        desc: 'V Shopify pokladně (checkout) zákazník vybere přepravní metodu "Zásilkovna". Zobrazí se tlačítko pro výběr výdejního místa přímo v kroku Doprava.',
                        where: 'Shopify Checkout → krok Doprava',
                      },
                      {
                        icon: MapPin,
                        color: 'bg-red-50 text-red-500',
                        title: 'Packeta widget — výběr místa',
                        desc: 'Po kliknutí na tlačítko se otevře Packeta Widget v6 s interaktivní mapou všech výdejních míst. Zákazník vybere pobočku, výběr se okamžitě uloží do košíku přes Cart API.',
                        where: 'Shopify Checkout → overlay modal',
                        ux: 'UX: Tlačítko je přímo v checkout kroku — zákazník neodchází z pokladny. Po výběru se zobrazí název a adresa místa s možností změny.',
                      },
                      {
                        icon: ShoppingCart,
                        color: 'bg-emerald-50 text-emerald-600',
                        title: 'Data uložena do objednávky',
                        desc: 'ID výdejního místa, název a adresa se ukládají jako note_attributes objednávky (packeta_point_id, packeta_point_name, packeta_point_address). Webhook také přepíše dodací adresu na adresu výdejního místa.',
                        where: 'Shopify Order → note_attributes + shipping address',
                      },
                      {
                        icon: Tag,
                        color: 'bg-orange-50 text-orange-500',
                        title: 'Generování štítku (Expedice)',
                        desc: 'V záložce Objednávky nebo přes čtečku čárových kódů (záložka Expedice) se vytvoří zásilka v Packeta systému a stáhne PDF štítek. Při expedici se objednávka automaticky označí jako fulfilled.',
                        where: 'Admin app → záložka Expedice nebo Objednávky',
                      },
                      {
                        icon: Truck,
                        color: 'bg-gray-50 text-gray-600',
                        title: 'Zásilka je na cestě',
                        desc: 'Zákazník obdrží notifikaci o odeslání ze Shopify. Zásilka je sledovatelná přes Packeta tracking číslo (barcode z vygenerovaného štítku).',
                        where: 'Shopify → email zákazníkovi',
                      },
                    ].map((item, i, arr) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${item.color}`}>
                            <item.icon className="w-4 h-4" />
                          </div>
                          {i < arr.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" />}
                        </div>
                        <div className={`pb-4 min-w-0 flex-1 ${i === arr.length - 1 ? '' : ''}`}>
                          <p className="text-sm font-medium text-gray-900">{item.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                          <p className="text-xs text-gray-400 mt-1 font-mono bg-gray-50 px-2 py-0.5 rounded inline-block">{item.where}</p>
                          {item.ux && (
                            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1.5">
                              <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span>{item.ux}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">UX hodnocení výběru místa</h3>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Widget přímo v checkoutu', ok: true, note: 'zákazník neodchází ze stránky' },
                      { label: 'Výběr viditelný po výběru', ok: true, note: 'zobrazí se název + adresa místa' },
                      { label: 'Uložení do Cart API', ok: true, note: 'data přetrvají i při reload stránky (sessionStorage záloha)' },
                      { label: 'Tlačítko "Změnit místo"', ok: true, note: 'zákazník může kdykoliv změnit výběr' },
                      { label: 'Validace před objednáním', ok: true, note: 'zobrazí se chyba pokud není vybráno místo' },
                      { label: 'Mobilní zobrazení', ok: true, note: 'widget Packeta je responzivní' },
                    ].map(row => (
                      <div key={row.label} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-medium text-gray-800">{row.label}</span>
                          <span className="text-xs text-gray-400"> — {row.note}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                  <h3 className="text-sm font-semibold text-amber-800 mb-1.5">Rychlý start</h3>
                  <p className="text-sm text-amber-700">
                    Nastav Packeta API klíč v <button onClick={() => setActiveTab('settings')} className="font-semibold underline">Nastavení</button>, pak postupuj podle <button onClick={() => setActiveTab('setup')} className="font-semibold underline">Průvodce nasazením</button>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Nastavení</h2>
              <p className="text-sm text-gray-500 mt-0.5">Konfigurace Zásilkovna / Packeta integrace</p>
            </div>
            <Settings />
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Objednávky na Zásilkovnu</h2>
              <p className="text-sm text-gray-500 mt-0.5">Přehled objednávek s vybraným výdejním místem</p>
            </div>
            <OrdersList />
          </div>
        )}

        {activeTab === 'expedice' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Expedice</h2>
              <p className="text-sm text-gray-500 mt-0.5">Automatické generování štítků pomocí čtečky čárových kódů</p>
            </div>
            <Expedice
              externalScan={pendingScan}
              onExternalScanHandled={() => setPendingScan(null)}
            />
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Průvodce nasazením</h2>
              <p className="text-sm text-gray-500 mt-0.5">Kroky pro nasazení Zásilkovna extension do Shopify pokladny</p>
            </div>
            <SetupGuide />
          </div>
        )}
      </main>
    </div>
  );
}
