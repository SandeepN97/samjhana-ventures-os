# 🏢 Samjhana Ventures OS - Complete System Architecture

## Overview

Samjhana Ventures OS is a dynamic multi-business ERP system designed for a Nepal-USA family business operation managing:

- 🛢️ **Shringeshwor Petrol Pump** - Fuel sales with WAC profit calculation
- ⚡ **EV Charging Station** - Meter-based billing with NEA reconciliation
- 🪑 **Furniture Shop** - Simple stock tracking (Items In - Items Out)
- 🏠 **House Rental** - Tenant and payment management
- 🏦 **Bank Loan Management** - Interest accrual and balance tracking

---

## Architecture Diagrams

### 1. Registry Pattern Architecture

```mermaid
flowchart TB
    subgraph BusinessRegistry["📋 Business Registry (Core)"]
        BR[("Business Registry<br/>Central Metadata Store")]
    end
    
    subgraph BusinessUnits["🏢 Registered Business Units"]
        PETROL["🛢️ Petrol Pump<br/><i>Shringeshwor</i>"]
        EV["⚡ EV Charging<br/><i>Station</i>"]
        FURNITURE["🪑 Furniture<br/><i>Shop</i>"]
        RENTAL["🏠 House Rental<br/><i>Properties</i>"]
        LOAN["🏦 Bank Loan<br/><i>Management</i>"]
    end
    
    subgraph PetrolMeta["Petrol Metadata"]
        PM1["Field: Liters (number)"]
        PM2["Field: Density (decimal)"]
        PM3["Field: Fuel Type (enum)"]
        PM4["Field: Rate/Liter (currency)"]
        PM5["Calc: WAC Profit Strategy"]
    end
    
    subgraph EVMeta["EV Metadata"]
        EM1["Field: Opening Meter (number)"]
        EM2["Field: Closing Meter (number)"]
        EM3["Field: Unit Rate (currency)"]
        EM4["Field: NEA Bill Ref (text)"]
        EM5["Calc: Unit Reconciliation"]
    end
    
    BR --> PETROL
    BR --> EV
    BR --> FURNITURE
    BR --> RENTAL
    BR --> LOAN
    
    PETROL --> PetrolMeta
    EV --> EVMeta
```

