import ErrorBoundary from '../components/ErrorBoundary';
import HubLanes from '../components/home/HubLanes';
import TrustStrip from '../components/home/TrustStrip';
import FeaturedTiles from '../components/home/FeaturedTiles';
import ContactSection from '../components/home/ContactSection';
import FurnitureSection from '../components/FurnitureSection';
import FuelEvSection from '../components/home/FuelEvSection';
import BikeRepairSection from '../components/home/BikeRepairSection';
import RestaurantSection from '../components/home/RestaurantSection';
import Footer from '../components/Footer';

// Each section sits in its own boundary, so one that fails can't blank the whole page.
export default function HomePage() {
  return (
    <>
      <main className="hub-page">
        <ErrorBoundary><HubLanes /></ErrorBoundary>
        <ErrorBoundary><TrustStrip /></ErrorBoundary>
        <ErrorBoundary><FeaturedTiles /></ErrorBoundary>
        <ErrorBoundary><ContactSection /></ErrorBoundary>
      </main>
      <ErrorBoundary><FurnitureSection /></ErrorBoundary>
      <ErrorBoundary><FuelEvSection /></ErrorBoundary>
      <ErrorBoundary><BikeRepairSection /></ErrorBoundary>
      <ErrorBoundary><RestaurantSection /></ErrorBoundary>
      <Footer />
    </>
  );
}
