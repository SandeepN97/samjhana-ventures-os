import React from 'react';
import QuickActionButtons from '../../components/QuickActionButtons';
import LanguageToggle from '../../components/LanguageToggle';
import UserBar from '../../components/UserBar';
import useDesktop from '../../hooks/useDesktop';

export default function DashboardPage() {
  // On desktop the side menu carries the language switch and Logout.
  const desktop = useDesktop();
  return (
    <div className="relative">
      {/* Top bar: language switch on one side, who is signed in and Logout on the other */}
      {!desktop && (
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-2 px-4 py-2">
          <LanguageToggle />
          <UserBar />
        </div>
      )}

      <QuickActionButtons />
    </div>
  );
}
