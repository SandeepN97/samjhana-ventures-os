import { useEffect, useState } from 'react';
import { Clock3, MapPin, Phone } from 'lucide-react';
import { restaurantApi, mediaPath, mediaUrl } from '../../api/api.js';
import { useSection } from '../../site/SiteContext';
import { formatMoney } from '../../utils/format';
import { telLink } from '../../site/links';
import Picture from '../ui/Picture';

const VEG = <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500 mr-2 shrink-0" role="img" aria-label="Vegetarian" />;
const NON = <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500 mr-2 shrink-0" role="img" aria-label="Non-vegetarian" />;

const COURSES = [
  { key: 'MAIN', title: 'Mains', noteKey: 'mainsNote' },
  { key: 'SNACK', title: 'Snacks' },
  { key: 'DESSERT', title: 'Desserts' },
  { key: 'DRINK', title: 'Drinks', noteKey: 'drinksNote' },
  { key: 'BREAKFAST', title: 'Breakfast' },
];

function MenuItem({ dish }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-white/10 ${dish.available === false ? 'opacity-50' : ''}`}>
      {dish.imageUrl && <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white/10"><Picture src={dish.imageUrl} alt="" className="h-full w-full" /></div>}
      <span className="flex min-w-0 flex-1 items-center text-sm text-white/80 font-sans">
        {dish.veg ? VEG : NON}
        <span className="min-w-0">
          {dish.name}
          {dish.nameNepali && <small className="ml-2 text-white/40">{dish.nameNepali}</small>}
          {dish.available === false && <small className="ml-2 text-amber-300/80">Sold out today</small>}
        </span>
      </span>
      {dish.price != null && <span className="shrink-0 text-sm text-white/70">{formatMoney(dish.price)}</span>}
    </div>
  );
}

export default function RestaurantSection() {
  const copy = useSection('restaurant');
  const hours = useSection('hours');
  const contact = useSection('contact');
  const meals = copy.meals || [];
  const [mealId, setMealId] = useState(null);
  const [dishes, setDishes] = useState([]);
  const meal = meals.find((m) => m.id === mealId) || meals[0];
  const tel = telLink(contact);

  useEffect(() => {
    restaurantApi.menu().then((data) => setDishes(Array.isArray(data.dishes) ? data.dishes : [])).catch(() => setDishes([]));
  }, []);

  const byCourse = (course) => dishes.filter((d) => d.course === course);
  const breakfastHours = meals.find((m) => m.id === 'breakfast')?.hours;
  const column1 = ['MAIN', 'SNACK', 'DESSERT'].map((k) => COURSES.find((c) => c.key === k));
  const column2 = ['DRINK', 'BREAKFAST'].map((k) => COURSES.find((c) => c.key === k));

  const renderCourse = (course, index) => {
    const items = byCourse(course.key);
    if (items.length === 0) return null;
    const note = course.noteKey ? copy[course.noteKey] : course.key === 'BREAKFAST' && breakfastHours ? `Served ${breakfastHours} daily` : '';
    return (
      <div key={course.key} className={index > 0 ? 'mt-8' : ''}>
        <p className="font-serif text-xl text-white mb-1">{course.title}</p>
        {note ? <p className="text-xs text-white/40 font-sans mb-4">{note}</p> : <div className="mb-3" />}
        {items.map((d) => <MenuItem key={d.id} dish={d} />)}
      </div>
    );
  };

  return (
    <section id="restaurant" className="bg-[#1e1206]">
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-center gap-4 mb-10">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{copy.eyebrow}</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col gap-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold/80">{copy.kicker}</p>
            <h2 className="font-serif text-5xl lg:text-6xl text-white leading-tight">
              {copy.titleLine1}<br /><em className="italic text-gold">{copy.titleLine2}</em>
            </h2>
            <p className="text-white/50 font-sans leading-relaxed max-w-md">{copy.intro}</p>
            {(copy.stats || []).length > 0 && (
              <div className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
                {copy.stats.map((s) => (
                  <div key={`${s.value}-${s.label}`}>
                    <p className="font-serif text-2xl text-white">{s.value}</p>
                    <p className="text-xs text-white/40 font-sans mt-0.5 uppercase tracking-wider">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
            {meal && (
              <div className="meal-story">
                <div className="meal-tabs" role="tablist" aria-label="Choose a meal period">
                  {meals.map((period) => (
                    <button type="button" role="tab" aria-selected={meal.id === period.id} key={period.id} onClick={() => setMealId(period.id)}
                      className={meal.id === period.id ? 'meal-tab meal-tab-active' : 'meal-tab'}>
                      {period.label}<small>{period.nepali}</small>
                    </button>
                  ))}
                </div>
                <p key={meal.id} className="meal-story-copy" aria-live="polite">{meal.story}</p>
                <span><Clock3 size={14} /> {meal.hours}</span>
              </div>
            )}
          </div>

          {meal && (
            <div key={meal.id} className="meal-photo-card meal-dish-grid" aria-label={`${meal.label} at the restaurant`}>
              {meal.image ? <img src={mediaUrl(mediaPath(meal.image))} alt={`${meal.label} at the restaurant`} loading="lazy" /> : <div className="h-full w-full bg-white/5" />}
              <div className="meal-photo-caption"><strong>{meal.label} at the table</strong>{copy.captionNote && <span>{copy.captionNote}</span>}</div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Full Menu</p>
            <div className="flex items-center gap-3 ml-4 text-xs text-white/30 font-sans">
              <span className="flex items-center gap-1.5">{VEG} Vegetarian</span>
              <span className="flex items-center gap-1.5">{NON} Non-veg</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-10">
            <div>
              {dishes.length === 0 && <p className="text-sm text-white/40">The menu is being updated. Please call us for today&apos;s dishes.</p>}
              {column1.map(renderCourse)}
            </div>
            <div>{column2.map(renderCourse)}</div>

            <div className="flex flex-col gap-5">
              {meals.length > 0 && (
                <div className="rounded-2xl border border-white/10 p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gold mb-4">{copy.hoursTitle}</p>
                  {meals.map((h) => (
                    <div key={h.id} className="flex justify-between py-2 border-b border-white/5 text-sm">
                      <span className="text-white/50 font-sans">{h.label}</span>
                      <span className="text-white/80 font-sans">{h.hours}</span>
                    </div>
                  ))}
                  {copy.hoursFooter && <p className="text-xs text-white/30 font-sans mt-3">{copy.hoursFooter}</p>}
                </div>
              )}

              {(copy.ambience || []).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {copy.ambience.map((a) => <div key={a} className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white/50 font-sans">{a}</div>)}
                </div>
              )}

              {copy.kitchenQuote && (
                <div className="rounded-2xl bg-gold/10 border border-gold/20 p-5">
                  <p className="text-gold text-sm font-semibold mb-2">{copy.kitchenTitle}</p>
                  <p className="font-serif text-white/70 text-lg leading-relaxed">&ldquo;{copy.kitchenQuote}&rdquo;</p>
                  {copy.kitchenQuoteEnglish && <p className="text-white/30 text-xs font-sans mt-2">{copy.kitchenQuoteEnglish}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-dark/50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-sm text-white/40 font-sans">
          <div className="flex flex-wrap gap-6">
            {hours.restaurantDaily && <span><Clock3 size={14} className="inline mr-1" />Daily {hours.restaurantDaily}</span>}
            {copy.locationLine && <span><MapPin size={14} className="inline mr-1" />{copy.locationLine}</span>}
            {tel && <a href={tel}><Phone size={14} className="inline mr-1" />Call {contact.phone}</a>}
          </div>
          {copy.walkInNote && <span className="text-xs">{copy.walkInNote}</span>}
        </div>
      </div>
    </section>
  );
}
