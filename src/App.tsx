import { useState } from 'react';
import { Settings2, Package, BookOpen, LayoutDashboard, MapPin, TrendingUp, ShoppingBag, Scan } from 'lucide-react';
import { Settings } from './components/admin/Settings';
import { OrdersList } from './components/admin/OrdersList';
import { SetupGuide } from './components/admin/SetupGuide';
import { WidgetPreview } from './components/admin/WidgetPreview';
import { Expedice } from './components/admin/Expedice';

type Tab = 'dashboard' | 'settings' | 'orders' | 'expedice' | 'setup';

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Přehled', icon: LayoutDashboard },
  { id: 'settings', label: 'Nastavení', icon: Settings2 },
  { id: 'orders', label: 'Objednávky', icon: Package },
  { id: 'expedice', label: 'Expedice', icon: Scan },
  { id: 'setup', label: 'Průvodce', icon: BookOpen },
];

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-[#F6F6F7]">
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
            <nav className="flex items-center gap-1">
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
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Přehled</h2>
              <p className="text-sm text-gray-500 mt-0.5">Zásilkovna integrace pro váš Shopify obchod</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Objednávky celkem" value="3" icon={ShoppingBag} color="bg-blue-50 text-blue-600" />
              <StatCard label="Tento týden" value="2" icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
              <StatCard label="Výdejní míst použito" value="3" icon={MapPin} color="bg-red-50 text-red-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WidgetPreview />
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Jak to funguje</h3>
                  <ol className="space-y-3">
                    {[
                      { step: '1', text: 'Zákazník v pokladně vybere dopravu "Zásilkovna"' },
                      { step: '2', text: 'Klikne na "Vybrat výdejní místo" — otevře se Packeta widget' },
                      { step: '3', text: 'Vybere místo na mapě nebo ze seznamu' },
                      { step: '4', text: 'Výběr se uloží do objednávky jako metafield' },
                    ].map(item => (
                      <li key={item.step} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#008060]/10 text-[#008060] text-xs font-bold flex items-center justify-center mt-0.5">
                          {item.step}
                        </span>
                        <p className="text-sm text-gray-600">{item.text}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                  <h3 className="text-sm font-semibold text-amber-800 mb-1.5">Rychlý start</h3>
                  <p className="text-sm text-amber-700">
                    Nastav Packeta API klíč v záložce <strong>Nastavení</strong>, pak postupuj podle <strong>Průvodce nasazením</strong>.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-md transition-colors"
                    >
                      Nastavení →
                    </button>
                    <button
                      onClick={() => setActiveTab('setup')}
                      className="text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-md transition-colors"
                    >
                      Průvodce →
                    </button>
                  </div>
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
            <Expedice />
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
