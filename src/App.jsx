import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './components/Layout/MainLayout';
import { testSupabaseConnection, getSupabaseStatus } from './lib/supabase';

// Auth Components
import Login from './pages/Auth/Login';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Admin Module  
import UserManagement from './pages/Admin/UserManagement';
import RolePermissions from './pages/Admin/RolePermissions';
import UserPermissionAssignment from './pages/Admin/UserPermissionAssignment';

// Main Dashboard
import FreightDashboard from './pages/FreightDashboard';

// Centralized Modules
import VendorManagement from './pages/Centralized/VendorManagement';
import CustomerManagement from './pages/Centralized/CustomerManagement';
import Finance from './pages/Centralized/Finance';
import COAMaster from './pages/Centralized/COAMaster';
import CompanySettings from './pages/Centralized/CompanySettings';

// Blink Module
import BlinkDashboard from './pages/Blink/BlinkDashboard';
import QuotationManagement from './pages/Blink/QuotationManagement';
import SalesQuotation from './pages/Blink/SalesQuotation';
import FlowMonitor from './pages/Blink/FlowMonitor';
import SalesAchievement from './pages/Blink/SalesAchievement';
import ShipmentManagement from './pages/Blink/ShipmentManagement';
import TrackingMonitoring from './pages/Blink/TrackingMonitoring';
import AWBManagement from './pages/Blink/AWBManagement';
import BLManagement from './pages/Blink/BLManagement';
import SalesRevenue from './pages/Blink/SalesRevenue';
import ProfitAnalysis from './pages/Blink/ProfitAnalysis';
import MasterRoutes from './pages/Blink/MasterRoutes';
import PartnerManagement from './pages/Blink/PartnerManagement';
import BlinkCompanySettings from './pages/Blink/CompanySettings'; // New
import BlinkApproval from './pages/Blink/BlinkApproval';
import SalesBlinkApproval from './pages/Blink/SalesBlinkApproval';

// Blink Finance Module
import InvoiceManagement from './pages/Blink/InvoiceManagement';
import PurchaseOrder from './pages/Blink/PurchaseOrder';
import GeneralJournal from './pages/Blink/GeneralJournal';
import AutoJournal from './pages/Blink/AutoJournal';
import ReversingJournal from './pages/Blink/ReversingJournal';
import NotedJournal from './pages/Blink/NotedJournal';
import AccountsReceivable from './pages/Blink/AccountsReceivable';
import AccountsPayable from './pages/Blink/AccountsPayable';
import ProfitLoss from './pages/Blink/ProfitLoss';
import BalanceSheet from './pages/Blink/BalanceSheet';
import GeneralLedger from './pages/Blink/GeneralLedger';
import TrialBalance from './pages/Blink/TrialBalance';
import SellingVsBuying from './pages/Blink/SellingVsBuying';

// Bridge Module
import BridgeOverview from './pages/Bridge/BridgeOverview';
import BCMaster from './pages/Bridge/BCMaster';
import ItemMaster from './pages/Bridge/ItemMaster';
import HSMaster from './pages/Bridge/HSMaster';
import PengajuanManagement from './pages/Bridge/PengajuanManagement';
import AtaCarnet from './pages/Bridge/AtaCarnet';
import AssetInventory from './pages/Bridge/AssetInventory';
import BridgeFinance from './pages/Bridge/BridgeFinance';
import BridgeInvoiceManagement from './pages/Bridge/BridgeInvoiceManagement';
import BridgePurchaseOrder from './pages/Bridge/BridgePurchaseOrder';
import BridgeAccountsReceivable from './pages/Bridge/BridgeAccountsReceivable';
import BridgeAccountsPayable from './pages/Bridge/BridgeAccountsPayable';
import BridgeGeneralJournal from './pages/Bridge/BridgeGeneralJournal';
import BridgeGeneralLedger from './pages/Bridge/BridgeGeneralLedger';
import BridgeTrialBalance from './pages/Bridge/BridgeTrialBalance';
import BridgeProfitLoss from './pages/Bridge/BridgeProfitLoss';
import BridgeBalanceSheet from './pages/Bridge/BridgeBalanceSheet';
import GoodsMovement from './pages/Bridge/GoodsMovement';
import WarehouseInventory from './pages/Bridge/WarehouseInventory';
import OutboundInventory from './pages/Bridge/OutboundInventory';
import ActivityLogger from './pages/Bridge/ActivityLogger';
import ApprovalManager from './pages/Bridge/ApprovalManager';
import CodeOfAccount from './pages/Bridge/CodeOfAccount';
import BridgePartnerManagement from './pages/Bridge/PartnerManagement';
import DeliveryNotes from './pages/Bridge/DeliveryNotes';
import BridgeCompanySettings from './pages/Bridge/CompanySettings'; // New

