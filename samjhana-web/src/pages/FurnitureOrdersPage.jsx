import { Navigate } from 'react-router-dom';

// This page references an order-history feature that isn't wired up yet (no customer/auth
// store, no backend endpoint) — `customer` and `logout` were undeclared identifiers that
// would throw as soon as this component rendered. Redirect immediately instead of rendering
// a broken page; reintroduce order history once a real customer store and backend ownership
// checks exist.
export default function FurnitureOrdersPage() {
  return <Navigate to="/furniture" replace />;
}
