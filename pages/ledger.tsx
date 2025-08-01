import { useEffect, useState } from 'react';
import Papa from 'papaparse';

// Types

type RawCSVRow = {
  [key: string]: string;
};

type Receipt = {
  id: string;
  vendor: string;
  amount: number | string;
  date: string;
  description?: string;
};

type BankTransaction = {
  date: string;
  description: string;
  amount: number;
};

type ComparedTransaction = {
  source: 'ledger' | 'bank';
  vendor: string;
  date: string;
  amount: number;
  description?: string;
  status: 'match' | 'ledger_only' | 'bank_only';
};

function cleanAmount(value: string|number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  return parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
}

export default function LedgerPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [compared, setCompared] = useState<ComparedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  const fetchReceiptsFromDB = async () => {
    setLoading(true);
    const res = await fetch('/api/ledger');
    const json = await res.json();
    setReceipts(json.receipts);
    setLoading(false);
  };

  const handleFetchAndInsert = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/email/fetch', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        await fetchReceiptsFromDB();
      } else {
        console.error('Error inserting receipts:', result.error);
      }
    } catch (err) {
      console.error('Error calling fetch API:', err);
    }
    setFetching(false);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const parsed = results.data as RawCSVRow[];
        const cleaned: BankTransaction[] = parsed.map((row) => ({
          date: row['Date'] || row['Transaction Date'] || '',
          description: row['Description'] || row['Details'] || '',
          amount: parseFloat(row['Amount'] || row['Value'] || '0'),
        }));
        setBankTransactions(cleaned);
      },
    });
  };

  const compareTransactions = (
    ledger: Receipt[],
    bank: BankTransaction[]
  ): ComparedTransaction[] => {
    const matches: ComparedTransaction[] = [];
    const bankUsed = new Set<number>();

    ledger.forEach((led) => {
      const ledAmount = cleanAmount(led.amount);
      const matchIndex = bank.findIndex((b, idx) => {
        return (
          !bankUsed.has(idx) &&
          Number(b.amount).toFixed(2) === ledAmount.toFixed(2) &&
          new Date(b.date).toDateString() === new Date(led.date).toDateString() &&
          b.description.toLowerCase().includes(led.vendor.toLowerCase())
        );
      });

      if (matchIndex !== -1) {
        bankUsed.add(matchIndex);
        matches.push({
          source: 'ledger',
          vendor: led.vendor,
          date: led.date,
          amount: ledAmount,
          description: led.description,
          status: 'match',
        });
      } else {
        matches.push({
          source: 'ledger',
          vendor: led.vendor,
          date: led.date,
          amount: ledAmount,
          description: led.description,
          status: 'ledger_only',
        });
      }
    });

    bank.forEach((b, idx) => {
      if (!bankUsed.has(idx)) {
        matches.push({
          source: 'bank',
          vendor: b.description,
          date: b.date,
          amount: b.amount,
          description: '',
          status: 'bank_only',
        });
      }
    });

    return matches;
  };

  useEffect(() => {
    fetchReceiptsFromDB();
  }, []);

  useEffect(() => {
    if (receipts.length > 0 && bankTransactions.length > 0) {
      const result = compareTransactions(receipts, bankTransactions);
      setCompared(result);
    }
  }, [receipts, bankTransactions]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Ledger</h1>
        <button
          onClick={handleFetchAndInsert}
          disabled={fetching}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {fetching ? 'Fetching Receipts...' : 'Fetch & Insert Receipts'}
        </button>
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Upload Bank CSV:</label>
        <input
          type="file"
          accept=".csv"
          onChange={handleCSVUpload}
          className="text-sm"
        />
      </div>

      {loading ? (
        <p>Loading receipts...</p>
      ) : receipts.length === 0 ? (
        <p>No receipts found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow border border-gray-200 bg-white">
          <table className="min-w-full text-sm text-left text-gray-700">
            <thead className="bg-gray-100 border-b text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3">Vendor</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {receipts.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{r.vendor}</td>
                  <td className="px-6 py-4">
                    {!isNaN(cleanAmount(r.amount))
                      ? new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                        }).format(cleanAmount(r.amount))
                      : 'Invalid'}
                  </td>
                  <td className="px-6 py-4">
                    {new Date(r.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {r.description || <span className="italic text-gray-400">None</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {compared.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-4">🔍 Transaction Comparison</h2>
          <div className="overflow-x-auto rounded-lg shadow border border-gray-200 bg-white">
            <table className="min-w-full text-sm text-left text-gray-700">
              <thead className="bg-gray-100 border-b text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3">Vendor</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {compared.map((tx, i) => (
                  <tr
                    key={i}
                    className={`hover:bg-gray-50 ${
                      tx.status === 'match'
                        ? 'bg-green-50'
                        : tx.status === 'ledger_only'
                        ? 'bg-yellow-50'
                        : 'bg-red-50'
                    }`}
                  >
                    <td className="px-6 py-3">{tx.source}</td>
                    <td className="px-6 py-3">{tx.vendor}</td>
                    <td className="px-6 py-3">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="px-6 py-3">
                      {!isNaN(tx.amount)
                        ? new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          }).format(tx.amount)
                        : 'Invalid'}
                    </td>
                    <td className="px-6 py-3 font-medium">
                      {tx.status.replace('_', ' ').toUpperCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
