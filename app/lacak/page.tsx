"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LacakPesanan() {
  const [invoiceId, setInvoiceId] = useState("");
  const [trackingData, setTrackingData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCariPesanan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceId) return;

    setIsLoading(true);
    setErrorMsg("");
    setTrackingData(null);

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          invoice_id, total_harga, payment_status, laundry_status, created_at, diskon,
          customers (nama, no_wa),
          order_items (qty, subtotal, services (nama_layanan, satuan))
        `)
        .ilike('invoice_id', `%${invoiceId}%`) 
        .maybeSingle();

      // --- PERBAIKAN ERROR HANDLING DI SINI ---
      // Kita tangkap error-nya secara halus tanpa "throw error" yang bikin Next.js crash
      if (error) {
        console.error("Supabase Error:", error);
        setErrorMsg("Pesanan tidak ditemukan atau koneksi terputus.");
        setIsLoading(false);
        return;
      }

      if (!data) {
        setErrorMsg("Pesanan tidak ditemukan. Pastikan Nomor Nota sudah benar (Contoh: INV-1234).");
      } else {
        setTrackingData(data);
      }
    } catch (err: any) {
      console.error("Catch Error:", err);
      setErrorMsg("Terjadi kesalahan sistem saat mencari data.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatRp = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center p-4 sm:p-8 font-sans">
      
      {/* Header Publik */}
      <div className="text-center mt-8 mb-8">
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Laundry<span className="text-indigo-600">Flow</span></h1>
        <p className="text-stone-500 text-sm mt-2">Lacak status cucian Anda secara real-time</p>
      </div>

      {/* Kotak Pencarian */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border border-stone-200 w-full max-w-md">
        <form onSubmit={handleCariPesanan} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase block mb-2">Nomor Nota (Invoice)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-stone-400">
                <span className="material-icons-outlined text-lg">receipt_long</span>
              </span>
              <input 
                type="text" 
                value={invoiceId} 
                onChange={(e) => setInvoiceId(e.target.value)} 
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-11 pr-4 py-3.5 text-sm outline-none font-bold uppercase tracking-wider focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" 
                placeholder="Contoh: INV-1234" 
                required 
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isLoading || !invoiceId} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {isLoading ? "Mencari..." : <><span className="material-icons-outlined text-[18px]">search</span> Cek Status Cucian</>}
          </button>
        </form>

        {errorMsg && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl text-center font-medium">
            {errorMsg}
          </div>
        )}

        {/* Hasil Pelacakan */}
        {trackingData && (
          <div className="mt-8 pt-8 border-t border-stone-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Pelanggan</p>
                <p className="text-lg font-black text-stone-800">{trackingData.customers?.nama}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Tanggal</p>
                <p className="text-sm font-bold text-stone-700">{new Date(trackingData.created_at).toLocaleDateString('id-ID')}</p>
              </div>
            </div>

            {/* Stepper Status (Animasi Progress Bar) */}
            <div className="relative mb-8 mt-4">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-stone-100 -translate-y-1/2 rounded-full z-0"></div>
              
              {/* Garis Progress */}
              <div className={`absolute top-1/2 left-0 h-1 bg-indigo-600 -translate-y-1/2 rounded-full z-0 transition-all duration-1000
                ${trackingData.laundry_status === 'Antrean' ? 'w-0' : 
                  trackingData.laundry_status === 'Proses' ? 'w-1/2' : 'w-full'}`}
              ></div>

              <div className="relative z-10 flex justify-between">
                {/* Step 1: Antrean */}
                <div className="flex flex-col items-center bg-white px-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-500 ${trackingData.laundry_status === 'Antrean' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-indigo-600 border-indigo-600 text-white'}`}>1</div>
                  <span className="text-[10px] font-bold mt-2 text-stone-600">Antrean</span>
                </div>
                {/* Step 2: Proses */}
                <div className="flex flex-col items-center bg-white px-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-500 ${trackingData.laundry_status === 'Proses' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : trackingData.laundry_status === 'Selesai' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-stone-200 text-stone-400'}`}>2</div>
                  <span className={`text-[10px] font-bold mt-2 ${trackingData.laundry_status === 'Proses' || trackingData.laundry_status === 'Selesai' ? 'text-stone-600' : 'text-stone-400'}`}>Dicuci</span>
                </div>
                {/* Step 3: Selesai */}
                <div className="flex flex-col items-center bg-white px-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-500 ${trackingData.laundry_status === 'Selesai' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200 scale-110' : 'bg-white border-stone-200 text-stone-400'}`}><span className="material-icons-outlined text-[16px]">done</span></div>
                  <span className={`text-[10px] font-bold mt-2 ${trackingData.laundry_status === 'Selesai' ? 'text-emerald-600' : 'text-stone-400'}`}>Selesai</span>
                </div>
              </div>
            </div>

            {trackingData.laundry_status === 'Selesai' && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-center mb-6">
                <p className="text-sm font-bold">Yeay! Cucian Anda sudah siap diambil.</p>
              </div>
            )}

            {/* Rincian Pesanan */}
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-3">Rincian Layanan</p>
              {trackingData.order_items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center mb-2">
                  <div>
                    <p className="text-sm font-bold text-stone-800">{item.services?.nama_layanan}</p>
                    <p className="text-xs text-stone-500">{item.qty} {item.services?.satuan}</p>
                  </div>
                  <p className="text-sm font-bold text-stone-800">{formatRp(item.subtotal)}</p>
                </div>
              ))}
              
              {trackingData.diskon > 0 && (
                <div className="flex justify-between items-center mb-2 mt-2 pt-2 border-t border-stone-200/50">
                  <p className="text-sm font-bold text-pink-600">Diskon Promo</p>
                  <p className="text-sm font-bold text-pink-600">-{formatRp(trackingData.diskon)}</p>
                </div>
              )}

              <div className="flex justify-between items-center mt-4 pt-3 border-t border-stone-200">
                <p className="text-sm font-black text-stone-800">Total Tagihan</p>
                <div className="text-right">
                  <p className="text-lg font-black text-indigo-600">{formatRp(trackingData.total_harga)}</p>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${trackingData.payment_status === 'Lunas' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {trackingData.payment_status}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      <div className="mt-8 text-center text-xs text-stone-400 font-medium">
        &copy; {new Date().getFullYear()} LaundryFlow. Sistem Informasi Manajemen Laundry.
      </div>
    </div>
  );
}