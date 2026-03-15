import { Terminal, Code2, ShoppingCart, CheckCircle2, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';

const steps = [
  {
    icon: Terminal,
    color: 'bg-gray-100 text-gray-700',
    title: '1. Nainstaluj Shopify CLI',
    description: 'Shopify CLI je potřeba pro vývoj a nasazení aplikace.',
    code: 'npm install -g @shopify/cli @shopify/theme',
  },
  {
    icon: Code2,
    color: 'bg-blue-50 text-blue-600',
    title: '2. Spusť checkout extension',
    description: 'Extension se zobrazí zákazníkům při výběru dopravy.',
    code: 'shopify app deploy --extension checkout-ui',
  },
  {
    icon: ShoppingCart,
    color: 'bg-[#008060]/10 text-[#008060]',
    title: '3. Aktivuj v Shopify Adminu',
    description: 'V nastavení pokladny aktivuj Zásilkovna Extension pod "Checkout UI Extensions".',
    code: null,
  },
];

export function SetupGuide() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50">
              <CheckCircle2 className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Průvodce nasazením</h2>
              <p className="text-sm text-gray-500">Kroky pro integraci Zásilkovny do Shopify pokladny</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className={`flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 ${step.color}`}>
                <step.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>
                {step.code && (
                  <div className="mt-2 bg-gray-900 rounded-lg px-4 py-2.5">
                    <code className="text-xs text-emerald-400 font-mono">{step.code}</code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Checkout Extension — kód</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Soubor <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">extensions/checkout-ui/src/Checkout.tsx</code>
          </p>
        </CardHeader>
        <CardBody>
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-xs text-gray-300 font-mono leading-5">{`import { reactExtension, useExtensionApi } from '@shopify/ui-extensions-react/checkout';
import { useEffect, useRef } from 'react';

export default reactExtension(
  'purchase.checkout.shipping-option-list.render-after',
  () => <PacketaPickupSelector />
);

function PacketaPickupSelector() {
  const scriptRef = useRef(false);

  useEffect(() => {
    if (scriptRef.current) return;
    scriptRef.current = true;

    const script = document.createElement('script');
    script.src = 'https://widget.packeta.com/v6/www/js/library.js';
    script.onload = () => console.log('Packeta widget ready');
    document.head.appendChild(script);
  }, []);

  function openWidget() {
    window.Packeta?.Widget?.pick({
      apiKey: API_KEY,
      country: 'cz',
      language: 'cs',
      appIdentity: 'shopify-zasilkovna-app',
    }, (point) => {
      if (point) savePickupPoint(point);
    });
  }

  return (
    <BlockStack>
      <Button onPress={openWidget}>
        Vybrat výdejní místo Zásilkovny
      </Button>
    </BlockStack>
  );
}`}</pre>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Užitečné odkazy</h2>
        </CardHeader>
        <CardBody>
          <ul className="space-y-3">
            {[
              { label: 'Packeta API dokumentace', url: 'https://docs.packeta.com' },
              { label: 'Shopify Checkout Extensions', url: 'https://shopify.dev/docs/api/checkout-ui-extensions' },
              { label: 'Packeta widget příklady (CodePen)', url: 'https://codepen.io/Packeta' },
              { label: 'Shopify App Bridge', url: 'https://shopify.dev/docs/api/app-bridge' },
            ].map(link => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#008060] hover:text-[#006e52] transition-colors group"
                >
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-60 group-hover:opacity-100" />
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
