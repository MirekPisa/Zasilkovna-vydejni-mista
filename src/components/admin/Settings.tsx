import { useState, useEffect } from 'react';
import { Key, Save, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';

const DEMO_SHOP = 'demo-shop.myshopify.com';

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    const { data } = await supabase
      .from('app_config')
      .select('*')
      .eq('shop_domain', DEMO_SHOP)
      .maybeSingle();

    if (data) {
      setApiKey(data.packeta_api_key);
      setIsActive(data.is_active);
      setConfigId(data.id);
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    if (configId) {
      await supabase
        .from('app_config')
        .update({ packeta_api_key: apiKey, is_active: isActive })
        .eq('id', configId);
    } else {
      const { data } = await supabase
        .from('app_config')
        .insert({ shop_domain: DEMO_SHOP, packeta_api_key: apiKey, is_active: isActive })
        .select()
        .single();
      if (data) setConfigId(data.id);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#008060]/10">
              <Key className="w-5 h-5 text-[#008060]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Packeta API klíč</h2>
              <p className="text-sm text-gray-500">Klíč pro Packeta widget v6 (pickup point selector)</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          {loading ? (
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <div className="relative">
              <Input
                label="API klíč Zásilkovny"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Váš Packeta API klíč"
                hint="Najdete ho v Packeta klientské zóně → API → Klíče"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(v => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#008060] focus:ring-offset-2 ${isActive ? 'bg-[#008060]' : 'bg-gray-300'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-gray-700">Integrace aktivní</p>
              <p className="text-xs text-gray-500">Widget se zobrazí zákazníkům v pokladně</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button onClick={handleSave} loading={saving} disabled={loading}>
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Uloženo
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Uložit nastavení
                </>
              )}
            </Button>
            {saved && (
              <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                Nastavení bylo úspěšně uloženo
              </span>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Widget konfigurace</h2>
          <p className="text-sm text-gray-500 mt-0.5">Parametry předávané Packeta widgetu v6</p>
        </CardHeader>
        <CardBody>
          <div className="bg-gray-900 rounded-lg p-4 text-sm font-mono overflow-x-auto">
            <pre className="text-emerald-400 leading-6 whitespace-pre">{[
              `Packeta.Widget.pick({`,
              `  apiKey: '${apiKey || 'VÁŠ_API_KLÍČ'}',`,
              `  country: 'cz',`,
              `  language: 'cs',`,
              `  appIdentity: 'shopify-zasilkovna-app',`,
              `  defaultCurrency: 'CZK',`,
              `}, callback);`,
            ].join('\n')}</pre>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
