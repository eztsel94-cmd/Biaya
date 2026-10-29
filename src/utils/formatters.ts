import { ExpenseRecord, TruckUnit } from '../types/truck';
import * as XLSX from 'xlsx';

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('id-ID').format(val);
}

export function formatDateIndo(dateStr: string, format: 'short' | 'long' = 'short'): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: format === 'short' ? 'short' : 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function exportExpensesToExcel(expenses: ExpenseRecord[], trucks: TruckUnit[]): void {
  const truckMap = new Map(trucks.map(t => [t.id, t]));
  const data = expenses.map(e => {
    const truck = truckMap.get(e.truckId);
    return {
      'Tanggal': e.date,
      'Kode Unit': truck?.code || '-',
      'Nomor Polisi': truck?.plateNumber || '-',
      'Supir': truck?.driverName || '-',
      'Kategori Biaya': e.category,
      'Keterangan': e.description,
      'Nominal Biaya (IDR)': e.amount,
      'Vendor / Bengkel / SPBU': e.vendor,
      'No Nota / Kuitansi': e.invoiceNumber || '-',
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan_Biaya_TBS');
  XLSX.writeFile(wb, `Laporan_Biaya_Truk_TBS_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportExpensesToCSV(expenses: ExpenseRecord[], trucks: TruckUnit[]): void {
  const truckMap = new Map(trucks.map(t => [t.id, t]));

  const headers = ['ID', 'Tanggal', 'Kode Unit', 'Nomor Polisi', 'Supir', 'Kategori', 'Keterangan', 'Jumlah (IDR)', 'Vendor / Bengkel', 'No Nota'];
  
  const rows = expenses.map(e => {
    const truck = truckMap.get(e.truckId);
    return [
      e.id,
      e.date,
      `"${truck?.code || '-'}"`,
      `"${truck?.plateNumber || '-'}"`,
      `"${truck?.driverName || '-'}"`,
      `"${e.category}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      e.amount,
      `"${e.vendor.replace(/"/g, '""')}"`,
      `"${e.invoiceNumber || ''}"`,
    ];
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Laporan_Biaya_Truk_TBS_Harbor_Homes_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
