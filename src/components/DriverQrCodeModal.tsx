import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { TruckUnit } from '../types/truck';
import { getDriverPortalUrl, getWhatsAppShareUrl } from '../utils/driverLink';
import {
  X,
  Download,
  Copy,
  Check,
  Share2,
  Printer,
  QrCode,
  Truck,
  User,
  ShieldCheck,
  ExternalLink,
  Smartphone,
  Sparkles,
} from 'lucide-react';

interface DriverQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  truck: TruckUnit | null;
  onOpenDriverPortal?: (truckId: string) => void;
}

export const DriverQrCodeModal: React.FC<DriverQrCodeModalProps> = ({
  isOpen,
  onClose,
  truck,
  onOpenDriverPortal,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen || !truck) return;

    let isMounted = true;
    setIsGenerating(true);

    const portalUrl = getDriverPortalUrl(truck);

    // Generate high-resolution QR Code
    QRCode.toDataURL(portalUrl, {
      width: 420,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#042f2e', // Deep emerald dark
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!isMounted) return;
        setQrDataUrl(url);
        setIsGenerating(false);

        // Draw composite printable sticker card to canvas for download
        drawCompositeCard(url, truck, portalUrl);
      })
      .catch((err) => {
        console.error('Error generating QR code:', err);
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, truck]);

  // Draw printable badge card onto canvas for high-quality PNG download
  const drawCompositeCard = (qrImageSrc: string, truckData: TruckUnit, url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Dimensions: 640 x 860 px (crisp high-res card)
      canvas.width = 640;
      canvas.height = 860;

      // 1. Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Outer border
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#059669'; // Emerald 600
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      // Inner thin border
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

      // 2. Header banner
      ctx.fillStyle = '#064e3b'; // Emerald 900
      ctx.fillRect(18, 18, canvas.width - 36, 110);

      // Header title
      ctx.fillStyle = '#10b981'; // Emerald 400
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SISTEM OPERASIONAL TBS TRAKSI KPU', canvas.width / 2, 48);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('PORTAL KHUSUS SUPIR TRUK', canvas.width / 2, 82);

      ctx.fillStyle = '#a7f3d0';
      ctx.font = '13px sans-serif';
      ctx.fillText('Scan untuk Melihat Catatan Biaya & Operasional Mobil Ini Saja', canvas.width / 2, 108);

      // 3. Truck Unit Info Box
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(36, 145, canvas.width - 72, 110);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(36, 145, canvas.width - 72, 110);

      // Truck Code (Big & Prominent)
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(truckData.code, canvas.width / 2, 188);

      // Plate Number badge
      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(truckData.plateNumber, canvas.width / 2, 218);

      // Driver Name
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`Supir: ${truckData.driverName}${truckData.phone ? ` • ${truckData.phone}` : ''}`, canvas.width / 2, 242);

      // 4. QR Code in Center
      const qrSize = 380;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 275;

      // QR white frame with soft shadow border
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#10b981';
      ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);

      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // 5. Instruction text below QR
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📱 CARA PENGGUNAAN:', canvas.width / 2, 695);

      ctx.fillStyle = '#334155';
      ctx.font = '13px sans-serif';
      ctx.fillText('1. Buka Kamera HP atau WhatsApp lalu scan barcode di atas.', canvas.width / 2, 720);
      ctx.fillText('2. Layar HP akan langsung membuka data khusus unit mobil ini.', canvas.width / 2, 742);
      ctx.fillText('3. Simpan halaman atau bookmark di layar utama HP Anda.', canvas.width / 2, 764);

      // 6. Direct URL in small footer
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(18, 790, canvas.width - 36, 45);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';

      // Truncate URL if too long
      const displayUrl = url.length > 60 ? url.substring(0, 58) + '...' : url;
      ctx.fillText(`Link: ${displayUrl}`, canvas.width / 2, 818);
    };
    img.src = qrImageSrc;
  };

  if (!isOpen || !truck) return null;

  const directUrl = getDriverPortalUrl(truck);
  const waUrl = getWhatsAppShareUrl(truck, directUrl);

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(directUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQr = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const cleanCode = truck.code.replace(/[^a-zA-Z0-9]/g, '_');
      const cleanPlate = truck.plateNumber.replace(/[^a-zA-Z0-9]/g, '');
      const fileName = `QR_Supir_${cleanCode}_${cleanPlate}.png`;

      const downloadLink = document.createElement('a');
      downloadLink.href = dataUrl;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error('Failed to download QR code image:', err);
      // Fallback: download direct QR image
      if (qrDataUrl) {
        const fallbackLink = document.createElement('a');
        fallbackLink.href = qrDataUrl;
        fallbackLink.download = `QR_${truck.code.replace(/\s+/g, '_')}.png`;
        fallbackLink.click();
      }
    }
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      handleDownloadQr();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code Supir - ${truck.code} (${truck.plateNumber})</title>
          <style>
            @page { size: auto; margin: 15mm; }
            body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
            img { max-width: 90%; max-height: 90vh; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="QR Code Supir ${truck.code}" />
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>QR Code Link Supir</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30">
                  {truck.code}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Scan langsung untuk membuka portal khusus {truck.driverName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Unit identity card banner */}
          <div className="bg-gradient-to-r from-emerald-950/60 to-slate-800/60 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-sm sm:text-base">{truck.code}</span>
                  <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/40">
                    {truck.plateNumber}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Supir: <strong>{truck.driverName}</strong></span>
                  {truck.phone && <span className="text-slate-400">({truck.phone})</span>}
                </div>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
                Hak Akses
              </span>
              <span className="text-xs text-slate-200">Khusus Unit Ini</span>
            </div>
          </div>

          {/* QR Code Presentation Box */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center border-2 border-emerald-500 shadow-xl relative group">
            {isGenerating ? (
              <div className="py-20 flex flex-col items-center gap-3 text-slate-700">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold">Membuat QR Code...</span>
              </div>
            ) : qrDataUrl ? (
              <>
                <div className="relative">
                  <img
                    src={qrDataUrl}
                    alt={`QR Code Supir ${truck.code}`}
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-lg"
                  />
                  {/* Badge logo overlay in center */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-1.5 rounded-lg shadow-md border border-emerald-500">
                    <img
                      src="/assets/aistudio/images_70037338.jpeg"
                      alt="Traksi KPU"
                      className="h-7 w-auto object-contain"
                    />
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Arahkan Kamera HP ke QR Code</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                    Bisa ditempel di dasbor atau pintu truk agar supir mudah mengecek catatan operasional setiap saat.
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {/* Hidden Canvas used for high-res composite download */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Action Buttons: Download QR & Cetak */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={handleDownloadQr}
              className="py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>Download QR Code (PNG)</span>
            </button>

            <button
              onClick={handlePrint}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm border border-slate-700 transition flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Cetak / Print Sticker</span>
            </button>
          </div>

          {/* Direct Link Section */}
          <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Alamat Link Khusus:
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Tersambung langsung</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={directUrl}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-2 text-xs font-mono text-emerald-300 flex-1 truncate select-all outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1.5 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" />
                Kirim via WhatsApp
              </a>

              {onOpenDriverPortal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenDriverPortal(truck.id);
                  }}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  Buka Portal
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Terisolasi aman: hanya data {truck.code} yang ditampilkan</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
