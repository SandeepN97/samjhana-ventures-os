import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PetrolEntryPage from './pages/PetrolEntryPage';
import EVEntryPage from './pages/EVEntryPage';
import FurnitureEntryPage from './pages/FurnitureEntryPage';
import FurnitureDashboardPage from './pages/FurnitureDashboardPage';
import FurnitureInventoryPage from './pages/FurnitureInventoryPage';
import FurnitureCustomerPage from './pages/FurnitureCustomerPage';
import FurnitureOrderPage from './pages/FurnitureOrderPage';
import FurnitureOrderHistoryPage from './pages/FurnitureOrderHistoryPage';
import RentalEntryPage from './pages/RentalEntryPage';
import LoanEntryPage from './pages/LoanEntryPage';
import RecordsPage from './pages/RecordsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import PendingReviewPage from './pages/PendingReviewPage';
import FuelPricePage from './pages/FuelPricePage';
import FuelOrderPage from './pages/FuelOrderPage';
import StaffManagementPage from './pages/StaffManagementPage';
import DailyClosePage from './pages/DailyClosePage';
import EvVehiclePage from './pages/EvVehiclePage';
import RentalPropertyPage from './pages/RentalPropertyPage';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
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
        <Route
          path="/reports"
          element={
            <PrivateRoute>
              <ReportsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/daily"
          element={
            <PrivateRoute>
              <ReportsPage />
            </PrivateRoute>
          }
        />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
