import {
  reactExtension,
  BlockStack,
  Button,
  Text,
  Banner,
  useApplyMetafieldsChange,
  useMetafield,
  useSettings,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Packeta?: {
      Widget?: {
        pick: (options: PacketaOptions, callback: (point: PacketaPoint | null) => void) => void;
        close: () => void;
      };
    };
  }
}

interface PacketaOptions {
  apiKey: string;
  country: string;
  language: string;
  appIdentity: string;
  defaultCurrency?: string;
}

interface PacketaPoint {
  id: string;
  name: string;
  formattedAddress: string;
  place?: string;
  zip?: string;
  city?: string;
}

export default reactExtension(
  'purchase.checkout.shipping-option-list.render-after',
  () => <PacketaPickupSelector />,
);

function PacketaPickupSelector() {
  const applyMetafieldsChange = useApplyMetafieldsChange();
  const { api_key } = useSettings<{ api_key: string }>();
  const savedPoint = useMetafield({ namespace: 'packeta', key: 'pickup_point' });

  const [selectedPoint, setSelectedPoint] = useState<PacketaPoint | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptRef = useRef(false);

  useEffect(() => {
    if (savedPoint?.value) {
      try {
        const parsed = JSON.parse(savedPoint.value as string);
        setSelectedPoint(parsed);
      } catch {}
    }
  }, [savedPoint]);

  useEffect(() => {
    if (scriptRef.current) return;
    scriptRef.current = true;

    const script = document.createElement('script');
    script.src = 'https://widget.packeta.com/v6/www/js/library.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setError('Nepodařilo se načíst Packeta widget.');
    document.head.appendChild(script);
  }, []);

  function openWidget() {
    if (!scriptLoaded || !window.Packeta?.Widget) {
      setError('Widget ještě není připraven. Zkuste to znovu.');
      return;
    }

    const effectiveApiKey = api_key || '[API_KEY]';

    window.Packeta.Widget.pick(
      {
        apiKey: effectiveApiKey,
        country: 'cz',
        language: 'cs',
        appIdentity: 'shopify-zasilkovna-app',
        defaultCurrency: 'CZK',
      },
      async (point) => {
        if (!point) return;

        setSelectedPoint(point);
        setError(null);

        const metafieldValue = JSON.stringify({
          packeta_point_id: point.id,
          packeta_point_name: point.name,
          packeta_point_address: point.formattedAddress,
        });

        await applyMetafieldsChange({
          type: 'updateMetafield',
          namespace: 'packeta',
          key: 'pickup_point',
          valueType: 'string',
          value: metafieldValue,
        });
      },
    );
  }

  return (
    <BlockStack spacing="base">
      {error && (
        <Banner status="critical" title={error} />
      )}

      {selectedPoint ? (
        <BlockStack spacing="tight">
          <Banner status="success" title="Výdejní místo vybráno">
            <Text>
              {selectedPoint.name} — {selectedPoint.formattedAddress}
            </Text>
          </Banner>
          <Button kind="secondary" onPress={openWidget}>
            Změnit výdejní místo
          </Button>
        </BlockStack>
      ) : (
        <Button kind="primary" onPress={openWidget} loading={!scriptLoaded}>
          Vybrat výdejní místo Zásilkovny
        </Button>
      )}
    </BlockStack>
  );
}
