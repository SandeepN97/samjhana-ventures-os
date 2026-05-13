import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { hives } from '../../data/beekeepingProducts';
import SectionDivider from './SectionDivider';
import ProductCard from './ProductCard';

export default function HiveGrid({ onAddToCart }) {
  return (
    <section className="bg-[#fdf8e8] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <SectionDivider num="02" name="All hive types" tag="Mauri Ghar" tagColor="honey" />

        <div className="flex items-end justify-between mb-8">
          <h2 className="font-serif text-2xl text-[#1a1000]">More hive options</h2>
          <button className="font-sans text-sm font-medium text-[#e8a400] flex items-center gap-1 hover:underline">
            सबै हेर्नुहोस् <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {hives.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
          ))}
        </div>
      </div>
    </section>
  );
}