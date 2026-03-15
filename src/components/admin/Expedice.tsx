import { useState, useEffect, useRef, useCallback } from 'react';
import { Scan, CheckCircle, XCircle, Clock, Package, Loader2, FolderOpen, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { functionsUrl, functionsHeaders } from '../../lib/supabase';
import { loadDirectoryHandle, savePdfToFolder } from '../../lib/hotFolder';
import { playSuccess, playError } from '../../lib/audio';

const DEMO_SHOP = 'demo-shop.myshopify.com';

interface ScanRecord {
  id: string;
  time: Date;
  orderName: string;
  status: 'success' | 'error';
  barcode?: string;
  message?: string;
}

type ProcessState = 'idle' | 'processing';

function downloadPdf(base64: string, filename: string) {
  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${base64}`;
  link.download = filename;
  link.click();
}

export function Expedice() {
  const [input, setInput] = useState('');
  const [processState, setProcessState] = useState<ProcessState>('idle');
  const [currentOrder, setCurrentOrder] = useState('');
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirHandleLost, setDirHandleLost] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDirectoryHandle().then(handle => {
      if (handle) {
        setDirHandle(handle);
        setDirHandleLost(true);
      }
    }).catch(() => {});
  }, []);

  const focusInput = useCallback(() => {
    if (inputRef.current && processState === 'idle') {
      inputRef.current.focus();
    }
  }, [processState]);

  useEffect(() => {
    focusInput();
  }, [processState, focusInput]);

  useEffect(() => {
    const handler = () => focusInput();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [focusInput]);

  async function processOrder(raw: string) {
    const orderName = raw.replace(/^#/, '').trim();
    if (!orderName) return;

    setInput('');
    setProcessState('processing');
    setCurrentOrder(orderName);

    try {
      const res = await fetch(`${functionsUrl}/packeta-label`, {
        method: 'POST',
        headers: functionsHeaders,
        body: JSON.stringify({
          shop_domain: DEMO_SHOP,
          order_id: orderName,
          order_name: `#${orderName}`,
          customer_name: 'Zákazník',
          customer_email: '',
          packeta_point_id: '',
          order_value: '0',
          currency: 'CZK',
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message ?? json.error ?? 'Generování štítku selhalo');
      }

      const filename = `zasilkovna-${orderName}.pdf`;
      let savedToFolder = false;

      if (dirHandle) {
        try {
          await dirHandle.getFileHandle('__test_write__', { create: true })
            .then(fh => fh.createWritable())
            .then(w => w.close())
            .catch(() => {});
          await savePdfToFolder(dirHandle, filename, json.pdf_base64);
          savedToFolder = true;
        } catch {
          setDirHandleLost(true);
          downloadPdf(json.pdf_base64, filename);
        }
      } else {
        downloadPdf(json.pdf_base64, filename);
      }

      playSuccess();

      setHistory(prev => [{
        id: crypto.randomUUID(),
        time: new Date(),
        orderName: `#${orderName}`,
        status: 'success',
        barcode: json.barcode,
        message: savedToFolder ? `Uloženo do složky jako ${filename}` : 'Staženo jako PDF',
      }, ...prev].slice(0, 50));
    } catch (err) {
      playError();
      setHistory(prev => [{
        id: crypto.randomUUID(),
        time: new Date(),
        orderName: `#${orderName}`,
        status: 'error',
        message: err instanceof Error ? err.message : 'Neznámá chyba',
      }, ...prev].slice(0, 50));
    } finally {
      setProcessState('idle');
      setCurrentOrder('');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      processOrder(input);
    }
  }

  const todayCount = history.filter(r =>
    r.status === 'success' &&
    r.time.toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6">
      {dirHandleLost && dirHandle && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            Hot folder byl nastaven, ale po obnovení stránky je potřeba ho vybrat znovu. Jděte do <strong>Nastavení</strong> a znovu vyberte složku.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#008060]/10">
                <Scan className="w-5 h-5 text-[#008060]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Skener čárových kódů</h2>
                <p className="text-sm text-gray-500">Naskenujte číslo objednávky — štítek se vygeneruje automaticky</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Dnes: {todayCount} balíčků</span>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {processState === 'idle' ? (
            <div className="space-y-3">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Naskenujte číslo objednávky..."
                  autoFocus
                  className="w-full px-4 py-4 text-xl font-mono rounded-xl border-2 border-gray-200 focus:border-[#008060] focus:outline-none focus:ring-4 focus:ring-[#008060]/10 transition-all placeholder:text-gray-300 bg-gray-50 focus:bg-white"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Scan className="w-6 h-6 text-gray-300" />
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Čtečka odešle číslo objednávky a stiskne Enter — nebo zadejte ručně a potvrďte Enter
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="w-10 h-10 text-[#008060] animate-spin" />
              <div className="text-center">
                <p className="text-base font-semibold text-gray-900">Generuji štítek pro objednávku #{currentOrder}</p>
                <p className="text-sm text-gray-500 mt-1">Komunikuji s Packeta API...</p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Historie expedice (aktuální session)</h3>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-gray-100">
              {history.map(record => (
                <div key={record.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-shrink-0">
                    {record.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{record.orderName}</span>
                      {record.barcode && (
                        <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                          {record.barcode}
                        </span>
                      )}
                    </div>
                    {record.message && (
                      <p className={`text-xs mt-0.5 ${record.status === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
                        {record.message}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      record.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {record.status === 'success' ? 'Expedováno' : 'Chyba'}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {record.time.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {history.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">Zatím žádné expedice</p>
          <p className="text-xs text-gray-400 mt-1">Naskenujte první objednávku a začněte expedovat</p>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <div className="flex items-start gap-2.5">
          <FolderOpen className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-gray-600">
              {dirHandle && !dirHandleLost
                ? `Hot folder: ${dirHandle.name} — PDF se ukládají přímo do složky`
                : 'Hot folder není nastaven — PDF se stahují klasicky do složky Stažené'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Nastavte hot folder v záložce <strong>Nastavení</strong> pro automatické ukládání štítků.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
