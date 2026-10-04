import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import FurnitureCataloguePage from './pages/FurnitureCataloguePage';
import FurnitureProductPage from './pages/FurnitureProductPage';
import BeekeepingPage from './pages/BeekeepingPage';
import ShopOrderPage from './pages/ShopOrderPage';
import OrderPage from './pages/OrderPage';
import TrackPage from './pages/TrackPage';
import { SiteProvider, useSite } from './site/SiteContext';

const page = (element) => <ErrorBoundary>{element}</ErrorBoundary>;

/** Goes back to the top on every new page; in-page anchors (#contact, #bee-honey) scroll themselves. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo(0, 0); }, [pathname, hash]);
  return null;
}

function Shell() {
  const { site, loading, error, retry } = useSite();

  // Nothing to show yet and nothing saved from an earlier visit.
  if (!site) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        {error ? (
          <>
            <p className="font-serif text-2xl text-dark">We can&apos;t load the website right now.</p>
            <p className="text-dark/60">The server may be waking up. Please try again in a moment.</p>
            <button type="button" onClick={retry} className="btn-dark"><RefreshCw size={16} aria-hidden="true" /> Try again</button>
          </>
        ) : (
          <p className="text-dark/40" role="status">{loading ? 'Loading…' : ''}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Routes>
        <Route path="/"              element={page(<HomePage />)} />
        <Route path="/shop"          element={page(<><ShopOrderPage /><Footer /></>)} />
        <Route path="/furniture"     element={page(<FurnitureCataloguePage />)} />
        <Route path="/furniture/:id" element={page(<FurnitureProductPage />)} />
        <Route path="/beekeeping"    element={page(<BeekeepingPage />)} />
        <Route path="/order/:orderNumber" element={page(<><div className="pt-16"><OrderPage /></div><Footer /></>)} />
        <Route path="/track"         element={page(<><div className="pt-16"><TrackPage /></div><Footer /></>)} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
      <CartDrawer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SiteProvider>
        <Shell />
      </SiteProvider>
    </BrowserRouter>
  );
}
