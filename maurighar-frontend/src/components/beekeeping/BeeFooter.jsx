import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function BeeFooter() {
  return (
    <div className="bg-[#1a1000] py-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-serif text-lg text-white">मौरी घर</p>
          <p className="font-sans text-xs text-white/40 mt-0.5">Maurighar Beekeeping · Gulmi, Nepal · Since 2008</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://wa.me/9779800000000"
            target="_blank" rel="noopener noreferrer"
            className="font-sans text-sm text-[#e8a400] hover:underline">
            💬 WhatsApp
          </a>
          <Link to="/" className="font-sans text-sm text-white/40 hover:text-white flex items-center gap-1">
            <ArrowLeft size={13} /> Back to main site
          </Link>
        </div>
      </div>
    </div>
  );
}