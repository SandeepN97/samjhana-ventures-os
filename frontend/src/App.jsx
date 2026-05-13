import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace' }}>
          <h2 style={{ color: 'red' }}>Page Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#333', fontSize: 13 }}>
            {this.state.error.toString()}{'\n'}{this.state.error.stack}
          </pre>
          <button onClick={() => { this.setState({ error: null }); window.history.back(); }}
            style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}>
            Go Back
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import LoginPage from './pages/shared/LoginPage';
import DashboardPage from './pages/shared/DashboardPage';
import DailyClosePage from './pages/shared/DailyClosePage';
import RecordsPage from './pages/shared/RecordsPage';
import ReportsPage from './pages/shared/ReportsPage';
import PendingReviewPage from './pages/shared/PendingReviewPage';
import AnalyticsPage from './pages/shared/AnalyticsPage';
import PetrolEntryPage from './pages/petrol/PetrolEntryPage';
import FuelPricePage from './pages/petrol/FuelPricePage';
import FuelOrderPage from './pages/petrol/FuelOrderPage';
import EVEntryPage from './pages/ev/EVEntryPage';
import EvVehiclePage from './pages/ev/EvVehiclePage';
import FurnitureEntryPage from './pages/furniture/FurnitureEntryPage';
import FurnitureDashboardPage from './pages/furniture/FurnitureDashboardPage';
import FurnitureInventoryPage from './pages/furniture/FurnitureInventoryPage';
import FurnitureCustomerPage from './pages/furniture/FurnitureCustomerPage';
import FurnitureOrderPage from './pages/furniture/FurnitureOrderPage';
import FurnitureOrderHistoryPage from './pages/furniture/FurnitureOrderHistoryPage';
import RentalEntryPage from './pages/rental/RentalEntryPage';
import RentalPropertyPage from './pages/rental/RentalPropertyPage';
import RentalTenantsPage from './pages/rental/RentalTenantsPage';
import LoanEntryPage from './pages/loans/LoanEntryPage';
import SettingsPage from './pages/admin/SettingsPage';
import StaffManagementPage from './pages/admin/StaffManagementPage';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/entry/petrol"
          element={
            <PrivateRoute>
              <PetrolEntryPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/entry/ev"
          element={
            <PrivateRoute>
              <EVEntryPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/entry/furniture"
          element={
            <PrivateRoute>
              <FurnitureDashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/furniture/inventory"
          element={
            <PrivateRoute>
              <FurnitureInventoryPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/furniture/customers"
          element={
            <PrivateRoute>
              <FurnitureCustomerPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/furniture/orders/new"
          element={
            <PrivateRoute>
              <FurnitureOrderPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/furniture/orders"
          element={
            <PrivateRoute>
              <FurnitureOrderHistoryPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/entry/rental"
          element={
            <PrivateRoute>
              <RentalEntryPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/entry/loan"
          element={
            <PrivateRoute>
              <LoanEntryPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/records"
          element={
            <PrivateRoute>
              <RecordsPage />
            </PrivateRoute>
          }
        />
        <Route path="/reports" element={<Navigate to="/reports/close" replace />} />
        <Route path="/reports/daily" element={<Navigate to="/reports/close" replace />} />
        <Route
          path="/reports/close"
          element={
            <PrivateRoute>
              <DailyClosePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <SettingsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/pending"
          element={
            <PrivateRoute>
              <PendingReviewPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/fuel-prices"
          element={
            <PrivateRoute>
              <FuelPricePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/fuel-orders"
          element={
            <PrivateRoute>
              <FuelOrderPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <PrivateRoute>
              <StaffManagementPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/ev-vehicles"
          element={
            <PrivateRoute>
              <EvVehiclePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/rental-properties"
          element={
            <PrivateRoute>
              <RentalPropertyPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/rental-tenants"
          element={
            <PrivateRoute>
              <RentalTenantsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <PrivateRoute>
              <AnalyticsPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
