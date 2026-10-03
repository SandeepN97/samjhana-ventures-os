import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { useCatalogue, groupBee } from '../data/catalogue';
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
  const catalogue = useCatalogue('BEEKEEPING');
  const data = useMemo(() => groupBee(catalogue.items), [catalogue.items]);
  const { hash } = useLocation();

  // /beekeeping#bee-honey and the like land on that section once the products have loaded.
  useEffect(() => {
    if (!hash || catalogue.loading) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash, catalogue.loading]);

  const counts = {
    hives: data.hives.length, protective: data.protectiveGear.length, tools: data.tools.length, honey: data.honeyProducts.length,
    queen: data.queenDevices.length, kits: data.starterKits.length, wax: data.waxAndFrames.length, smokers: data.smokers.length,
  };

  const addToCart = (product, qty = 1) => {
    if (product.inStock === false) return;
    addItem(product, qty, false);
    setToast(product.name);
    setTimeout(() => setToast(null), 2500);
  };

  const scrollToHives = () => document.getElementById('bee-hives')?.scrollIntoView({ behavior: 'smooth' });
  const scrollToKits  = () => document.getElementById('bee-kits')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="font-sans bg-[#fdf8e8] min-h-screen">
      <BeeNav activeCategory={activeCategory} setActiveCategory={setActiveCategory} counts={counts} />
      <BeeHero onShopHives={scrollToHives} onStarterKits={scrollToKits} />

      {catalogue.loading && (
        <div className="flex items-center justify-center gap-3 py-24 text-[#1a1000]/40" role="status"><Loader size={20} className="animate-spin" /> Loading…</div>
      )}
      {catalogue.error && (
        <div role="alert" className="mx-auto max-w-md py-24 text-center">
          <p className="font-serif text-xl text-[#1a1000]/60">The shop could not be loaded.</p>
          <button type="button" onClick={catalogue.retry} className="mt-4 min-h-[44px] rounded-xl bg-[#e8a400] px-6 font-sans font-semibold text-white">Try again</button>
        </div>
      )}
      {!catalogue.loading && !catalogue.error && <>
        <FeaturedHive hives={data.hives} onAddToCart={addToCart} />
        <HiveGrid hives={data.hives} onAddToCart={addToCart} />
        <ProtectiveGear protectiveGear={data.protectiveGear} onAddToCart={addToCart} />
        <BeekeeperTools tools={data.tools} onAddToCart={addToCart} />
        <HoneyProducts honeyProducts={data.honeyProducts} onAddToCart={addToCart} />
        <StarterKits starterKits={data.starterKits} onAddToCart={addToCart} />
      </>}
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