import { useSection } from '../../site/SiteContext';

/** The row of numbers under the hero ("16+ years in Gulmi", ...). Nothing is shown when staff have emptied it. */
export default function TrustStrip() {
  const { items = [] } = useSection('trust');
  if (items.length === 0) return null;
  return (
    <section id="about" className="hub-trust" aria-label="About us">
      {items.map((item) => <div key={`${item.value}-${item.label}`}><strong>{item.value}</strong><span>{item.label}</span></div>)}
    </section>
  );
}
