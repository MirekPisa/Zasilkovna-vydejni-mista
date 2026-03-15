import {
  reactExtension,
  BlockStack,
  InlineStack,
  Button,
  Text,
  TextField,
  Banner,
  Select,
  useApplyMetafieldsChange,
  useMetafield,
  useSettings,
  useShop,
  useCartLines,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState, useCallback } from 'react';

const SUPABASE_URL = 'https://ueeesorcaacmegwmvnnz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZWVzb3JjYWFjbWVnd212bm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTk1NTMsImV4cCI6MjA4OTEzNTU1M30.-rGO4rF7srpzMhLIQ1ln13QpTHsvQjWMgiWm9gkQ5OA';

interface PacketaBranch {
  id: number;
  name: string;
  city: string;
  street: string;
  zip: string;
  country: string;
}

export default reactExtension(
  'purchase.checkout.shipping-option-list.render-after',
  () => <PacketaPickupSelector />,
);

function PacketaPickupSelector() {
  const applyMetafieldsChange = useApplyMetafieldsChange();
  const { api_key } = useSettings<{ api_key: string }>();
  const savedPoint = useMetafield({ namespace: 'packeta', key: 'pickup_point' });
  const shop = useShop();
  const cartLines = useCartLines();

  const [selectedPoint, setSelectedPoint] = useState<PacketaBranch | null>(null);
  const [branches, setBranches] = useState<PacketaBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    if (savedPoint?.value) {
      try {
        const parsed = JSON.parse(savedPoint.value as string);
        setSelectedPoint(parsed);
      } catch {}
    }
  }, [savedPoint]);

  const fetchBranches = useCallback(async (query: string) => {
    const effectiveApiKey = api_key || '';
    if (!effectiveApiKey) {
      setError('Chybí API klíč. Nastavte ho v nastavení aplikace.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://widget.packeta.com/v6/api/pps/api/widget/v1/cz/branch.json?apiKey=${effectiveApiKey}`
      );

      if (!response.ok) throw new Error('Chyba při načítání výdejních míst.');

      const data = await response.json();
      let filtered: PacketaBranch[] = [];

      if (data?.data) {
        const q = query.toLowerCase();
        filtered = data.data
          .filter((b: PacketaBranch) =>
            b.name?.toLowerCase().includes(q) ||
            b.city?.toLowerCase().includes(q) ||
            b.zip?.includes(q) ||
            b.street?.toLowerCase().includes(q)
          )
          .slice(0, 30);
      }

      setBranches(filtered);
      if (filtered.length === 0) setError('Žádná výdejní místa nenalezena. Zkuste jiný dotaz.');
    } catch {
      setError('Nepodařilo se načíst výdejní místa. Zkuste to znovu.');
    } finally {
      setLoading(false);
    }
  }, [api_key]);

  async function selectBranch(branchId: string) {
    const branch = branches.find(b => String(b.id) === branchId);
    if (!branch) return;

    setSelectedPoint(branch);
    setShowSelector(false);
    setError(null);
    setSaving(true);

    const pointAddress = `${branch.street}, ${branch.city} ${branch.zip}`;

    const metafieldValue = JSON.stringify({
      packeta_point_id: String(branch.id),
      packeta_point_name: branch.name,
      packeta_point_address: pointAddress,
    });

    await applyMetafieldsChange({
      type: 'updateMetafield',
      namespace: 'packeta',
      key: 'pickup_point',
      valueType: 'string',
      value: metafieldValue,
    });

    const cartToken = cartLines.length > 0 ? `cart-${cartLines[0].id}` : `cart-${Date.now()}`;

    try {
      await fetch(`${SUPABASE_URL}/functions/v1/save-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          shop_domain: shop.myshopifyDomain,
          order_id: cartToken,
          order_name: '',
          customer_email: '',
          packeta_point_id: String(branch.id),
          packeta_point_name: branch.name,
          packeta_point_address: pointAddress,
        }),
      });
    } catch {
    } finally {
      setSaving(false);
    }
  }

  return (
    <BlockStack spacing="base">
      {error && <Banner status="critical" title={error} />}

      {selectedPoint ? (
        <BlockStack spacing="tight">
          <Banner status="success" title={saving ? 'Ukládám...' : 'Výdejní místo vybráno'}>
            <Text>
              {(selectedPoint as unknown as { packeta_point_name?: string }).packeta_point_name ?? selectedPoint.name}
              {' — '}
              {(selectedPoint as unknown as { packeta_point_address?: string }).packeta_point_address ?? `${selectedPoint.street}, ${selectedPoint.city} ${selectedPoint.zip}`}
            </Text>
          </Banner>
          <Button kind="secondary" onPress={() => setShowSelector(true)}>
            Změnit výdejní místo
          </Button>
        </BlockStack>
      ) : (
        <Button kind="primary" onPress={() => setShowSelector(true)}>
          Vybrat výdejní místo Zásilkovny
        </Button>
      )}

      {showSelector && (
        <BlockStack spacing="base">
          <InlineStack spacing="base">
            <TextField
              label="Hledat město, PSČ nebo název"
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
            />
            <Button
              kind="secondary"
              onPress={() => fetchBranches(searchQuery)}
              loading={loading}
            >
              Hledat
            </Button>
          </InlineStack>

          {branches.length > 0 && (
            <Select
              label="Vyberte výdejní místo"
              options={branches.map(b => ({
                value: String(b.id),
                label: `${b.name} - ${b.street}, ${b.city} ${b.zip}`,
              }))}
              onChange={(val) => selectBranch(val)}
            />
          )}
        </BlockStack>
      )}
    </BlockStack>
  );
}
