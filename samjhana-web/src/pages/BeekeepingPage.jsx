import { useState } from 'react';
import { useCartStore } from '../store/cartStore';
import BeeNav from '../components/beekeeping/BeeNav';
import BeeHero from '../components/beekeeping/BeeHero';
import FeaturedHive from '../components/beekeeping/FeaturedHive';
import HiveGrid from '../components/beekeeping/HiveGrid';
import ProtectiveGear from '../components/beekeeping/ProtectiveGear';
import BeekeeperTools from '../components/beekeeping/BeekeeperTools';
import HoneyProducts from '../components/beekeeping/HoneyProducts';
import StarterKits from '../components/beekeeping/StarterKits';
import BeekeeperEdu from '../components/beekeeping/BeekeeperEdu';
import BeeFooter from '../components/beekeeping/BeeFooter';

export default function BeekeepingPage() {
  const addItem               = useCartStore((s) => s.addItem);
  const count                 = useCartStore((s) => s.count);
  const setOpen               = useCartStore((s) => s.setOpen);
  const [activeCategory, setActiveCategory] = useState('hives');
  const [toast, setToast]     = useState(null);

  const addToCart = (product, qty = 1) => {
    addItem(product, qty, false);
    setToast(product.name);
    setTimeout(() => setToast(null), 2500);
  };

  const scrollToHives = () => document.getElementById('bee-hives')?.scrollIntoView({ behavior: 'smooth' });
  const scrollToKits  = () => document.getElementById('bee-kits')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="font-sans bg-[#fdf8e8] min-h-screen">
      <BeeNav activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
      <BeeHero onShopHives={scrollToHives} onStarterKits={scrollToKits} />

      <FeaturedHive onAddToCart={addToCart} />
      <HiveGrid onAddToCart={addToCart} />
      <ProtectiveGear onAddToCart={addToCart} />
      <BeekeeperTools onAddToCart={addToCart} />
      <HoneyProducts onAddToCart={addToCart} />
      <StarterKits onAddToCart={addToCart} />
      <BeekeeperEdu />
      <BeeFooter />

      {/* Floating cart indicator — opens shared cart drawer */}
      {count > 0 && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-[#e8a400] text-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3 font-sans hover:bg-[#d49400] transition-colors">
          <span className="text-lg">🛒</span>
          <div className="text-left">
            <p className="text-xs font-bold leading-none">{count} item{count !== 1 ? 's' : ''} in cart</p>
            <p className="text-[10px] opacity-70 mt-0.5">View cart</p>
          </div>
        </button>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-[#1a1000] text-white rounded-2xl px-5 py-3 font-sans text-sm shadow-xl max-w-sm text-center pointer-events-none">
          ✓ Added — {toast}
        </div>
      )}
    </div>
  );
}