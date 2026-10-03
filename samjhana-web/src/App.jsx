import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderPage from './pages/OrderPage';
import TrackPage from './pages/TrackPage';
import { SiteProvider, useSite } from './site/SiteContext';

const page = (element) => <ErrorBoundary>{element}</ErrorBoundary>;

/** Goes back to the top on every new page, but leaves in-page anchors (#contact) to scroll themselves. */
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
      <Header />
      <Routes>
        <Route path="/" element={page(<HomePage />)} />
        <Route path="/shop" element={page(<ShopPage />)} />
        <Route path="/product/:slug" element={page(<ProductPage />)} />
        <Route path="/cart" element={page(<CartPage />)} />
        <Route path="/checkout" element={page(<CheckoutPage />)} />
        <Route path="/order/:orderNumber" element={page(<OrderPage />)} />
        <Route path="/track" element={page(<TrackPage />)} />
        {/* The old catalogue addresses keep working */}
        <Route path="/furniture" element={<Navigate to="/shop?type=FURNITURE" replace />} />
        <Route path="/beekeeping" element={<Navigate to="/shop?type=BEEKEEPING" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
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
