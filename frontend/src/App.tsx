import {BrowserRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Layout} from '@/components/layout/Layout';
import {Landing} from '@/pages/Landing';
import {Dashboard} from '@/pages/Dashboard';
import {TripDetail} from '@/pages/TripDetail';
import {CreateTrip} from '@/pages/CreateTrip';
import {Profile} from '@/pages/Profile';

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
            <BrowserRouter>
                <Routes>
                    <Route element={<Layout/>}>
                        <Route path="/" element={<Landing/>}/>
                        <Route path="/trips" element={<Dashboard/>}/>
                        <Route path="/trips/new" element={<CreateTrip/>}/>
                        <Route path="/trips/:id" element={<TripDetail/>}/>
                        <Route path="/profile" element={<Profile/>}/>
                    </Route>
                </Routes>
            </BrowserRouter>
        </QueryClientProvider>
    );
}
