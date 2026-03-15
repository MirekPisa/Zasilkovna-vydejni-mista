import { useState, useEffect } from 'react';
import { Key, Save, CheckCircle, Eye, EyeOff, AlertCircle, Store } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { functionsUrl, functionsHeaders } from '../../lib/supabase';

const DEMO_SHOP = 'demo-shop.myshopify.com';

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [shopifyToken, setShopifyToken] = useState('');
  const [shopifyShopDomain, setShopifyShopDomain] = useState('printybob.myshopify.com');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${functionsUrl}/manage-config?shop_domain=${encodeURIComponent(DEMO_SHOP)}`,
        { headers: functionsHeaders }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Nepodařilo se načíst konfiguraci');
      if (json.data) {
        setApiKey(json.data.packeta_api_key ?? '');
        setApiPassword(json.data.packeta_api_password ?? '');
        setIsActive(json.data.is_active ?? true);
        setShopifyToken(json.data.shopify_access_token ?? '');
        setShopifyShopDomain(json.data.shopify_shop_domain || 'printybob.myshopify.com');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nepodařilo se načíst konfiguraci');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(
        `${functionsUrl}/manage-config?shop_domain=${encodeURIComponent(DEMO_SHOP)}`,
        {
          method: 'POST',
          headers: functionsHeaders,
          body: JSON.stringify({
            packeta_api_key: apiKey,
            packeta_api_password: apiPassword,
            is_active: isActive,
            shopify_access_token: shopifyToken,
            shopify_shop_domain: shopifyShopDomain,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Nepodařilo se uložit konfiguraci');
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nepodařilo se uložit konfiguraci');
    } finally {
      setSaving(false);
    }
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
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
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

              <div className="relative">
                <Input
                  label="API heslo Zásilkovny (pro štítky)"
                  type={showPassword ? 'text' : 'password'}
                  value={apiPassword}
                  onChange={e => setApiPassword(e.target.value)}
                  placeholder="Packeta REST API heslo"
                  hint="Jiné než API klíč — najdete ho v Packeta klientské zóně → API → REST API heslo. Potřebné pro generování expedičních štítků."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

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
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Shopify Admin API</h2>
              <p className="text-sm text-gray-500">Potřebné pro zobrazení objednávek z vašeho eshopu</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          {loading ? (
            <div className="space-y-3">
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              <Input
                label="Shop domain"
                type="text"
                value={shopifyShopDomain}
                onChange={e => setShopifyShopDomain(e.target.value)}
                placeholder="vas-eshop.myshopify.com"
                hint="Doména vašeho Shopify eshopu"
              />
              <div className="relative">
                <Input
                  label="Admin API přístupový token"
                  type={showToken ? 'text' : 'password'}
                  value={shopifyToken}
                  onChange={e => setShopifyToken(e.target.value)}
                  placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  hint="Shopify Admin → Aplikace → Soukromé aplikace → Admin API token (oprávnění: Orders - Read)"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <div className="flex items-center justify-between">
        <Button onClick={handleSave} loading={saving} disabled={loading || saving}>
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