[🎨 Edit Registry Diagram](https://mermaid.ai/live/edit)

---

### 2. Generic Data Schema (ERD)

```mermaid
erDiagram
    BUSINESS_UNIT ||--o{ TRANSACTION : has
    BUSINESS_UNIT ||--o{ RESOURCE : has
    BUSINESS_UNIT ||--o{ FIELD_TEMPLATE : defines
    TRANSACTION ||--o{ AUDIT_LOG : generates
    USER ||--o{ TRANSACTION : enters
    
    BUSINESS_UNIT {
        uuid id PK
        string code UK
        string name
        string calculation_strategy
        boolean is_active
    }
    
    FIELD_TEMPLATE {
        uuid id PK
        uuid business_id FK
        string field_key
        string field_type
        string label_en
        string label_ne
        jsonb validation_rules
    }
    
    TRANSACTION {
        uuid id PK
        uuid business_id FK
        uuid entered_by FK
        string transaction_type
        date transaction_date
        decimal amount
        jsonb custom_fields
        string status
    }
    
    USER {
        uuid id PK
        string username UK
        string role
        string locale
    }
```

---

### 3. Desktop vs Mobile Viewport

```mermaid
flowchart TB
    subgraph Desktop["🖥️ DESKTOP VIEW (USA Son)"]
        D_CHART1["📊 Revenue Trend Chart"]
        D_CHART2["📈 Business Comparison"]
        D_TABLE["📋 Recent Transactions"]
        D_PENDING["⏳ Pending Reviews"]
    end
    
    subgraph Mobile["📱 MOBILE VIEW (Nepal Dad)"]
        M_BTN1["🛢️ PETROL"]
        M_BTN2["⚡ EV"]
        M_BTN3["🪑 FURNITURE"]
        M_BTN4["🏠 RENTAL"]
        M_BTN5["🏦 LOAN"]
        M_BTN6["➕ ADD NEW"]
    end
```

---

### 4. Layered Architecture with Strategy Pattern

```mermaid
flowchart TB
    subgraph CLIENT["🌐 CLIENT LAYER"]
        REACT["React 18 + Tailwind"]
        PWA["PWA Mobile"]
    end
    
    subgraph API["🔌 API LAYER"]
        REST["REST Controllers"]
        AUTH["JWT Auth"]
    end
    
    subgraph SERVICE["⚙️ SERVICE LAYER"]
        CALC_ENGINE["CalculationEngine"]
        PETROL_STRAT["PetrolStrategy"]
        EV_STRAT["EVStrategy"]
        LOAN_STRAT["LoanStrategy"]
        RENTAL_STRAT["RentalStrategy"]
        FURNITURE_STRAT["FurnitureStrategy"]
    end
    
    subgraph DATA["🗄️ DATA LAYER"]
        H2["H2 Database"]
        IMG["Image Storage"]
    end
    
    CLIENT --> API
    API --> SERVICE
    CALC_ENGINE --> PETROL_STRAT
    CALC_ENGINE --> EV_STRAT
    CALC_ENGINE --> LOAN_STRAT
    SERVICE --> DATA
```

---

## Project Structure

```
samjhana-ventures-os/
├── pom.xml                           # Maven build configuration
├── docs/
│   ├── ARCHITECTURE.md               # This document
│   └── DAD-PROOF-SETUP-GUIDE.md      # Setup guide for Dad
├── src/main/java/com/samjhana/
│   ├── SamjhanaVenturesOsApplication.java
│   ├── entity/
│   │   ├── BusinessUnit.java         # Business unit registry
│   │   ├── FieldTemplate.java        # Dynamic form fields
│   │   ├── Transaction.java          # Universal transaction
│   │   ├── Resource.java             # Employees, Products, Assets
│   │   ├── User.java                 # Dad/Son users
│   │   ├── AuditLog.java             # Change tracking
│   │   └── ImageAttachment.java      # Bill photos
│   └── service/strategy/
│       ├── BusinessCalculationStrategy.java
│       ├── CalculationEngine.java    # Strategy dispatcher
│       ├── PetrolStrategy.java       # WAC profit calculation
│       ├── EVStrategy.java           # Meter reconciliation
│       ├── LoanStrategy.java         # Interest accrual
│       ├── RentalStrategy.java       # Due calculation
│       └── FurnitureStrategy.java    # Stock tracking
├── src/main/resources/
│   └── application.yml               # Configuration
└── frontend/
    ├── package.json
    └── src/
        ├── components/
        │   ├── DynamicFormBuilder.jsx  # Template-driven forms
        │   └── QuickActionButtons.jsx  # Dad's home screen
        ├── i18n/
        │   └── index.js                # Nepali/English translations
        └── utils/
            └── formatters.js           # Lakhs/Crores formatting
```

---

## Key Features

### For Dad (Nepal)
- 📱 Large touch-friendly buttons (2x3 grid)
- 🇳🇵 Nepali language UI with Devanagari numerals
- 📸 Easy photo capture for invoices
- ⌨️ Big number keypad for data entry
- 💚 High contrast, elderly-friendly design

### For Son (USA)
- 📊 Comprehensive dashboards with charts
- ✅ Review and approve pending transactions
- 📈 Business comparison analytics
- 🔍 Audit trail and change history
- 🌐 Remote access via Tailscale VPN

---

## Business Logic Calculations

| Business | Formula |
|----------|---------|
| **Petrol** | Amount = Liters × Rate; Profit = (Sell Rate - WAC) × Liters |
| **EV** | Units = Closing Meter - Opening Meter; Amount = Units × Rate |
| **Loan** | Interest = (Principal × Rate × Days) / 36500 |
| **Rental** | Due = Months Overdue × Monthly Rent |
| **Furniture** | Stock = Initial + In - Out |

---

## Getting Started

### Build & Run
```bash
# Build the complete application (JAR with bundled frontend)
mvn clean package -Pprod

# Run the application
java -jar target/samjhana-ventures-os-1.0.0.jar

# Access at http://localhost:8080
```

### Development
```bash
# Backend only (skip frontend build)
mvn spring-boot:run -Pdev

# Frontend development
cd frontend
npm install
npm run dev
```

---

## Tailscale Setup for Remote Access

1. Install Tailscale on Dad's Nepal computer
2. Install Tailscale on Son's USA laptop
3. Both login with same account
4. Son accesses: `http://dads-pc.tailnet-xxx.ts.net:8080`

---

*Version 1.0.0 | January 2025*