// Big Module
import BigDashboard from './pages/Big/BigDashboard';
import EventManagement from './pages/Big/Operations/EventManagement';
import BigQuotations from './pages/Big/Sales/Quotations';
import BigInvoices from './pages/Big/Finance/Invoices';
import BigCosts from './pages/Big/Operations/EventCosts';
import BigAR from './pages/Big/Finance/AccountsReceivable';
import BigCompanySettings from './pages/Big/CompanySettings'; // New

// Pabean Module
import PabeanDashboard from './pages/Bridge/Pabean/PabeanDashboard';
import BarangMasuk from './pages/Bridge/Pabean/BarangMasuk';
import BarangKeluar from './pages/Bridge/Pabean/BarangKeluar';
import BarangReject from './pages/Bridge/Pabean/BarangReject';
import PergerakanBarang from './pages/Bridge/Pabean/PergerakanBarang';

function App() {
  // Test Supabase connection on app initialization
  useEffect(() => {
    const initSupabase = async () => {
      console.log('🚀 Bakhtera-1 Application Starting...');
      const status = getSupabaseStatus();
      console.log('📊 Supabase Status:', status);

      if (status.configured) {
        const result = await testSupabaseConnection();
        if (result.success) {
          console.log('✅ Supabase connection verified!');
        } else {
          console.error('❌ Supabase connection failed:', result.error);
        }
      } else {
        console.warn('⚠️ Supabase not configured. Check .env file.');
      }
    };

    initSupabase();
  }, []);
  return (
    <AuthProvider>
      <DataProvider>
        <Router>
          <Routes>
            {/* Auth Route - No Layout */}
            <Route path="/login" element={<Login />} />

            {/* App Routes - With Layout */}
            <Route path="/*" element={
              <ProtectedRoute>
                <MainLayout>
                  <Routes>
                    {/* Main Dashboard */}
                    <Route path="/" element={<FreightDashboard />} />

                    {/* Centralized Modules — dilindungi per menuCode */}
                    <Route path="/vendors" element={<ProtectedRoute menuCode="central_vendors"><VendorManagement /></ProtectedRoute>} />
                    <Route path="/customers" element={<ProtectedRoute menuCode="central_customers"><CustomerManagement /></ProtectedRoute>} />
                    <Route path="/finance" element={<ProtectedRoute menuCode="central_finance"><Finance /></ProtectedRoute>} />
                    <Route path="/finance/coa" element={<ProtectedRoute menuCode="central_coa"><COAMaster /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute menuCode="central_settings"><CompanySettings /></ProtectedRoute>} />

                    {/* Blink Module - Sales & Operations */}
                    <Route path="/blink" element={<ProtectedRoute menuCode="blink_dashboard"><BlinkDashboard /></ProtectedRoute>} />
                    <Route path="/blink/sales-quotations" element={<ProtectedRoute menuCode="blink_sales_quotations"><SalesQuotation /></ProtectedRoute>} />
                    <Route path="/blink/operations/quotations" element={<ProtectedRoute menuCode="blink_quotations"><QuotationManagement /></ProtectedRoute>} />
                    <Route path="/blink/flow-monitor" element={<ProtectedRoute menuCode="blink_flow_monitor"><FlowMonitor /></ProtectedRoute>} />
                    <Route path="/blink/sales-achievement" element={<ProtectedRoute menuCode="blink_sales"><SalesAchievement /></ProtectedRoute>} />
                    <Route path="/blink/sales-approvals" element={<ProtectedRoute menuCode="blink_sales_approval"><SalesBlinkApproval /></ProtectedRoute>} />
                    <Route path="/blink/shipments" element={<ProtectedRoute menuCode="blink_shipments"><ShipmentManagement /></ProtectedRoute>} />
                    <Route path="/blink/operations/tracking" element={<ProtectedRoute menuCode="blink_tracking"><TrackingMonitoring /></ProtectedRoute>} />
                    <Route path="/blink/operations/awb" element={<ProtectedRoute menuCode="blink_awb"><AWBManagement /></ProtectedRoute>} />
                    <Route path="/blink/operations/bl" element={<ProtectedRoute menuCode="blink_bl"><BLManagement /></ProtectedRoute>} />
                    <Route path="/blink/master/routes" element={<ProtectedRoute menuCode="blink_routes"><MasterRoutes /></ProtectedRoute>} />
                    <Route path="/blink/master/partners" element={<ProtectedRoute menuCode="blink_partners"><PartnerManagement /></ProtectedRoute>} />
                    <Route path="/blink/master/coa" element={<ProtectedRoute menuCode="blink_coa"><COAMaster /></ProtectedRoute>} />
                    <Route path="/blink/master/settings" element={<ProtectedRoute menuCode="blink_settings"><BlinkCompanySettings /></ProtectedRoute>} />

                    {/* Blink Finance Module */}
                    <Route path="/blink/finance/invoices" element={<ProtectedRoute menuCode="blink_invoices"><InvoiceManagement /></ProtectedRoute>} />
                    <Route path="/blink/finance/purchase-orders" element={<ProtectedRoute menuCode="blink_purchase_order"><PurchaseOrder /></ProtectedRoute>} />
                    <Route path="/blink/finance/auto-journal" element={<ProtectedRoute menuCode="blink_auto_journal"><AutoJournal /></ProtectedRoute>} />
                    <Route path="/blink/finance/reversing-journal" element={<ProtectedRoute menuCode="blink_reversing_journal"><ReversingJournal /></ProtectedRoute>} />
                    <Route path="/blink/finance/general-journal" element={<ProtectedRoute menuCode="blink_journal"><GeneralJournal /></ProtectedRoute>} />
                    <Route path="/blink/finance/noted-journal" element={<ProtectedRoute menuCode="blink_noted_journal"><NotedJournal /></ProtectedRoute>} />
                    <Route path="/blink/finance/general-ledger" element={<ProtectedRoute menuCode="blink_ledger"><GeneralLedger /></ProtectedRoute>} />
                    <Route path="/blink/finance/trial-balance" element={<ProtectedRoute menuCode="blink_trial_balance"><TrialBalance /></ProtectedRoute>} />
                    <Route path="/blink/finance/ar" element={<ProtectedRoute menuCode="blink_ar"><AccountsReceivable /></ProtectedRoute>} />
                    <Route path="/blink/finance/ap" element={<ProtectedRoute menuCode="blink_ap"><AccountsPayable /></ProtectedRoute>} />
                    <Route path="/blink/finance/profit-loss" element={<ProtectedRoute menuCode="blink_pnl"><ProfitLoss /></ProtectedRoute>} />
                    <Route path="/blink/finance/balance-sheet" element={<ProtectedRoute menuCode="blink_balance_sheet"><BalanceSheet /></ProtectedRoute>} />
                    <Route path="/blink/finance/selling-buying" element={<ProtectedRoute menuCode="blink_selling_buying"><SellingVsBuying /></ProtectedRoute>} />
                    <Route path="/blink/sales-revenue" element={<ProtectedRoute menuCode="blink_dashboard"><SalesRevenue /></ProtectedRoute>} />

                    {/* Legacy Blink Routes - Redirects */}
                    <Route path="/blink/invoices" element={<ProtectedRoute menuCode="blink_invoices"><InvoiceManagement /></ProtectedRoute>} />
                    <Route path="/blink/finance/profit" element={<ProtectedRoute menuCode="blink_pnl"><ProfitAnalysis /></ProtectedRoute>} />
                    <Route path="/blink/approvals" element={<ProtectedRoute menuCode="blink_approval"><BlinkApproval /></ProtectedRoute>} />

                    {/* Bridge Module */}
                    <Route path="/bridge" element={<ProtectedRoute menuCode="bridge_dashboard"><BridgeOverview /></ProtectedRoute>} />
                    <Route path="/bridge/bc-master" element={<ProtectedRoute menuCode="bridge_bc_master"><BCMaster /></ProtectedRoute>} />
                    <Route path="/bridge/item-master" element={<ProtectedRoute menuCode="bridge_item_master"><ItemMaster /></ProtectedRoute>} />
                    <Route path="/bridge/hs-master" element={<ProtectedRoute menuCode="bridge_hs_master"><HSMaster /></ProtectedRoute>} />
                    <Route path="/bridge/pengajuan" element={<ProtectedRoute menuCode="bridge_pengajuan"><PengajuanManagement /></ProtectedRoute>} />
                    <Route path="/bridge/ata-carnet" element={<ProtectedRoute menuCode="bridge_ata_carnet"><AtaCarnet /></ProtectedRoute>} />
                    <Route path="/bridge/asset-inventory" element={<ProtectedRoute menuCode="bridge_asset_inventory"><AssetInventory /></ProtectedRoute>} />
                    {/* Bridge Finance — Transaksi */}
                    <Route path="/bridge/finance" element={<ProtectedRoute menuCode="bridge_finance"><BridgeFinance /></ProtectedRoute>} />
                    <Route path="/bridge/finance/invoices" element={<ProtectedRoute menuCode="bridge_finance"><BridgeInvoiceManagement /></ProtectedRoute>} />
                    <Route path="/bridge/finance/po" element={<ProtectedRoute menuCode="bridge_finance"><BridgePurchaseOrder /></ProtectedRoute>} />
                    <Route path="/bridge/finance/ar" element={<ProtectedRoute menuCode="bridge_finance"><BridgeAccountsReceivable /></ProtectedRoute>} />
                    <Route path="/bridge/finance/ap" element={<ProtectedRoute menuCode="bridge_finance"><BridgeAccountsPayable /></ProtectedRoute>} />
                    {/* Bridge Finance — Pencatatan */}
                    <Route path="/bridge/finance/general-journal" element={<ProtectedRoute menuCode="bridge_finance"><BridgeGeneralJournal /></ProtectedRoute>} />
                    <Route path="/bridge/finance/general-ledger" element={<ProtectedRoute menuCode="bridge_finance"><BridgeGeneralLedger /></ProtectedRoute>} />
                    {/* Bridge Finance — Laporan */}
                    <Route path="/bridge/finance/trial-balance" element={<ProtectedRoute menuCode="bridge_finance"><BridgeTrialBalance /></ProtectedRoute>} />
                    <Route path="/bridge/finance/profit-loss" element={<ProtectedRoute menuCode="bridge_finance"><BridgeProfitLoss /></ProtectedRoute>} />
                    <Route path="/bridge/finance/balance-sheet" element={<ProtectedRoute menuCode="bridge_finance"><BridgeBalanceSheet /></ProtectedRoute>} />
                    <Route path="/bridge/goods-movement" element={<ProtectedRoute menuCode="bridge_movement"><GoodsMovement /></ProtectedRoute>} />
                    <Route path="/bridge/inventory" element={<ProtectedRoute menuCode="bridge_inventory"><WarehouseInventory /></ProtectedRoute>} />
                    <Route path="/bridge/outbound-inventory" element={<ProtectedRoute menuCode="bridge_outbound"><OutboundInventory /></ProtectedRoute>} />
                    <Route path="/bridge/logger" element={<ProtectedRoute menuCode="bridge_activity"><ActivityLogger /></ProtectedRoute>} />
                    <Route path="/bridge/approvals" element={<ProtectedRoute menuCode="bridge_approval"><ApprovalManager /></ProtectedRoute>} />
                    <Route path="/bridge/approval" element={<ProtectedRoute menuCode="bridge_approval"><ApprovalManager /></ProtectedRoute>} />
                    <Route path="/bridge/pergerakan" element={<ProtectedRoute menuCode="bridge_movement"><PergerakanBarang /></ProtectedRoute>} />
                    <Route path="/bridge/delivery-notes" element={<ProtectedRoute menuCode="bridge_delivery"><DeliveryNotes /></ProtectedRoute>} />
                    <Route path="/bridge/code-of-account" element={<ProtectedRoute menuCode="bridge_coa"><CodeOfAccount /></ProtectedRoute>} />
                    <Route path="/bridge/master/partners" element={<ProtectedRoute menuCode="bridge_partners"><BridgePartnerManagement /></ProtectedRoute>} />
                    <Route path="/bridge/master/settings" element={<ProtectedRoute menuCode="bridge_settings"><BridgeCompanySettings /></ProtectedRoute>} />

                    {/* Big Module */}
                    <Route path="/big" element={<ProtectedRoute menuCode="big_dashboard"><BigDashboard /></ProtectedRoute>} />
                    <Route path="/big/master/settings" element={<ProtectedRoute menuCode="big_settings"><BigCompanySettings /></ProtectedRoute>} />

                    {/* Sales */}
                    <Route path="/big/quotations" element={<ProtectedRoute menuCode="big_quotations"><BigQuotations /></ProtectedRoute>} />
                    <Route path="/big/sales/quotations" element={<ProtectedRoute menuCode="big_quotations"><BigQuotations /></ProtectedRoute>} />

                    {/* Operations */}
                    <Route path="/big/events" element={<ProtectedRoute menuCode="big_events"><EventManagement /></ProtectedRoute>} />
                    <Route path="/big/operations/events" element={<ProtectedRoute menuCode="big_events"><EventManagement /></ProtectedRoute>} />
                    <Route path="/big/costs" element={<ProtectedRoute menuCode="big_costs"><BigCosts /></ProtectedRoute>} />
                    <Route path="/big/operations/costs" element={<ProtectedRoute menuCode="big_costs"><BigCosts /></ProtectedRoute>} />

                    {/* Finance */}
                    <Route path="/big/invoices" element={<ProtectedRoute menuCode="big_invoices"><BigInvoices /></ProtectedRoute>} />
                    <Route path="/big/finance/invoices" element={<ProtectedRoute menuCode="big_invoices"><BigInvoices /></ProtectedRoute>} />
                    <Route path="/big/ar" element={<ProtectedRoute menuCode="big_ar"><BigAR /></ProtectedRoute>} />
                    <Route path="/big/finance/ar" element={<ProtectedRoute menuCode="big_ar"><BigAR /></ProtectedRoute>} />

                    {/* Pabean Module */}
                    <Route path="/bridge/pabean" element={<ProtectedRoute menuCode="bridge_pabean"><PabeanDashboard /></ProtectedRoute>} />
                    <Route path="/bridge/pabean/barang-masuk" element={<ProtectedRoute menuCode="bridge_barang_masuk"><BarangMasuk /></ProtectedRoute>} />
                    <Route path="/bridge/pabean/barang-keluar" element={<ProtectedRoute menuCode="bridge_barang_keluar"><BarangKeluar /></ProtectedRoute>} />
                    <Route path="/bridge/pabean/barang-reject" element={<ProtectedRoute menuCode="bridge_barang_reject"><BarangReject /></ProtectedRoute>} />
                    <Route path="/bridge/pabean/pergerakan" element={<ProtectedRoute menuCode="bridge_pabean_movement"><PergerakanBarang /></ProtectedRoute>} />

                    {/* Admin Module - Super Admin Only */}
                    <Route path="/admin/users" element={
                      <ProtectedRoute requireSuperAdmin={true}>
                        <UserManagement />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/permissions" element={
                      <ProtectedRoute requireSuperAdmin={true}>
                        <RolePermissions />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/user-permissions" element={
                      <ProtectedRoute requireSuperAdmin={true}>
                        <UserPermissionAssignment />
                      </ProtectedRoute>
                    } />
                  </Routes>
                </MainLayout>
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
