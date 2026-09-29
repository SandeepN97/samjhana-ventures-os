# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- The primary internal users are the owner/father and staff running day-to-day operations in Nepal.
- Managers and administrators, including family managing remotely from the USA, review activity, approve records, manage users, and oversee the businesses.
- The public website serves local customers exploring the family's products and services.

## Product Purpose

Samjhana Ventures OS gives one family a single bilingual system for operating five businesses: a petrol pump, EV charging station, furniture shop, house rentals, and bank loans. It replaces fragmented day-to-day record keeping with business-specific entry, review, reporting, and management workflows while keeping a separate public website for customer-facing information and the furniture catalogue.

Success means Nepal-based staff can complete routine work simply and accurately, while managers can trust the shared records and oversee the businesses remotely.

## Positioning

This is one operating system shaped around the real workflows of one family's five distinct businesses. Each business keeps its own calculations and operational flow, while authentication, records, approvals, reporting, and administration remain unified.

## Operating Context

- Internal work happens at physical businesses in Nepal and may use shared, touch-operated devices.
- Nepali is the default admin language; English supports remote management and users who prefer it.
- Business dates and operations follow Nepal time (`Asia/Kathmandu`). Numbers use Nepali numerals in the Nepali locale and South Asian lakh/crore grouping.
- Staff enter operational data. Managers can review, approve, report, and change business settings. Administrators also manage users.
- The admin application is private and intended for Tailscale-restricted access. The public website is deployed separately.

## Capabilities and Constraints

- The five internal modules cover petrol sales and fuel orders, EV charging and electricity reconciliation, furniture inventory and orders, rental properties and payments, and loan tracking.
- Shared capabilities include authentication, role-based access, transaction records, pending review, daily close, analytics, staff management, and English/Nepali localization.
- The public website may use only intentionally public data. It must not expose costs, profit, stock levels, staff data, internal identifiers, or private operational records.
- Public customer-facing offerings include the furniture catalogue and information about fuel and EV services, bike repair, restaurant service, and beekeeping products.
- Persisted business records use soft deletion; destructive hard deletes are not part of normal product behavior.
- Interactive admin controls require a minimum 44px touch target.

## Brand Commitments

- `Samjhana Ventures` and `Maurighar Ventures` refer to the same brand. Existing uses of both names should not be treated as separate companies or silently standardized without a specific naming decision.
- Gulmi, Nepal is the factual public location.
- Established in 2008 and the `16+ years` claim are factual.
- The `4.9★` food rating is an approved factual claim, but it is static content rather than a live rating feed.
- The product is family-operated and rooted in Nepal.

## Evidence on Hand

- The repository contains working admin workflows, public catalogue and business-information surfaces, automated tests, and architecture documentation.
- Confirmed public facts are the Gulmi location, 2008 establishment date, 16+ years in operation, and static 4.9-star food rating.
- No approved testimonials, press quotations, customer counts, or live third-party review feed are recorded; future surfaces must not fabricate them.

## Product Principles

1. Make daily work straightforward for Nepal-based operators before adding flexibility.
2. Preserve business-specific workflows while keeping oversight and records unified.
3. Treat bilingual support, Nepal time, and local number conventions as core behavior.
4. Keep private operations rigorously separated from public customer information.
5. Favor trustworthy records and clear role boundaries over speculative features.

## Accessibility & Inclusion

- Admin workflows must remain usable in both English and Nepali, including Devanagari numerals where the Nepali locale calls for them.
- Interactive controls must retain at least 44px touch targets for reliable use on touch devices.
- No formal conformance target beyond these established requirements has been confirmed.
