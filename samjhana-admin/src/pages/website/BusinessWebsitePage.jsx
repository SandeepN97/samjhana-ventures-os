import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { PageHeader } from '../../components/brand';
import BusinessTabs from '../../components/BusinessTabs';
import WebsiteContentPage from './WebsiteContentPage';

const SETTINGS = {
  furniture: { unit: 'furniture', tabs: ['furniturePages'], back: '/entry/furniture', titleKey: 'bizTabs.furnitureWebsiteTitle' },
  beekeeping: { unit: 'beekeeping', tabs: ['beekeepingPages'], back: '/entry/beekeeping', titleKey: 'bizTabs.beekeepingWebsiteTitle' },
};

/** A business's "Website page" tab: the text and pictures of its public page, edited inside the business. */
export default function BusinessWebsitePage({ business }) {
  const { t } = useTranslation();
  const cfg = SETTINGS[business];
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <PageHeader unit={cfg.unit} icon={Globe} title={t(cfg.titleKey)} backTo={cfg.back}>
        <BusinessTabs business={business} />
      </PageHeader>
      <WebsiteContentPage only={cfg.tabs} embedded />
    </div>
  );
}
