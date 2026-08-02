import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

type Invoice = {
  invoice_number: string;
  customer_name: string;
  created_at: string;
  items: { name: string; quantity: number; price: number; gst_rate: number; discount?: number }[];
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  payment_method: string;
  notes?: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);
}

export function invoiceHtml(inv: Invoice, business: { name: string; email?: string; gstin?: string } = { name: 'LotusERP' }) {
  const rows = inv.items.map((it, i) => {
    const line = it.price * it.quantity - (it.discount || 0);
    const taxAmt = line * (it.gst_rate || 0) / 100;
    return `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(it.name)}</td>
      <td class="r">${it.quantity}</td>
      <td class="r">₹${fmt(it.price)}</td>
      <td class="r">${it.gst_rate}%</td>
      <td class="r">₹${fmt(line + taxAmt)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
* { font-family: -apple-system, Helvetica, Arial, sans-serif; box-sizing: border-box; }
body { padding: 32px; color: #111; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #274A3D; padding-bottom: 16px; }
.brand { font-size: 24px; color: #274A3D; font-weight: 500; }
.tag { color: #6B6B70; font-size: 12px; margin-top: 4px; }
.inv-meta { text-align: right; font-size: 13px; color: #48484A; }
.inv-num { font-size: 20px; font-weight: 500; color: #111; }
.section { margin-top: 24px; }
.label { font-size: 11px; color: #6B6B70; text-transform: uppercase; letter-spacing: 0.5px; }
.value { font-size: 14px; color: #111; margin-top: 2px; }
table { width: 100%; border-collapse: collapse; margin-top: 12px; }
th, td { padding: 10px 8px; border-bottom: 1px solid #E5E5EA; font-size: 13px; text-align: left; }
th { background: #F5F5F7; color: #48484A; font-weight: 500; text-transform: uppercase; font-size: 11px; }
.r { text-align: right; }
.totals { margin-top: 24px; width: 240px; margin-left: auto; }
.totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
.totals .grand { font-size: 18px; color: #274A3D; font-weight: 500; border-top: 1px solid #C7C7CC; margin-top: 6px; padding-top: 10px; }
.foot { margin-top: 40px; padding-top: 12px; border-top: 1px solid #E5E5EA; font-size: 11px; color: #6B6B70; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">${escapeHtml(business.name)}</div>
    <div class="tag">Home Furnishing · Décor · Retail</div>
    ${business.gstin ? `<div class="tag">GSTIN: ${escapeHtml(business.gstin)}</div>` : ''}
  </div>
  <div class="inv-meta">
    <div class="inv-num">${escapeHtml(inv.invoice_number)}</div>
    <div>${(inv.created_at || '').slice(0, 10)}</div>
    <div>Payment: ${escapeHtml(inv.payment_method)}</div>
  </div>
</div>
<div class="section">
  <div class="label">Bill To</div>
  <div class="value">${escapeHtml(inv.customer_name)}</div>
</div>
<table>
  <thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST</th><th class="r">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div class="row"><span>Subtotal</span><span>₹${fmt(inv.subtotal)}</span></div>
  <div class="row"><span>GST</span><span>₹${fmt(inv.tax)}</span></div>
  <div class="row grand"><span>Total</span><span>₹${fmt(inv.total)}</span></div>
  <div class="row"><span>Paid</span><span>₹${fmt(inv.amount_paid)}</span></div>
  <div class="row"><span>Balance Due</span><span style="color:${inv.balance_due > 0 ? '#FF3B30' : '#34C759'}">₹${fmt(inv.balance_due)}</span></div>
</div>
${inv.notes ? `<div class="section"><div class="label">Notes</div><div class="value">${escapeHtml(inv.notes)}</div></div>` : ''}
<div class="foot">Thank you for your business — powered by LotusERP</div>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export async function generatePdf(inv: Invoice, business: any) {
  const html = invoiceHtml(inv, business);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

export async function sharePdf(uri: string, invoiceNumber: string) {
  if (Platform.OS === 'web') {
    // Open in new tab on web
    if (typeof window !== 'undefined') {
      window.open(uri, '_blank');
    }
    return;
  }
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Share ${invoiceNumber}`, UTI: 'com.adobe.pdf' });
  }
}

export async function shareOnWhatsApp(phone: string | undefined, text: string) {
  const digits = (phone || '').replace(/\D/g, '');
  const url = digits ? `whatsapp://send?phone=91${digits}&text=${encodeURIComponent(text)}` : `whatsapp://send?text=${encodeURIComponent(text)}`;
  const webUrl = digits ? `https://wa.me/91${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  const supported = await Linking.canOpenURL(url);
  await Linking.openURL(supported ? url : webUrl);
}
