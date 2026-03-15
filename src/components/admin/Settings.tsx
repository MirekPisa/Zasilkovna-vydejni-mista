import { useState, useEffect } from 'react';
import { Key, Save, CheckCircle, Eye, EyeOff, AlertCircle, Store, FolderOpen, FolderCheck, X, Printer, MapPin, Webhook } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { functionsUrl, functionsHeaders } from '../../lib/supabase';
import { saveDirectoryHandle, loadDirectoryHandle, clearDirectoryHandle } from '../../lib/hotFolder';

const DEMO_SHOP = 'demo-shop.myshopify.com';

const LABEL_FORMATS = [
  { value: 'A6 on A6', label: 'A6 on A6 — 105×148 mm, přímý tisk' },
  { value: 'A7 on A7', label: 'A7 on A7 — 105×74 mm' },
  { value: 'A6 on A4', label: 'A6 on A4 — 105×148 mm na A4' },
  { value: 'A7 on A4', label: 'A7 on A4 — 105×74 mm na A4' },
  { value: '105x35mm on A4', label: '105×35 mm on A4 — úzký štítek na A4' },
  { value: 'A8 on A8', label: 'A8 on A8 — 50×74 mm' },
];

const ZPL_DPIS = [
  { value: 203, label: '203 DPI' },
  { value: 300, label: '300 DPI' },
];

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [shopifyToken, setShopifyToken] = useState('');
  const [shopifyShopDomain, setShopifyShopDomain] = useState('printybob.myshopify.com');
  const [overwriteShippingAddress, setOverwriteShippingAddress] = useState(true);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [labelFormat, setLabelFormat] = useState('A6 on A6');
  const [labelOffset, setLabelOffset] = useState(0);
  const [labelType, setLabelType] = useState<'pdf' | 'zpl'>('pdf');
  const [zplDpi, setZplDpi] = useState(203);
  const [hdAddressId, setHdAddressId] = useState(106);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [hotFolderHandle, setHotFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [hotFolderError, setHotFolderError] = useState<string | null>(null);

  const isA4Format = labelFormat.includes('on A4');

  useEffect(() => {
    loadConfig();
    loadDirectoryHandle().then(handle => {
      if (handle) setHotFolderHandle(handle);
    }).catch(() => {});
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
        setOverwriteShippingAddress(json.data.overwrite_shipping_address ?? true);
        setLabelFormat(json.data.label_format ?? 'A6 on A6');
        setLabelOffset(json.data.label_offset ?? 0);
        setLabelType(json.data.label_type ?? 'pdf');
        setZplDpi(json.data.zpl_dpi ?? 203);
        setHdAddressId(json.data.hd_address_id ?? 106);
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
            overwrite_shipping_address: overwriteShippingAddress,
            label_format: labelFormat,
            label_offset: labelOffset,
            label_type: labelType,
            zpl_dpi: zplDpi,
            hd_address_id: hdAddressId,
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

  async function handleSelectFolder() {
    setHotFolderError(null);
    try {
      const handle = await (window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker?.();
      if (!handle) throw new Error('Nepodporovaný prohlížeč');
      await saveDirectoryHandle(handle);
      setHotFolderHandle(handle);
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setHotFolderError(e.message);
      }
    }
  }

  async function handleClearFolder() {
    await clearDirectoryHandle();
    setHotFolderHandle(null);
  }

  async function handleRegisterWebhook() {
    setRegisteringWebhook(true);
    setWebhookStatus(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const webhookUrl = `${supabaseUrl}/functions/v1/webhook-orders-create`;
      const res = await fetch(
        `${functionsUrl}/register-webhook`,
        {
          method: 'POST',
          headers: functionsHeaders,
          body: JSON.stringify({
            shop_domain: shopifyShopDomain || DEMO_SHOP,
            webhook_url: webhookUrl,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Nepodařilo se zaregistrovat webhook');
      if (json.already_exists) {
        setWebhookStatus({ ok: true, message: 'Webhook je již zaregistrován' });
      } else {
        setWebhookStatus({ ok: true, message: 'Webhook byl úspěšně zaregistrován' });
      }
    } catch (e) {
      setWebhookStatus({ ok: false, message: e instanceof Error ? e.message : 'Chyba při registraci webhookU' });
    } finally {
      setRegisteringWebhook(false);
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-50">
              <MapPin className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Webhook objednávek</h2>
              <p className="text-sm text-gray-500">Automatické přepsání dodací adresy na výdejní místo Zásilkovny</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          {loading ? (
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
                <button
                  type="button"
                  role="switch"
                  aria-checked={overwriteShippingAddress}
                  onClick={() => setOverwriteShippingAddress(v => !v)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#008060] focus:ring-offset-2 ${overwriteShippingAddress ? 'bg-[#008060]' : 'bg-gray-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${overwriteShippingAddress ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-gray-700">Přepisovat dodací adresu na výdejní místo</p>
                  <p className="text-xs text-gray-500">Po přijetí objednávky webhook přepíše shipping_address na adresu vybraného výdejního místa</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRegisterWebhook}
                    disabled={registeringWebhook || loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    <Webhook className="w-4 h-4" />
                    {registeringWebhook ? 'Registruji…' : 'Zaregistrovat webhook v Shopify'}
                  </button>
                </div>

                {webhookStatus && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${webhookStatus.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                    {webhookStatus.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                    {webhookStatus.message}
                  </div>
                )}

                <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Tlačítko výše automaticky zaregistruje webhook <strong>orders/create</strong> do vašeho Shopify eshopu.
                    Objednávky se Zásilkovnou budou mít automaticky přepsanou dodací adresu na adresu výdejního místa.
                    Nejprve uložte Shopify Admin API token a doménu eshopu.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100">
              <Printer className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Nastavení štítků</h2>
              <p className="text-sm text-gray-500">Formát a typ štítků generovaných přes Packeta API</p>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Formát štítku
                </label>
                <select
                  value={labelFormat}
                  onChange={e => setLabelFormat(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#008060] focus:border-transparent transition-all"
                >
                  {LABEL_FORMATS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              {isA4Format && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Offset pozice <span className="text-gray-400 font-normal">(0–3)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={labelOffset}
                    onChange={e => setLabelOffset(Math.min(3, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-32 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#008060] focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Počet prázdných pozic před prvním štítkem na stránce A4</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Typ štítku
                </label>
                <div className="flex gap-4">
                  {(['pdf', 'zpl'] as const).map(type => (
                    <label key={type} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="labelType"
                        value={type}
                        checked={labelType === type}
                        onChange={() => setLabelType(type)}
                        className="w-4 h-4 text-[#008060] border-gray-300 focus:ring-[#008060]"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {type === 'pdf' ? 'PDF' : 'ZPL'}
                        </span>
                        <span className="text-xs text-gray-400 ml-1.5">
                          {type === 'pdf' ? '(výchozí, všechny tiskárny)' : '(termotiskárny — Zebra apod.)'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {labelType === 'zpl' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    ZPL DPI
                  </label>
                  <select
                    value={zplDpi}
                    onChange={e => setZplDpi(parseInt(e.target.value))}
                    className="w-40 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#008060] focus:border-transparent transition-all"
                  >
                    {ZPL_DPIS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1.5">Rozlišení termotiskárny — zkontrolujte v manuálu tiskárny</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  HD Address ID <span className="text-gray-400 font-normal">(doručení na adresu)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={hdAddressId}
                  onChange={e => setHdAddressId(parseInt(e.target.value) || 106)}
                  className="w-32 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#008060] focus:border-transparent transition-all"
                />
                <p className="text-xs text-gray-400 mt-1.5">ID přepravce Zásilkovny pro doručení na adresu. Výchozí: <strong>106</strong> (Zásilkovna Home Delivery CZ). Najdete ho v Packeta klientské zóně → Přepravci.</p>
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
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-50">
              <FolderOpen className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Hot Folder pro štítky</h2>
              <p className="text-sm text-gray-500">Štítky se budou automaticky ukládat přímo do vybrané složky</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {hotFolderError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{hotFolderError}</p>
            </div>
          )}

          {hotFolderHandle ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <FolderCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-800 truncate">{hotFolderHandle.name}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Štítky se ukládají do této složky automaticky</p>
              </div>
              <button
                type="button"
                onClick={handleClearFolder}
                className="flex-shrink-0 p-1.5 rounded-md text-emerald-600 hover:bg-emerald-100 transition-colors"
                title="Odebrat složku"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200 border-dashed">
              <FolderOpen className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Žádná složka není vybrána</p>
                <p className="text-xs text-gray-400 mt-0.5">PDF štítky se budou stahovat klasicky do Stažené</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectFolder}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
            >
              <FolderOpen className="w-4 h-4 text-gray-500" />
              {hotFolderHandle ? 'Změnit složku' : 'Vybrat složku'}
            </button>
            <p className="text-xs text-gray-400">
              Vyžaduje Chrome / Edge — používá File System Access API
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-700">
              <strong>Poznámka:</strong> Po obnovení stránky je nutné složku vybrat znovu — prohlížeč z bezpečnostních důvodů neukládá trvalý přístup ke složkám.
            </p>
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
