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
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState, useCallback } from 'react';

interface PacketaBranch {
  id: number;
  name: string;
  city: string;
  street: string;
  zip: string;
  country: string;
  url: string;
  labelRouting: string;
}

export default reactExtension(
  'purchase.checkout.shipping-option-list.render-after',
  () => <PacketaPickupSelector />,
);

function PacketaPickupSelector() {
  const applyMetafieldsChange = useApplyMetafieldsChange();
  const { api_key } = useSettings<{ api_key: string }>();
  const savedPoint = useMetafield({ namespace: 'packeta', key: 'pickup_point' });

  const [selectedPoint, setSelectedPoint] = useState<PacketaBranch | null>(null);
  const [branches, setBranches] = useState<PacketaBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSelector, setShowSelector] = useState(false);

  // Load saved point from metafield
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
      setError('Chybi API klic. Nastavte ho v nastaveni aplikace.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://widget.packeta.com/v6/api/pps/api/widget/v1/cz/branch.json?apiKey=${effectiveApiKey}`
      );

      if (!response.ok) {
        throw new Error('Chyba pri nacitani vydejnich mist.');
      }

      const data = await response.json();
      let filtered: PacketaBranch[] = [];

      if (data && data.data) {
        filtered = data.data
          .filter((b: PacketaBranch) => {
            const q = query.toLowerCase();
            return (
              b.name?.toLowerCase().includes(q) ||
              b.city?.toLowerCase().includes(q) ||
              b.zip?.includes(q) ||
              b.street?.toLowerCase().includes(q)
            );
          })
          .slice(0, 30);
      }

      setBranches(filtered);

      if (filtered.length === 0) {
        setError('Zadna vydejni mista nenalezena. Zkuste jiny dotaz.');
      }
    } catch (e) {
      setError('Nepodarilo se nacist vydejni mista. Zkuste to znovu.');
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

    const metafieldValue = JSON.stringify({
      packeta_point_id: String(branch.id),
      packeta_point_name: branch.name,
      packeta_point_address: `${branch.street}, ${branch.city} ${branch.zip}`,
    });

    await applyMetafieldsChange({
      type: 'updateMetafield',
      namespace: 'packeta',
      key: 'pickup_point',
      valueType: 'string',
      value: metafieldValue,
    });
  }

  return (
    <BlockStack spacing="base">
      {error && (
        <Banner status="critical" title={error} />
      )}

      {selectedPoint ? (
        <BlockStack spacing="tight">
          <Banner status="success" title="Vydejni misto vybrano">
            <Text>
              {selectedPoint.name} — {selectedPoint.street}, {selectedPoint.city} {selectedPoint.zip}
            </Text>
          </Banner>
          <Button kind="secondary" onPress={() => setShowSelector(true)}>
            Zmenit vydejni misto
          </Button>
        </BlockStack>
      ) : (
        <Button kind="primary" onPress={() => setShowSelector(true)}>
          Vybrat vydejni misto Zasilkovny
        </Button>
      )}

      {showSelector && (
        <BlockStack spacing="base">
          <InlineStack spacing="base">
            <TextField
              label="Hledat mesto, PSC nebo nazev"
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
              label="Vyberte vydejni misto"
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
