import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import FurnitureSection from './components/FurnitureSection';
import FuelEvSection from './components/FuelEvSection';
import BikeRepairSection from './components/BikeRepairSection';
import RestaurantSection from './components/RestaurantSection';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import FurnitureCataloguePage from './pages/FurnitureCataloguePage';
import FurnitureProductPage from './pages/FurnitureProductPage';
import FurnitureOrdersPage from './pages/FurnitureOrdersPage';
import BeekeepingPage from './pages/BeekeepingPage';

function MainPage() {
  return (
    <>
      <HeroSection />
      <FurnitureSection />
      <FuelEvSection />
      <BikeRepairSection />
      <RestaurantSection />
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"                  element={<MainPage />} />
        <Route path="/furniture"         element={<FurnitureCataloguePage />} />
        <Route path="/furniture/orders"  element={<FurnitureOrdersPage />} />
        <Route path="/furniture/:id"     element={<FurnitureProductPage />} />
        <Route path="/beekeeping"        element={<BeekeepingPage />} />
      </Routes>
      <CartDrawer />
    </BrowserRouter>
  );
}