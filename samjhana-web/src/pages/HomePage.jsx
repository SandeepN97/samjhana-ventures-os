import ErrorBoundary from '../components/ErrorBoundary';
import HubLanes from '../components/home/HubLanes';
import TrustStrip from '../components/home/TrustStrip';
import FeaturedTiles from '../components/home/FeaturedTiles';
import ContactSection from '../components/home/ContactSection';
import ShopShowcase from '../components/home/ShopShowcase';
import FuelEvSection from '../components/home/FuelEvSection';
import BikeRepairSection from '../components/home/BikeRepairSection';
import RestaurantSection from '../components/home/RestaurantSection';

// Each section sits in its own boundary, so one that fails can't blank the whole page.
export default function HomePage() {
  return (
    <div className="hub-page">
      <ErrorBoundary><HubLanes /></ErrorBoundary>
      <ErrorBoundary><TrustStrip /></ErrorBoundary>
      <ErrorBoundary><FeaturedTiles /></ErrorBoundary>
      <ErrorBoundary><ContactSection /></ErrorBoundary>
      <ErrorBoundary><ShopShowcase /></ErrorBoundary>
      <ErrorBoundary><FuelEvSection /></ErrorBoundary>
      <ErrorBoundary><BikeRepairSection /></ErrorBoundary>
      <ErrorBoundary><RestaurantSection /></ErrorBoundary>
    </div>
  );
}
