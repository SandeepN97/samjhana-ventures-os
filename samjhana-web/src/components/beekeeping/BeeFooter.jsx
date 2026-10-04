import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSection } from '../../site/SiteContext';
import { whatsappLink } from '../../site/links';

export default function BeeFooter() {
  const copy = useSection('beekeeping').footer || {};
  const contact = useSection('contact');
  const whatsapp = whatsappLink(contact);
  return (
    <div className="bg-[#1a1000] py-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-serif text-lg text-white">{copy.nepaliName}</p>
          <p className="font-sans text-xs text-white/40 mt-0.5">{copy.line}</p>
        </div>
        <div className="flex items-center gap-4">
          {whatsapp && <a href={whatsapp}
            target="_blank" rel="noopener noreferrer"
            className="font-sans text-sm text-[#e8a400] hover:underline">
            {copy.whatsappLabel}
          </a>}
          <Link to="/" className="font-sans text-sm text-white/40 hover:text-white flex items-center gap-1">
            <ArrowLeft size={13} /> {copy.backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
