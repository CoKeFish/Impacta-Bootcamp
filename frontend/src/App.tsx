import {BrowserRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AcceslyProvider} from 'accesly';
import {Layout} from '@/components/layout/Layout';
import {Landing} from '@/pages/Landing';
import {InvoiceDashboard} from '@/pages/InvoiceDashboard';
import {CreateInvoice} from '@/pages/CreateInvoice';
import {InvoiceDetail} from '@/pages/InvoiceDetail';
import {ServiceCatalog} from '@/pages/ServiceCatalog';
import {MyBusinesses} from '@/pages/MyBusinesses';
import {RegisterBusiness} from '@/pages/RegisterBusiness';
import {BusinessProfile} from '@/pages/BusinessProfile';
import {EditBusiness} from '@/pages/EditBusiness';
import {AddService} from '@/pages/AddService';
import {EditService} from '@/pages/EditService';
import {Profile} from '@/pages/Profile';
import {AdminDashboard} from '@/pages/admin/AdminDashboard';
import {AdminUsers} from '@/pages/admin/AdminUsers';
import {AdminBusinesses} from '@/pages/admin/AdminBusinesses';
import {AdminInvoices} from '@/pages/admin/AdminInvoices';
import {JoinByInvite} from '@/pages/JoinByInvite';
import {Checkout} from '@/pages/Checkout';
import {Toaster} from 'sonner';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 10_000,
            retry: 1,
        },
    },
});

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Toaster position="top-center" richColors/>
            <BrowserRouter>
                <AcceslyProvider
                    appId={import.meta.env.VITE_ACCESLY_APP_ID || 'acc_demo'}
                    network="testnet"
                >
                    <Routes>
                        <Route element={<Layout/>}>
                            {/* Public */}
                            <Route path="/" element={<Landing/>}/>
                            <Route path="/services" element={<ServiceCatalog/>}/>
                            <Route path="/businesses/:id" element={<BusinessProfile/>}/>

                            {/* Join by invite */}
                            <Route path="/join/:code" element={<JoinByInvite/>}/>

                            {/* Cart/Checkout (auth required) */}
                            <Route path="/checkout" element={<Checkout/>}/>

                            {/* Invoices (auth required) */}
                            <Route path="/invoices" element={<InvoiceDashboard/>}/>
                            <Route path="/invoices/new" element={<CreateInvoice/>}/>
                            <Route path="/invoices/:id" element={<InvoiceDetail/>}/>

                            {/* Business management (auth required) */}
                            <Route path="/businesses" element={<MyBusinesses/>}/>
                            <Route path="/businesses/new" element={<RegisterBusiness/>}/>
                            <Route path="/businesses/:id/edit" element={<EditBusiness/>}/>
                            <Route path="/businesses/:id/services/new" element={<AddService/>}/>

                            {/* Services (auth required for edit) */}
                            <Route path="/services/:id/edit" element={<EditService/>}/>

                            {/* Profile */}
                            <Route path="/profile" element={<Profile/>}/>

                            {/* Admin (hidden, role=admin required) */}
                            <Route path="/admin" element={<AdminDashboard/>}/>
                            <Route path="/admin/users" element={<AdminUsers/>}/>
                            <Route path="/admin/businesses" element={<AdminBusinesses/>}/>
                            <Route path="/admin/invoices" element={<AdminInvoices/>}/>
                        </Route>
                    </Routes>
                </AcceslyProvider>
            </BrowserRouter>
        </QueryClientProvider>
    );
}
