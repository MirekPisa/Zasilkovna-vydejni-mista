import { useState } from 'react';
import { MapPin, Package, X, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  openHours: string;
}

const SAMPLE_POINTS: PickupPoint[] = [
  { id: '10623', name: 'Praha 1 - Náměstí Republiky', address: 'Náměstí Republiky 1', city: 'Praha 1', openHours: 'Po-Pá 8:00-20:00' },
  { id: '14455', name: 'Praha 2 - IP Pavlova', address: 'Náměstí I. P. Pavlova 5', city: 'Praha 2', openHours: 'Po-Ne 7:00-22:00' },
  { id: '22110', name: 'Praha 3 - Žižkov', address: 'Seifertova 51', city: 'Praha 3', openHours: 'Po-Pá 9:00-19:00' },
  { id: '31204', name: 'Praha 4 - Budějovická', address: 'Budějovická 15', city: 'Praha 4', openHours: 'Po-So 8:00-20:00' },
];

export function WidgetPreview() {
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<PickupPoint | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  function selectPoint(point: PickupPoint) {
    setSelected(point);
    setShowModal(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-50">
            <MapPin className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Náhled widgetu</h2>
            <p className="text-sm text-gray-500">Takto vypadá výběr výdejního místa v pokladně</p>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-6">
          <div className="max-w-md mx-auto">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Shopify Checkout — Doprava</p>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 rounded-full border-2 border-[#008060] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#008060]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Zásilkovna — výdejní místo</span>
                    <span className="text-sm font-semibold text-gray-900">49 Kč</span>
                  </div>
                  <span className="text-xs text-gray-500">Doručení 1-2 pracovní dny</span>
                </div>
              </div>

              {selected ? (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{selected.name}</p>
                    <p className="text-xs text-gray-500">{selected.address}, {selected.city}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{selected.openHours}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#008060] text-white text-sm font-medium hover:bg-[#006e52] transition-colors"
                >
                  <Package className="w-4 h-4" />
                  Vybrat výdejní místo Zásilkovny
                </button>
              )}

              {selected && (
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-2 w-full text-xs text-[#008060] hover:text-[#006e52] transition-colors underline-offset-2 hover:underline"
                >
                  Změnit výdejní místo
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">Zásilkovna widget v6</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>
            <MapPin className="w-3.5 h-3.5" />
            Otestovat widget
          </Button>
        </div>
      </CardBody>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <img
                  src="https://www.zasilkovna.cz/images/logo.svg"
                  alt="Zásilkovna"
                  className="h-5"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <h3 className="font-semibold text-gray-900">Vyberte výdejní místo</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="h-36 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-sm">
                <span className="flex flex-col items-center gap-2">
                  <MapPin className="w-8 h-8 opacity-40" />
                  Mapa výdejních míst<br />
                  <span className="text-xs">(Packeta widget v6)</span>
                </span>
              </div>
            </div>

            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {SAMPLE_POINTS.map(point => (
                <button
                  key={point.id}
                  onClick={() => selectPoint(point)}
                  onMouseEnter={() => setHoveredPoint(point.id)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  className={`w-full text-left px-5 py-3.5 transition-colors ${hoveredPoint === point.id ? 'bg-[#008060]/5' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{point.name}</p>
                      <p className="text-xs text-gray-500">{point.address}, {point.city}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{point.openHours}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 text-center">
              Toto je demonstrační náhled. Reálný widget načítá všechna výdejní místa z Packeta API.
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
