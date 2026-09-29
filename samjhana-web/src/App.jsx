import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import FurnitureSection from './components/FurnitureSection';
import FuelEvSection from './components/FuelEvSection';
import BikeRepairSection from './components/BikeRepairSection';
import RestaurantSection from './components/RestaurantSection';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import ErrorBoundary from './components/ErrorBoundary';
import FurnitureCataloguePage from './pages/FurnitureCataloguePage';
import FurnitureProductPage from './pages/FurnitureProductPage';
import FurnitureOrdersPage from './pages/FurnitureOrdersPage';
import BeekeepingPage from './pages/BeekeepingPage';

// Each section and page sits in its own boundary, so one that fails can't blank the whole site.
export function MainPage() {
  return (
    <>
      <ErrorBoundary><HeroSection /></ErrorBoundary>
      <ErrorBoundary><FurnitureSection /></ErrorBoundary>
      <ErrorBoundary><FuelEvSection /></ErrorBoundary>
      <ErrorBoundary><BikeRepairSection /></ErrorBoundary>
      <ErrorBoundary><RestaurantSection /></ErrorBoundary>
      <Footer />
    </>
  );
}

const page = (element) => <ErrorBoundary>{element}</ErrorBoundary>;

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"                  element={<MainPage />} />
        <Route path="/furniture"         element={page(<FurnitureCataloguePage />)} />
        <Route path="/furniture/orders"  element={page(<FurnitureOrdersPage />)} />
        <Route path="/furniture/:id"     element={page(<FurnitureProductPage />)} />
        <Route path="/beekeeping"        element={page(<BeekeepingPage />)} />
      </Routes>
      <CartDrawer />
    </BrowserRouter>
  );
}