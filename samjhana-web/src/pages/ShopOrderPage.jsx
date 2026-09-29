import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Box, ChevronRight, MessageCircle, Phone, X } from 'lucide-react';
import { furnitureApi } from '../api/api.js';
import { BasicKitSVG, LangstrothHiveSVG } from '../components/beekeeping/BeekeepingSVGs';
import honeyPhoto from '../assets/real/honey-jar.jpg';
import furniturePhoto from '../assets/real/wooden-chair.jpg';

const WHATSAPP = 'https://wa.me/9779363147818';

export default function ShopOrderPage() {
  const [furniture, setFurniture] = useState([]);
  const [showVehicleStory, setShowVehicleStory] = useState(false);

  useEffect(() => {
    furnitureApi.getItems().then((items) => setFurniture(items.slice(0, 3))).catch(() => setFurniture([]));
  }, []);

  return (
    <main className="shop-hub-page">
      <section className="shop-hub-hero">
        <div className="shop-hub-hero-copy">
          <p className="hub-lane-label">Samjhana Ventures · Shop & order</p>
          <h1>Useful things,<br /><em>made to stay.</em></h1>
          <p className="shop-hub-nepali">घरका लागि, यात्राका लागि, गुल्मीबाट।</p>
          <p className="shop-hub-intro">The things we make and sell come from the same family-run place in Gulmi: furniture for daily life, honey from the hills, and tools for the people who keep the hives going. Start with a story, then browse deeper.</p>
          <div className="shop-hub-actions"><a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn-dark"><MessageCircle size={16} /> Ask on WhatsApp</a><a href="tel:+9779363147818" className="btn-outline"><Phone size={16} /> +977 9363147818</a></div>
        </div>
        <div className="shop-hub-visual" aria-label="Samjhana Ventures products from Gulmi">
          <img className="shop-hub-scene" src={furniturePhoto} alt="Wooden furniture made for everyday homes" />
          <div className="shop-hub-visual-caption"><strong>Made and selected in Gulmi</strong><span>Honey · furniture · beekeeping</span></div>
        </div>
      </section>

      <section className="shop-hub-choices" aria-label="Shop categories">
        <article className="shop-choice shop-choice-furniture"><div className="shop-choice-art"><img src={furniturePhoto} alt="Wooden chair" /></div><div className="shop-choice-copy"><p className="hub-lane-label">Furniture studio</p><h2>Pieces for real homes.</h2><p>A chair becomes part of breakfast, a table gathers a family, and a bed holds the end of a long day. Browse what we have, then ask about a custom one.</p><div className="shop-preview-row">{furniture.length > 0 ? furniture.map((item) => <Link key={item.id} to={`/furniture/${item.id}`} className="shop-mini-card"><span><img src={furniturePhoto} alt="" /></span><strong>{item.name}</strong></Link>) : <span className="shop-preview-empty">Browse the collection for current pieces.</span>}</div><Link to="/furniture" className="shop-choice-link">Browse all furniture <ArrowUpRight size={16} /></Link></div></article>
        <article className="shop-choice shop-choice-honey"><div className="shop-choice-art"><img src={honeyPhoto} alt="Honey being poured into a glass jar" /></div><div className="shop-choice-copy"><p className="hub-lane-label">Maurighar</p><h2>Honey & beekeeping.</h2><p>From the first hive to the first harvest, Maurighar helps keepers begin, learn, and keep going with honey, tools, and starter kits.</p><div className="shop-preview-row"><Link to="/beekeeping#bee-honey" className="shop-mini-card"><span><img src={honeyPhoto} alt="" /></span><strong>Gulmi honey</strong></Link><Link to="/beekeeping#bee-hives" className="shop-mini-card"><span><LangstrothHiveSVG /></span><strong>Hives</strong></Link><Link to="/beekeeping#bee-kits" className="shop-mini-card"><span><BasicKitSVG /></span><strong>Starter kits</strong></Link></div><Link to="/beekeeping" className="shop-choice-link">Browse all Maurighar <ArrowUpRight size={16} /></Link></div></article>
      </section>

      <section className="shop-hub-note"><Box size={20} /><div><strong>Vehicle essentials are orderable too.</strong><p>For bike and car products, send us a photo or list on WhatsApp and we’ll confirm availability.</p></div><button type="button" onClick={() => setShowVehicleStory(true)}>See how it works <ChevronRight size={16} /></button></section>

      {showVehicleStory && <div className="story-modal-backdrop" role="presentation" onClick={() => setShowVehicleStory(false)}>
        <section className="story-modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-story-title" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="story-modal-close" aria-label="Close vehicle essentials story" onClick={() => setShowVehicleStory(false)}><X size={18} /></button>
          <p className="hub-lane-label">A quick road story</p>
          <h2 id="vehicle-story-title">Tell us what the road needs.</h2>
          <p>Your bike or car does not need to fit a catalogue category. Send a photo, a part name, or a short list. We’ll check what is available at Samjhana Ventures and reply with the next practical option.</p>
          <div className="story-modal-steps"><span><b>01</b> Send a photo or list</span><span><b>02</b> We check availability</span><span><b>03</b> You choose how to proceed</span></div>
          <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn-dark story-modal-action"><MessageCircle size={16} /> Ask on WhatsApp</a>
        </section>
      </div>}
    </main>
  );
}
