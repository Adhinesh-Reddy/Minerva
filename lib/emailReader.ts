import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { Buffer } from 'buffer';
import pdf from 'pdf-parse';

const imapUser = process.env.IMAP_EMAIL;
const imapPassword = process.env.IMAP_PASSWORD;

if (!imapUser || !imapPassword) {
  throw new Error('IMAP_EMAIL and IMAP_PASSWORD environment variables must be set');
}

const config = {
  imap: {
    user: imapUser,
    password: imapPassword,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false  // ⚠️ Development only
    },
    authTimeout: 3000
  }
};

export async function readEmailReceipts() {
  const connection = await imaps.connect(config);
  await connection.openBox('INBOX');

  const searchCriteria = ['UNSEEN'];
  const fetchOptions = {
    bodies: ['HEADER', 'TEXT'],
    struct: true,
    markSeen: true
  };

  const messages = await connection.search(searchCriteria, fetchOptions);

  const receipts: {
    date: string;
    amount: string;
    vendor: string;
    rawText: string;
  }[] = [];

  for (const message of messages) {
    const parts = imaps.getParts(message.attributes.struct || []);
    const attachments = parts.filter((p) => p.disposition && p.disposition.type === 'ATTACHMENT');

    for (const attachment of attachments) {
      if (attachment.params?.name?.endsWith('.pdf')) {
        const partData = await connection.getPartData(message, attachment);
        const pdfBuffer = Buffer.from(partData);
        const parsed = await pdf(pdfBuffer);

        const rawText = parsed.text;

        // Simple regex or parsing logic to extract useful fields
        const amountMatch = rawText.match(/\$[\d,]+\.\d{2}/);
        const vendorMatch = rawText.match(/(?:Vendor|Store|From):?\s*(.+)/i);
        const dateMatch = rawText.match(/(?:Date):?\s*([\d\/\-]+)/i);

        receipts.push({
          date: dateMatch?.[1] || 'Unknown',
          amount: amountMatch?.[0] || 'Unknown',
          vendor: vendorMatch?.[1]?.trim() || 'Unknown',
          rawText
        });
      }
    }
  }

  await connection.end();
  return receipts;
}
