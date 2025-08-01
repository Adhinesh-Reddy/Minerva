import { NextApiRequest, NextApiResponse } from 'next';
import { readEmailReceipts } from '@/lib/emailReader';
import { supabase } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const receipts = await readEmailReceipts();

    const insertResults = await Promise.all(
      receipts.map((receipt) =>
        supabase.from('ledger').insert({
          date: receipt.date,
          amount: receipt.amount,
          vendor: receipt.vendor,
          raw_text: receipt.rawText
        })
      )
    );

    res.status(200).json({ inserted: insertResults.length, receipts });
  } catch (error) {
    console.error('Email parse/store error:', error);
    res.status(500).json({ error: 'Failed to parse and store emails' });
  }
}
