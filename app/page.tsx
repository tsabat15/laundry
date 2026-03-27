"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase"; 
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

const TARGET_LOYALTI = 5; 

export default function SmartLaundryLengkap() {
  const [isMounted, setIsMounted] = useState(false);
  const [currentView, setCurrentView] = useState("kasir"); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // BARU: State untuk pop-up menu HP
  
  // --- STATE AUTHENTICATION (LOGIN) ---
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("kasir");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- STATE DATA DATABASE ---
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  
  // State Form Kasir 
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [qty, setQty] = useState<number | "">("");
  const [discount, setDiscount] = useState<number | "">(""); 
  const [isPaid, setIsPaid] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // State Form Buku Kas & Layanan
  const [newExpDesc, setNewExpDesc] = useState("");
  const [newExpAmount, setNewExpAmount] = useState<number | "">("");
  const [newSvcName, setNewSvcName] = useState("");
  const [newSvcPrice, setNewSvcPrice] = useState("");
  const [newSvcUnit, setNewSvcUnit] = useState("Kg");

  // State Broadcast & Fonnte
  const [fonnteToken, setFonnteToken] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("Halo Kak [Nama],\n\nAda promo spesial nih dari LaundryFlow. Diskon 10% untuk cuci bedcover minggu ini!\n\nDitunggu kedatangannya ya!");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // State Form Inventori 
  const [invName, setInvName] = useState("");
  const [invStock, setInvStock] = useState<number | "">("");
  const [invUnit, setInvUnit] = useState("Liter");
  const [invMin, setInvMin] = useState<number | "">(5);

  // --- CEK SESI LOGIN & TARIK DATA ---
  useEffect(() => {
    setIsMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserDataAndApp(session.user.email);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserDataAndApp(session.user.email);
    });
    
    // Ambil Token Fonnte yang tersimpan di browser
    const savedToken = localStorage.getItem("fonnteToken");
    if (savedToken) setFonnteToken(savedToken);

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserDataAndApp = async (email: string | undefined) => {
    if (!email) return;
    const { data: userData } = await supabase.from('users').select('role').eq('email', email).maybeSingle();
    if (userData) setUserRole(userData.role);
    fetchData();
  };

  const fetchData = async () => {
    const { data: svcData } = await supabase.from('services').select('*').eq('is_active', true).order('created_at', { ascending: true });
    if (svcData) { setServices(svcData); setSelectedService(prev => prev || (svcData.length > 0 ? svcData[0] : null)); }
    const { data: custData } = await supabase.from('customers').select('*').order('nama', { ascending: true });
    if (custData) setCustomers(custData);
    const { data: orderData } = await supabase.from('orders')
      .select(`*, customers(nama, no_wa), order_items(qty, subtotal, services(nama_layanan, satuan))`)
      .order('created_at', { ascending: false });
    if (orderData) setOrders(orderData);
    const { data: expData } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (expData) setExpenses(expData);
    
    // Fetch Inventori
    const { data: invData } = await supabase.from('inventory').select('*').order('nama_barang', { ascending: true });
    if (invData) setInventory(invData);
  };

  // --- FUNGSI LOGIN & LOGOUT ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoggingIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) alert("Login Gagal: Email atau Password salah.");
    setIsLoggingIn(false);
  };
  const handleLogout = async () => { await supabase.auth.signOut(); setCurrentView('kasir'); };

  // --- LOGIKA KASIR ---
  const filteredCustomers = customerName ? customers.filter(c => c.nama.toLowerCase().includes(customerName.toLowerCase())).slice(0, 5) : [];
  const handleSelectSuggestedCustomer = (nama: string, phone: string) => { setCustomerName(nama); setCustomerPhone(phone); setShowSuggestions(false); };
  const activeCustomer = customers.find(c => c.no_wa === customerPhone);
  const visitNumber = (activeCustomer?.total_kunjungan || 0) + 1;
  const isEligibleForDiscount = visitNumber % TARGET_LOYALTI === 0;
  const totalKotor = (Number(qty) || 0) * (selectedService?.harga || 0);
  const diskonRp = Number(discount) || 0;
  const totalHarga = Math.max(0, totalKotor - diskonRp);

  const handleSimpanPesanan = async (shouldPrint: boolean) => {
    if (!customerName || !qty || !selectedService) return alert("Data belum lengkap!");
    setIsSaving(true);
    try {
      let customerId;
      const { data: existingCust } = await supabase.from('customers').select('*').eq('no_wa', customerPhone).maybeSingle();
      if (existingCust) {
        customerId = existingCust.id;
        await supabase.from('customers').update({ total_kunjungan: existingCust.total_kunjungan + 1 }).eq('id', customerId);
      } else {
        const { data: newCust, error } = await supabase.from('customers').insert([{ nama: customerName, no_wa: customerPhone, total_kunjungan: 1 }]).select().single();
        if (error) throw error; customerId = newCust.id;
      }

      const invoiceId = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: newOrder, error: orderErr } = await supabase.from('orders').insert([{
        invoice_id: invoiceId, customer_id: customerId, total_harga: totalHarga, diskon: diskonRp, payment_status: isPaid ? "Lunas" : "Belum Bayar", laundry_status: "Antrean"
      }]).select().single();
      if (orderErr) throw orderErr;

      const { error: itemErr } = await supabase.from('order_items').insert([{ order_id: newOrder.id, service_id: selectedService.id, qty: Number(qty), subtotal: totalKotor }]);
      if (itemErr) throw itemErr;

      await fetchData();
      if (shouldPrint) alert(`Struk ${invoiceId} siap dicetak! (Pop-up print aktif)`);
      setCustomerName(""); setCustomerPhone(""); setQty(""); setDiscount(""); setIsPaid(true);
    } catch (error) { console.error(error); alert("Gagal menyimpan pesanan."); } finally { setIsSaving(false); }
  };

  const updateStatus = async (id: string, newStatus: string) => { 
    await supabase.from('orders').update({ laundry_status: newStatus }).eq('id', id); 
    
    if (newStatus === "Selesai" && fonnteToken) {
      const order = orders.find(o => o.id === id);
      if (order && order.customers?.no_wa) {
        const phone = order.customers.no_wa;
        const name = order.customers.nama;
        const invoice = order.invoice_id;
        const total = formatRp(order.total_harga);
        
        const message = `Halo Kak *${name}*,\n\nCucian kamu dengan nota *${invoice}* sudah selesai dan siap diambil di LaundryFlow!\n\nTotal tagihan: *${total}*.\n\nTerima kasih telah mempercayakan cucianmu pada kami. ✨`;
        
        try {
          const formdata = new FormData();
          formdata.append("target", phone);
          formdata.append("message", message);
          formdata.append("countryCode", "62");

          await fetch("https://api.fonnte.com/send", { method: "POST", headers: { "Authorization": fonnteToken }, body: formdata });
          alert(`Berhasil: Notifikasi WA otomatis terkirim ke ${name} (${phone})`);
        } catch (error) {
          console.error("Gagal mengirim WA:", error);
        }
      }
    }
    fetchData(); 
  };
  
  const markAsPaid = async (id: string) => { await supabase.from('orders').update({ payment_status: 'Lunas' }).eq('id', id); fetchData(); };

  // --- LOGIKA INVENTORI ---
  const handleAddInventory = async () => {
    if (!invName || invStock === "") return alert("Nama barang dan stok awal wajib diisi!");
    await supabase.from('inventory').insert([{ nama_barang: invName, stok: Number(invStock), satuan: invUnit, batas_minimum: Number(invMin) }]);
    setInvName(""); setInvStock(""); setInvMin(5); fetchData();
  };
  
  const handleUpdateStock = async (id: string, currentStock: number, amount: number) => {
    const newStock = Math.max(0, currentStock + amount); // Stok tidak boleh minus
    await supabase.from('inventory').update({ stok: newStock }).eq('id', id);
    fetchData();
  };

  const handleDeleteInventory = async (id: string) => {
    if (window.confirm("Hapus barang ini dari gudang?")) { await supabase.from('inventory').delete().eq('id', id); fetchData(); }
  };

  // --- LOGIKA BROADCAST MANUAL ---
  const saveToken = (val: string) => { setFonnteToken(val); localStorage.setItem("fonnteToken", val); };
  
  const handleBroadcast = async () => {
    if (!fonnteToken) return alert("Masukkan Token API Fonnte terlebih dahulu!");
    if (customers.length === 0) return alert("Belum ada data pelanggan.");
    
    setIsBroadcasting(true);
    let successCount = 0;

    for (const customer of customers) {
      if (!customer.no_wa) continue;
      const personalizedMsg = broadcastMsg.replace("[Nama]", customer.nama);
      
      try {
        const formdata = new FormData();
        formdata.append("target", customer.no_wa); formdata.append("message", personalizedMsg); formdata.append("countryCode", "62");
        await fetch("https://api.fonnte.com/send", { method: "POST", headers: { "Authorization": fonnteToken }, body: formdata });
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error("Gagal mengirim ke:", customer.no_wa);
      }
    }
    setIsBroadcasting(false);
    alert(`Broadcast Selesai! Berhasil mengirim ke ${successCount} pelanggan.`);
  };

  // --- LOGIKA LAINNYA ---
  const handleAddExpense = async () => {
    if (!newExpDesc || !newExpAmount) return alert("Keterangan dan nominal wajib diisi!");
    await supabase.from('expenses').insert([{ keterangan: newExpDesc, nominal: Number(newExpAmount) }]);
    setNewExpDesc(""); setNewExpAmount(""); fetchData();
  };
  const handleDeleteExpense = async (id: string) => { if (window.confirm("Hapus catatan ini?")) { await supabase.from('expenses').delete().eq('id', id); fetchData(); }};
  const handleAddService = async () => {
    if (!newSvcName || !newSvcPrice) return; await supabase.from('services').insert([{ nama_layanan: newSvcName, harga: Number(newSvcPrice), satuan: newSvcUnit }]);
    setNewSvcName(""); setNewSvcPrice(""); fetchData();
  };
  const handleDeleteService = async (id: string) => { if (window.confirm("Hapus layanan ini?")) { await supabase.from('services').delete().eq('id', id); fetchData(); }};

  const totalOmzetKeseluruhan = orders.filter(o => o.payment_status === "Lunas").reduce((sum, o) => sum + (Number(o.total_harga) || 0), 0);
  const totalPengeluaranKeseluruhan = expenses.reduce((sum, e) => sum + (Number(e.nominal) || 0), 0);
  const labaBersih = totalOmzetKeseluruhan - totalPengeluaranKeseluruhan;

  const getFinancialData = () => {
    const data = []; const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dateKey = d.toLocaleDateString("en-CA"); 
      const shortLabel = d.toLocaleDateString("id-ID", { day: 'numeric', month: 'short' }); 
      const omzetHariIni = orders.filter(o => o.created_at.startsWith(dateKey) && o.payment_status === "Lunas").reduce((sum, o) => sum + (o.total_harga || 0), 0);
      const pengeluaranHariIni = expenses.filter(e => e.created_at.startsWith(dateKey)).reduce((sum, e) => sum + (e.nominal || 0), 0);
      data.push({ name: shortLabel, Omzet: omzetHariIni, Pengeluaran: pengeluaranHariIni });
    }
    return data;
  };
  const financialData = getFinancialData();
  const formatRp = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  // BARU: Helper ganti menu dan tutup opsi tambahan (untuk HP)
  const changeMenuMobile = (menu: string) => { 
    setCurrentView(menu); 
    setIsMobileMenuOpen(false); 
  };

  if (!isMounted) return null;

  // ==========================================
  // VIEW: LAYAR LOGIN
  // ==========================================
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-stone-200">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black tracking-tight text-stone-900">Laundry<span className="text-indigo-600">Flow</span></h1>
            <p className="text-stone-500 text-sm mt-2">Masuk untuk mengelola pesanan.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div><label className="text-xs font-bold text-stone-500 uppercase">Email Pegawai</label><input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required className="w-full mt-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none" placeholder="nama@laundry.com" /></div>
            <div><label className="text-xs font-bold text-stone-500 uppercase">Password</label><input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} required className="w-full mt-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none" placeholder="••••••••" /></div>
            <button type="submit" disabled={isLoggingIn} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg mt-4">{isLoggingIn ? "Memeriksa..." : "Masuk ke Sistem"}</button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: DASHBOARD UTAMA
  // ==========================================
  return (
    <div className="flex h-screen bg-[#fafafa] text-stone-800 font-sans overflow-hidden">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col hidden md:flex z-10">
        <div className="p-6 border-b border-stone-100">
          <h1 className="text-2xl font-black tracking-tight text-stone-900">Laundry<span className="text-indigo-600">Flow</span></h1>
          <div className="mt-2 text-[10px] font-bold inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 uppercase tracking-wider">Role: {userRole}</div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => setCurrentView('kasir')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${currentView === 'kasir' ? 'bg-indigo-50 text-indigo-600' : 'text-stone-500 hover:bg-stone-50'}`}><span className="material-icons-outlined text-lg">point_of_sale</span> Kasir & Antrean</button>
          
          {userRole === 'owner' && (
            <>
              <button onClick={() => setCurrentView('inventori')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${currentView === 'inventori' ? 'bg-indigo-50 text-indigo-600' : 'text-stone-500 hover:bg-stone-50'}`}><span className="material-icons-outlined text-lg">inventory_2</span> Gudang & Stok</button>
              <button onClick={() => setCurrentView('buku_kas')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${currentView === 'buku_kas' ? 'bg-indigo-50 text-indigo-600' : 'text-stone-500 hover:bg-stone-50'}`}><span className="material-icons-outlined text-lg">account_balance_wallet</span> Buku Kas</button>
              <button onClick={() => setCurrentView('analitik')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${currentView === 'analitik' ? 'bg-indigo-50 text-indigo-600' : 'text-stone-500 hover:bg-stone-50'}`}><span className="material-icons-outlined text-lg">insights</span> Analitik Keuangan</button>
              <button onClick={() => setCurrentView('broadcast')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${currentView === 'broadcast' ? 'bg-indigo-50 text-indigo-600' : 'text-stone-500 hover:bg-stone-50'}`}><span className="material-icons-outlined text-lg">campaign</span> WA Broadcast</button>
              <button onClick={() => setCurrentView('pengaturan')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${currentView === 'pengaturan' ? 'bg-indigo-50 text-indigo-600' : 'text-stone-500 hover:bg-stone-50'}`}><span className="material-icons-outlined text-lg">tune</span> Pengaturan Toko</button>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-stone-100"><button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-red-600 hover:bg-red-50 text-xs"><span className="material-icons-outlined text-[16px]">logout</span> Keluar Akun</button></div>
      </aside>

      {/* MAIN CONTENT (BARU: w-full & pb-28 untuk spasi menu HP) */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-28 md:pb-8 scroll-smooth w-full">
        
        {/* HEADER MOBILE (Hanya tampil di HP) */}
        <header className="mb-6 flex justify-between items-center md:hidden">
            <h2 className="text-xl font-black tracking-tight text-stone-900">Laundry<span className="text-indigo-600">Flow</span></h2>
            <button onClick={handleLogout} className="flex items-center gap-1 text-red-500 text-[10px] uppercase tracking-wider font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">Keluar</button>
        </header>

        {/* JUDUL HALAMAN AKTIF (Desktop) */}
        <h2 className="text-2xl font-bold tracking-tight text-stone-900 mb-4 hidden md:block">
          {currentView === 'kasir' ? 'Dasbor Kasir' : currentView === 'inventori' ? 'Manajemen Stok Barang' : currentView === 'buku_kas' ? 'Buku Kas & Pengeluaran' : currentView === 'analitik' ? 'Laporan Laba Bersih' : currentView === 'broadcast' ? 'Integrasi WhatsApp' : 'Pengaturan Toko'}
        </h2>

        {/* --- VIEW 1: KASIR --- */}
        {currentView === 'kasir' && (
           <div className="flex flex-col-reverse lg:flex-row gap-6 w-full">
           {/* Tabel Antrean */}
           <div className="w-full lg:w-2/3 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
             <div className="overflow-x-auto w-full">
               <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                 <thead className="bg-stone-50 border-b border-stone-100">
                   <tr>
                     <th className="px-4 py-3 font-bold text-stone-500 text-[11px] uppercase tracking-wider">Pelanggan</th>
                     <th className="px-4 py-3 font-bold text-stone-500 text-[11px] uppercase tracking-wider">Layanan</th>
                     <th className="px-4 py-3 font-bold text-stone-500 text-[11px] uppercase tracking-wider text-center">Tagihan</th>
                     <th className="px-4 py-3 font-bold text-stone-500 text-[11px] uppercase tracking-wider text-center">Status Cucian</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-stone-100">
                   {orders.length === 0 ? (
                     <tr><td colSpan={4} className="px-4 py-10 text-center text-stone-400">Belum ada antrean.</td></tr>
                   ) : (
                     orders.map((order) => {
                       const itemDetail = order.order_items?.[0]; 
                       const svcName = itemDetail?.services?.nama_layanan || '-';
                       const unit = itemDetail?.services?.satuan || '';
                       const qtyStr = itemDetail?.qty || 0;

                       return (
                       <tr key={order.id} className="hover:bg-stone-50/50 transition-colors">
                         <td className="px-4 py-3">
                           <div className="font-bold text-stone-800">{order.customers?.nama || 'Unknown'}</div>
                           <div className="text-[10px] text-stone-400 mt-0.5">{order.invoice_id}</div>
                         </td>
                         <td className="px-4 py-3">
                           <div className="text-stone-700 font-medium text-xs md:text-sm">{svcName}</div>
                           <div className="text-[10px] text-stone-400">
                             {qtyStr} {unit} {order.diskon > 0 && <span className="text-pink-500 font-bold ml-1">(Diskon)</span>}
                           </div>
                         </td>
                         <td className="px-4 py-3 text-center">
                           <div className="font-bold text-stone-800 text-xs md:text-sm">{formatRp(order.total_harga)}</div>
                           {order.payment_status === "Lunas" ? (
                             <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold">LUNAS</span>
                           ) : (
                             <button onClick={() => markAsPaid(order.id)} className="inline-block mt-1 px-2 py-0.5 bg-red-50 hover:bg-red-500 hover:text-white text-red-600 rounded text-[9px] font-bold transition-colors">BELUM BAYAR</button>
                           )}
                         </td>
                         <td className="px-4 py-3 text-center">
                           <select value={order.laundry_status} onChange={(e) => updateStatus(order.id, e.target.value)}
                             className={`text-[10px] md:text-xs font-bold px-2 py-1.5 rounded-full border outline-none cursor-pointer text-center appearance-none w-full
                               ${order.laundry_status === 'Antrean' ? 'bg-stone-100 text-stone-600 border-stone-200' : 
                                 order.laundry_status === 'Proses' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 
                                 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}
                           >
                             <option value="Antrean">Baru</option>
                             <option value="Proses">Dicuci</option>
                             <option value="Selesai">Diambil (Kirim WA)</option>
                           </select>
                         </td>
                       </tr>
                     )})
                   )}
                 </tbody>
               </table>
             </div>
           </div>

           {/* Form Kasir */}
           <div className="w-full lg:w-1/3">
             <div className="bg-white p-5 md:p-6 rounded-2xl border border-stone-200 shadow-sm lg:sticky lg:top-0 w-full">
               <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><span className="material-icons-outlined text-indigo-500">add_circle</span> Pesanan Baru</h3>
               <div className="space-y-4">
                 <div className="space-y-2 relative">
                   <input value={customerName} onChange={(e) => { setCustomerName(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} type="text" className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="Nama Pelanggan" />
                   {showSuggestions && filteredCustomers.length > 0 && (
                     <div className="absolute z-50 w-full bg-white border border-stone-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto top-[42px]">
                       {filteredCustomers.map((c, i) => (
                         <div key={i} onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestedCustomer(c.nama, c.no_wa); }} className="p-3 border-b border-stone-50 hover:bg-indigo-50 cursor-pointer flex justify-between items-center group">
                           <div className="flex flex-col"><span className="text-sm font-bold text-stone-800">{c.nama}</span><span className="text-[10px] text-stone-400">{c.no_wa}</span></div>
                         </div>
                       ))}
                     </div>
                   )}
                   <input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} type="tel" className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="No. WA (Misal: 0812...)" />
                 </div>

                 {customerPhone.length > 5 && (
                   <div className={`p-3 rounded-xl border transition-all ${isEligibleForDiscount ? 'bg-amber-50 border-amber-200 text-amber-800 shadow-sm' : 'bg-indigo-50/50 border-indigo-100 text-indigo-700'}`}>
                     <div className="flex justify-between items-center">
                       <div><p className="text-[9px] font-bold uppercase opacity-80">Status Loyalti</p><p className="text-sm font-black mt-0.5">Kunjungan ke-{visitNumber}</p></div>
                       {isEligibleForDiscount && <span className="material-icons-outlined text-amber-500 text-3xl animate-bounce">redeem</span>}
                     </div>
                     {isEligibleForDiscount ? <p className="text-xs font-bold mt-1.5 text-amber-600">🎉 Saatnya dapat promo!</p> : <p className="text-[10px] mt-1 opacity-70">Kurang {TARGET_LOYALTI - (visitNumber % TARGET_LOYALTI)} kunjungan lagi untuk promo.</p>}
                   </div>
                 )}

                 {services.length === 0 ? (
                   <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-center"><p className="text-xs text-stone-500 font-medium">Belum ada layanan.<br/>Hubungi Owner.</p></div>
                 ) : (
                   <div className="grid grid-cols-1 gap-2">
                     {services.map(svc => (
                       <button key={svc.id} onClick={() => setSelectedService(svc)} className={`flex justify-between items-center p-2.5 rounded-xl border text-sm transition-all ${selectedService?.id === svc.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold' : 'border-stone-200 bg-white text-stone-600'}`}>
                         <span>{svc.nama_layanan}</span><span className="text-[10px]">{formatRp(svc.harga)}/{svc.satuan}</span>
                       </button>
                     ))}
                   </div>
                 )}

                 <div className="flex gap-3">
                   <div className="w-1/2">
                     <input value={qty} onChange={e=>setQty(parseFloat(e.target.value) || "")} type="number" className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-center font-bold outline-none" placeholder={`Qty (${selectedService?.satuan || '-'})`} disabled={!selectedService} />
                   </div>
                   <div className="w-1/2">
                     <button onClick={() => setIsPaid(!isPaid)} className={`w-full h-full rounded-xl text-xs font-bold border ${isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>{isPaid ? "LUNAS" : "HUTANG"}</button>
                   </div>
                 </div>
                 <div><input value={discount} onChange={e=>setDiscount(parseFloat(e.target.value) || "")} type="number" className="w-full bg-pink-50 border border-pink-200 rounded-xl px-4 py-2.5 text-sm font-bold text-pink-600 outline-none" placeholder="Potongan Diskon (Rp)" /></div>
                 <div className="pt-3 border-t border-stone-100">
                   <div className="flex justify-between items-end mb-4">
                     <span className="text-xs font-bold text-stone-800">Total Akhir</span><span className="text-2xl font-black text-indigo-600">{formatRp(totalHarga)}</span>
                   </div>
                   <div className="flex gap-2 w-full">
                     <button onClick={() => handleSimpanPesanan(false)} disabled={isSaving || !customerName || !qty || !selectedService} className="flex-1 bg-white border border-stone-300 text-stone-700 font-bold py-3.5 rounded-xl text-xs disabled:opacity-50">{isSaving ? "Tunggu..." : "Simpan Saja"}</button>
                     <button onClick={() => handleSimpanPesanan(true)} disabled={isSaving || !customerName || !qty || !selectedService} className="flex-[2] bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg flex justify-center gap-2 text-sm disabled:opacity-50"><span className="material-icons-outlined text-[18px]">print</span> {isSaving ? "Menyimpan..." : "Cetak & Simpan"}</button>
                   </div>
                 </div>
               </div>
             </div>
           </div>
         </div>
        )}

        {/* ========================================== */}
        {/* VIEW: OWNER ONLY */}
        {/* ========================================== */}

        {/* VIEW BARU: MANAJEMEN STOK (INVENTORI) */}
        {currentView === 'inventori' && userRole === 'owner' && (
          <div className="flex flex-col lg:flex-row gap-6 w-full">
            <div className="w-full lg:w-1/3">
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm lg:sticky lg:top-0 w-full">
                <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4"><span className="material-icons-outlined text-indigo-500">add_box</span> Tambah Barang</h3>
                <div className="space-y-4">
                  <div><label className="text-[10px] font-bold text-stone-500 uppercase block mb-1.5">Nama Barang (Contoh: Deterjen Cair)</label><input type="text" value={invName} onChange={e=>setInvName(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none" /></div>
                  <div className="flex gap-3">
                    <div className="w-1/2"><label className="text-[10px] font-bold text-stone-500 uppercase block mb-1.5">Stok Awal</label><input type="number" value={invStock} onChange={e=>setInvStock(parseFloat(e.target.value) || "")} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none" /></div>
                    <div className="w-1/2">
                      <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1.5">Satuan</label>
                      <select value={invUnit} onChange={e=>setInvUnit(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none">
                        <option value="Liter">Liter</option><option value="Kg">Kg</option><option value="Pcs">Pcs</option><option value="Botol">Botol</option>
                      </select>
                    </div>
                  </div>
                  <div><label className="text-[10px] font-bold text-stone-500 uppercase block mb-1.5">Peringatan Menipis (Batas Minimum)</label><input type="number" value={invMin} onChange={e=>setInvMin(parseFloat(e.target.value) || "")} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none" /></div>
                  <button onClick={handleAddInventory} disabled={!invName || invStock === ""} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2 text-sm disabled:opacity-50">Simpan Barang ke Gudang</button>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-2/3">
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm w-full">
                <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4"><span className="material-icons-outlined text-stone-500">inventory_2</span> Kondisi Gudang Saat Ini</h3>
                {inventory.length === 0 ? (
                  <div className="text-center py-10 bg-stone-50 rounded-xl border border-dashed border-stone-300"><p className="text-sm font-medium text-stone-500">Gudang masih kosong. Tambahkan barang di sebelah kiri.</p></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inventory.map((item) => {
                      const isLowStock = item.stok <= item.batas_minimum;
                      return (
                      <div key={item.id} className={`p-4 rounded-xl border transition-all ${isLowStock ? 'bg-rose-50 border-rose-200' : 'bg-stone-50 border-stone-200'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-bold text-stone-800 text-sm">{item.nama_barang}</p>
                            {isLowStock ? <span className="inline-block mt-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-bold">STOK MENIPIS! (Min: {item.batas_minimum})</span> 
                                        : <span className="inline-block mt-1 px-2 py-0.5 bg-stone-200 text-stone-500 rounded text-[9px] font-bold">Batas aman: {item.batas_minimum}</span>}
                          </div>
                          <button onClick={() => handleDeleteInventory(item.id)} className="text-stone-300 hover:text-red-500"><span className="material-icons-outlined text-[16px]">delete</span></button>
                        </div>
                        
                        <div className="flex justify-between items-end border-t border-stone-200/60 pt-3">
                          <div className="flex items-baseline gap-1">
                            <span className={`text-3xl font-black ${isLowStock ? 'text-rose-600' : 'text-stone-800'}`}>{item.stok}</span>
                            <span className="text-xs font-bold text-stone-500 uppercase">{item.satuan}</span>
                          </div>
                          
                          {/* Tombol Update Stok Cepat */}
                          <div className="flex gap-1">
                            <button onClick={() => handleUpdateStock(item.id, item.stok, -1)} title="Kurangi 1" className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center hover:bg-stone-100 active:scale-95"><span className="material-icons-outlined text-stone-600 text-[18px]">remove</span></button>
                            <button onClick={() => handleUpdateStock(item.id, item.stok, 1)} title="Tambah 1" className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center hover:bg-stone-100 active:scale-95"><span className="material-icons-outlined text-stone-600 text-[18px]">add</span></button>
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: BUKU KAS */}
        {currentView === 'buku_kas' && userRole === 'owner' && (
          <div className="flex flex-col lg:flex-row gap-6 w-full">
            <div className="w-full lg:w-1/3">
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm w-full">
                <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4"><span className="material-icons-outlined text-rose-500">money_off</span> Catat Pengeluaran</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1.5">Untuk Keperluan Apa?</label>
                    <input type="text" value={newExpDesc} onChange={e=>setNewExpDesc(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1.5">Nominal (Rp)</label>
                    <input type="number" value={newExpAmount} onChange={e=>setNewExpAmount(parseFloat(e.target.value) || "")} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
                  </div>
                  <button onClick={handleAddExpense} disabled={!newExpDesc || !newExpAmount} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2 text-sm disabled:opacity-50">Simpan Pengeluaran</button>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-2/3">
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm w-full">
                <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4"><span className="material-icons-outlined text-stone-500">history</span> Riwayat Pengeluaran Toko</h3>
                {expenses.length === 0 ? (
                  <div className="text-center py-10 bg-stone-50 rounded-xl border border-dashed border-stone-300"><p className="text-sm font-medium text-stone-500">Belum ada catatan pengeluaran.</p></div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {expenses.map((exp) => (
                      <div key={exp.id} className="flex justify-between items-center p-4 bg-stone-50 border border-stone-200 rounded-xl">
                        <div>
                          <p className="font-bold text-stone-800 text-sm">{exp.keterangan}</p>
                          <p className="text-[10px] font-medium text-stone-400 mt-1">{new Date(exp.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-rose-600 text-sm">-{formatRp(exp.nominal)}</span>
                          <button onClick={() => handleDeleteExpense(exp.id)} className="w-8 h-8 flex items-center justify-center bg-white border border-stone-200 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><span className="material-icons-outlined text-[16px]">delete</span></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: ANALITIK */}
        {currentView === 'analitik' && userRole === 'owner' && (
          <div className="space-y-6 w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><span className="material-icons-outlined">payments</span></div><div><p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Total Omzet</p><h4 className="text-xl font-black text-stone-800 mt-1">{formatRp(totalOmzetKeseluruhan)}</h4></div></div>
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600"><span className="material-icons-outlined">trending_down</span></div><div><p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Total Pengeluaran</p><h4 className="text-xl font-black text-stone-800 mt-1">{formatRp(totalPengeluaranKeseluruhan)}</h4></div></div>
              <div className={`p-5 rounded-2xl border shadow-sm flex items-center gap-4 ${labaBersih >= 0 ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-rose-600 border-rose-700 text-white'}`}><div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center"><span className="material-icons-outlined">account_balance</span></div><div><p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Laba Bersih</p><h4 className="text-xl font-black mt-1">{formatRp(labaBersih)}</h4></div></div>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 md:p-6 w-full flex flex-col h-[400px]">
               <div className="flex justify-between items-center mb-6"><div><h3 className="font-bold text-lg text-stone-800 flex items-center gap-2">Arus Kas (Cash Flow)</h3><p className="text-xs text-stone-500">7 Hari Terakhir</p></div></div>
               <div className="w-full flex-1"> 
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={financialData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#78716c', fontSize: 11 }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fill: '#78716c', fontSize: 11 }} tickFormatter={(val) => `${val / 1000}k`} />
                     <Tooltip cursor={{ fill: '#fafaf9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => formatRp(Number(value) || 0)} />
                     <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                     <Bar dataKey="Omzet" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={20} />
                     <Bar dataKey="Pengeluaran" fill="#e11d48" radius={[4, 4, 0, 0]} barSize={20} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>
          </div>
        )}

        {/* VIEW 5: BROADCAST & FONNTE API */}
        {currentView === 'broadcast' && userRole === 'owner' && (
          <div className="flex flex-col lg:flex-row gap-6 w-full">
            <div className="w-full lg:w-1/3">
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm w-full">
                <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><span className="material-icons-outlined text-emerald-500">api</span> Kunci API Fonnte</h3>
                <p className="text-xs text-stone-500 mb-4 leading-relaxed">Masukkan Token API Fonnte untuk mengaktifkan fitur <b>Pesan Promosi Massal</b> dan <b>Notifikasi WA Otomatis</b> saat cucian pelanggan selesai.</p>
                <input type="password" value={fonnteToken} onChange={(e) => saveToken(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none" placeholder="Paste Token API di sini..." />
                <a href="https://md.fonnte.com/new/device.php" target="_blank" rel="noreferrer" className="block text-center text-[10px] font-bold text-indigo-600 mt-3 hover:underline">Dapatkan Token Fonnte Gratis &rarr;</a>
              </div>
            </div>

            <div className="w-full lg:w-2/3">
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm w-full">
                <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4"><span className="material-icons-outlined text-indigo-500">send</span> Broadcast Promosi</h3>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
                  <p className="text-sm text-indigo-800 font-medium">Pesan ini akan dikirim ke <b>{customers.length}</b> pelanggan yang ada di database.</p>
                </div>
                <div className="space-y-4">
                  <textarea value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} rows={5} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none resize-none leading-relaxed" placeholder="Ketik pesan promosi..."></textarea>
                  <p className="text-[10px] text-stone-400 font-bold">*Gunakan [Nama] untuk menyebut nama pelanggan secara otomatis.</p>
                  <button onClick={handleBroadcast} disabled={isBroadcasting || customers.length === 0} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2 text-sm disabled:opacity-50 transition-all flex justify-center items-center gap-2">
                    <span className="material-icons-outlined text-[18px]">rocket_launch</span> {isBroadcasting ? "Mengirim Pesan..." : "Mulai Broadcast Sekarang"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 6: PENGATURAN TOKO */}
        {currentView === 'pengaturan' && userRole === 'owner' && (
          <div className="flex flex-col lg:flex-row gap-6 w-full">
            <div className="w-full lg:w-1/3">
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm w-full">
                <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4"><span className="material-icons-outlined text-indigo-500">add_task</span> Tambah Layanan Baru</h3>
                <div className="space-y-4">
                  <div><label className="text-[10px] font-bold text-stone-500 uppercase block mb-1.5">Nama Layanan</label><input type="text" value={newSvcName} onChange={e=>setNewSvcName(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none" /></div>
                  <div><label className="text-[10px] font-bold text-stone-500 uppercase block mb-1.5">Harga (Rp)</label><input type="number" value={newSvcPrice} onChange={e=>setNewSvcPrice(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none" /></div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1.5">Satuan</label>
                    <select value={newSvcUnit} onChange={e=>setNewSvcUnit(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none">
                      <option value="Kg">Per Kilo (Kg)</option><option value="Pcs">Per Satuan (Pcs)</option>
                    </select>
                  </div>
                  <button onClick={handleAddService} disabled={!newSvcName || !newSvcPrice} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2 text-sm">Simpan Layanan</button>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-2/3">
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm w-full">
                <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4"><span className="material-icons-outlined text-stone-500">list_alt</span> Daftar Layanan</h3>
                {services.length === 0 ? (
                  <div className="text-center py-10 bg-stone-50 rounded-xl border border-dashed border-stone-300"><p className="text-sm font-medium text-stone-500">Belum ada layanan.</p></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {services.map((svc) => (
                      <div key={svc.id} className="flex justify-between items-center p-4 bg-stone-50 border border-stone-200 rounded-xl">
                        <div><p className="font-bold text-stone-800 text-sm">{svc.nama_layanan}</p><p className="text-[11px] font-medium text-stone-500 mt-0.5">{formatRp(svc.harga)} / {svc.satuan}</p></div>
                        <button onClick={() => handleDeleteService(svc.id)} className="w-8 h-8 flex items-center justify-center bg-white border border-stone-200 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><span className="material-icons-outlined text-[16px]">delete</span></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================== */}
      {/* MOBILE BOTTOM NAVIGATION BAR (KHUSUS HP) */}
      {/* ========================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-stone-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] flex justify-around items-center px-2 py-1.5 z-50">
        <button onClick={() => changeMenuMobile('kasir')} className={`flex flex-col items-center justify-center p-2 rounded-xl min-w-[64px] transition-all ${currentView === 'kasir' ? 'text-indigo-600' : 'text-stone-400 hover:text-stone-600'}`}>
          <span className="material-icons-outlined text-[24px]">point_of_sale</span>
          <span className="text-[9px] font-bold mt-1 tracking-wide">Kasir</span>
        </button>
        
        {userRole === 'owner' && (
          <>
            <button onClick={() => changeMenuMobile('inventori')} className={`flex flex-col items-center justify-center p-2 rounded-xl min-w-[64px] transition-all ${currentView === 'inventori' ? 'text-indigo-600' : 'text-stone-400 hover:text-stone-600'}`}>
              <span className="material-icons-outlined text-[24px]">inventory_2</span>
              <span className="text-[9px] font-bold mt-1 tracking-wide">Gudang</span>
            </button>
            
            <button onClick={() => changeMenuMobile('analitik')} className={`flex flex-col items-center justify-center p-2 rounded-xl min-w-[64px] transition-all ${currentView === 'analitik' ? 'text-indigo-600' : 'text-stone-400 hover:text-stone-600'}`}>
              <span className="material-icons-outlined text-[24px]">insights</span>
              <span className="text-[9px] font-bold mt-1 tracking-wide">Analitik</span>
            </button>

            {/* Menu Dropdown untuk fitur sisanya agar tidak penuh di HP */}
            <div className="relative">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className={`flex flex-col items-center justify-center p-2 rounded-xl min-w-[64px] transition-all ${isMobileMenuOpen ? 'text-indigo-600' : 'text-stone-400'}`}>
                <span className="material-icons-outlined text-[24px]">menu</span>
                <span className="text-[9px] font-bold mt-1 tracking-wide">Lainnya</span>
              </button>

              {/* Pop-up Menu Lainnya */}
              {isMobileMenuOpen && (
                <div className="absolute bottom-16 right-0 w-48 bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                  <button onClick={() => changeMenuMobile('buku_kas')} className="w-full text-left px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 border-b border-stone-100 flex items-center gap-2"><span className="material-icons-outlined text-[18px]">account_balance_wallet</span> Buku Kas</button>
                  <button onClick={() => changeMenuMobile('broadcast')} className="w-full text-left px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 border-b border-stone-100 flex items-center gap-2"><span className="material-icons-outlined text-[18px]">campaign</span> Broadcast</button>
                  <button onClick={() => changeMenuMobile('pengaturan')} className="w-full text-left px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 flex items-center gap-2"><span className="material-icons-outlined text-[18px]">tune</span> Pengaturan</button>
                </div>
              )}
            </div>
          </>
        )}
      </nav>

    </div>
  );
}