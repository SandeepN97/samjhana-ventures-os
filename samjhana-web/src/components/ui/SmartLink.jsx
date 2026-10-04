import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSection } from '../../site/SiteContext';
import { isExternal, resolveLink } from '../../site/links';

/**
 * One component for every kind of link in the site's content: a page of the site, an anchor on the home page,
 * or an outside address (web, phone, WhatsApp). Outside addresses open in a new tab.
 */
export default function SmartLink({ href, children, className = '', onClick, ...rest }) {
  const contact = useSection('contact');
  const location = useLocation();
  const navigate = useNavigate();
  const target = resolveLink(href, contact);

  if (!target) return <span className={className} {...rest}>{children}</span>;

  if (target.startsWith('#') || target.startsWith('/#')) {
    const id = target.replace(/^\/?#/, '');
    const go = (event) => {
      event.preventDefault();
      const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      if (location.pathname === '/') scroll();
      else { navigate('/'); setTimeout(scroll, 150); }
      onClick?.();
    };
    return <a href={`/#${id}`} onClick={go} className={className} {...rest}>{children}</a>;
  }

  if (isExternal(target)) {
    const web = /^https?:/.test(target);
    return (
      <a href={target} className={className} onClick={onClick} {...(web ? { target: '_blank', rel: 'noreferrer' } : {})} {...rest}>
        {children}
      </a>
    );
  }

  return <Link to={target} className={className} onClick={onClick} {...rest}>{children}</Link>;
}
