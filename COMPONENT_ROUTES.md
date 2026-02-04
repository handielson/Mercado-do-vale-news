# Component Routes Documentation

## Company Settings Components

### Main Page
**Route**: `/admin/settings/company-data`
**File**: `pages/admin/settings/CompanyDataPage.tsx`
**Description**: Main orchestrator for company data management

### Sub-Components

#### 1. CompanyIdentitySection
**File**: `components/company/CompanyIdentitySection.tsx`
**Location in UI**: First section
**Features**:
- Logo upload (base64)
- Favicon upload (base64)
- Logo URL input (NEW - for receipts/warranties)
- CNPJ with Receita Federal search
- State Registration (IE) with certificate link
- Company name & email
- Phone/WhatsApp
- Receita Federal auto-filled data

**Props**:
- `form: Company`
- `onChange: (updates: Partial<Company>) => void`
- `onCNPJSearch: () => Promise<void>`
- `isLoadingCNPJ: boolean`
- `formatPhone: (value: string) => string`
- `formatCNPJ: (value: string) => string`

---

#### 2. CompanyAddressSection
**File**: `components/company/CompanyAddressSection.tsx` (TO BE CREATED)
**Location in UI**: Second section
**Features**:
- CEP with ViaCEP search
- Street, Number, Complement
- Neighborhood, City, State
- Latitude/Longitude (optional)

---

#### 3. CompanySocialMediaSection
**File**: `components/company/CompanySocialMediaSection.tsx` (TO BE CREATED)
**Location in UI**: Third section
**Features**:
- Instagram
- Facebook
- YouTube
- Website
- Google Reviews link

---

#### 4. CompanyFinancialSection
**File**: `components/company/CompanyFinancialSection.tsx` (TO BE CREATED)
**Location in UI**: Fourth section
**Features**:
- PIX key & type
- PIX beneficiary name
- Bank details (name, agency, account)
- Share payment data button

---

#### 5. CompanyAdditionalInfoSection
**File**: `components/company/CompanyAdditionalInfoSection.tsx` (TO BE CREATED)
**Location in UI**: Fifth section
**Features**:
- Business hours
- Description
- Internal notes

---

#### 6. CompanyDocumentsSection
**File**: `components/company/CompanyDocumentsSection.tsx` (TO BE CREATED)
**Location in UI**: Sixth section
**Features**:
- Document uploader
- Document list

---

## Warranty System Components

### WarrantyTermModal
**File**: `components/warranty/WarrantyTermModal.tsx`
**Route**: Accessed from PDV after sale
**Features**:
- Delivery type selection
- Warranty preview
- 2-copy printing (company & customer)
- Physical signature lines

### WarrantyTemplateEditor
**File**: `components/settings/WarrantyTemplateEditor.tsx`
**Route**: `/admin/settings/documents` → Warranty tab
**Features**:
- HTML template editing
- Live preview with logo
- Tag reference

---

## Receipt Components

### ReceiptPreview
**File**: `components/pdv/ReceiptPreview.tsx`
**Route**: PDV page (right sidebar)
**Features**:
- Standardized header with logo
- Sale details
- Payment breakdown
- Finalize sale button

---

## Quick Navigation

### To add logo URL:
1. Go to: `/admin/settings/company-data`
2. Find: "Identificação da Empresa" section
3. Field: "URL do Logo (Opcional)"
4. Used in: Receipts and Warranty terms

### To edit warranty template:
1. Go to: `/admin/settings/documents`
2. Click: "Garantia" tab
3. Edit HTML template
4. Preview with logo

### To generate warranty:
1. Go to: `/pdv`
2. Complete sale
3. Click: "Gerar Termo de Garantia"
4. Select delivery type
5. Print 2 copies

---

## File Structure

```
components/
├── company/                    # Company data sections
│   ├── CompanyIdentitySection.tsx          ✅ Created
│   ├── CompanyAddressSection.tsx           ⏳ To create
│   ├── CompanySocialMediaSection.tsx       ⏳ To create
│   ├── CompanyFinancialSection.tsx         ⏳ To create
│   ├── CompanyAdditionalInfoSection.tsx    ⏳ To create
│   └── CompanyDocumentsSection.tsx         ⏳ To create
├── warranty/                   # Warranty system
│   ├── WarrantyTermModal.tsx              ✅ Created
│   └── SignaturePad.tsx                   ✅ Created
├── settings/                   # Settings components
│   └── WarrantyTemplateEditor.tsx         ✅ Created
└── pdv/                        # Point of sale
    └── ReceiptPreview.tsx                 ✅ Updated

pages/
└── admin/
    └── settings/
        ├── CompanyDataPage.tsx            ⏳ To refactor (976 lines)
        └── DocumentSettingsPage.tsx       ✅ Updated

services/
├── companyService.ts                      ✅ Updated (logo URL mapping)
└── warrantyDocumentService.ts             ✅ Created

types/
├── company.ts                             ✅ Updated (logoUrl field)
├── companySettings.ts                     ✅ Updated
└── warrantyDocument.ts                    ✅ Created

utils/
└── warrantyTagReplacement.ts              ✅ Created
```

---

## State Management

### CompanyDataPage (Main)
- Manages all form state
- Handles CNPJ/CEP searches
- Handles save operation
- Passes state down to sections via props

### Props Drilling Pattern
```typescript
// Main page
const [form, setForm] = useState<Company>(defaultCompany);

// Pass to sections
<CompanyIdentitySection 
  form={form}
  onChange={(updates) => setForm({ ...form, ...updates })}
  onCNPJSearch={handleCNPJSearch}
  isLoadingCNPJ={isLoadingCNPJ}
  formatPhone={formatPhone}
  formatCNPJ={formatCNPJ}
/>
```

---

## Testing Checklist

### Company Data
- [ ] Logo upload works
- [ ] Logo URL saves and displays
- [ ] CNPJ search populates data
- [ ] CEP search populates address
- [ ] Form save persists data
- [ ] All sections render correctly

### Warranty System
- [ ] Template preview shows logo
- [ ] 2-copy printing works
- [ ] Sale number matches receipt
- [ ] Physical signature lines appear

### Receipt
- [ ] Logo displays in header
- [ ] Layout matches warranty
- [ ] All data displays correctly
