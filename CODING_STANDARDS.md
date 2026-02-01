# 📏 Coding Standards - Mercado do Vale

## 🛡️ ANTIGRAVITY PROTOCOL

### **Component Size Guidelines**

| Component Type | Max Lines | Example |
|----------------|-----------|---------|
| **Simple Components** | 150 lines | Button, Input, Card, Badge |
| **Form Sections** | 300 lines | ProductBasicInfo, ProductPricing |
| **Complex Forms** | 400 lines | ProductForm, CategoryEditModal |
| **Pages** | 500 lines | Dashboard, Settings, Reports |

🔴 **HARD LIMIT: 500 lines** - Anything above MUST be refactored immediately

> **Note:** These limits balance maintainability with practicality. Simple components should stay small, but complex forms can be larger as long as they're well-organized.

### Why These Limits?

- ✅ **Maintainability** - Easier to understand and modify
- ✅ **Testability** - Smaller components are easier to test
- ✅ **Reusability** - Focused components can be reused
- ✅ **Performance** - Smaller bundles, better code splitting
- ✅ **Collaboration** - Reduces merge conflicts

---

## 🚫 SECURITY & INTEGRITY RULES (ANTIGRAVITY PROTOCOL)

### 1. Financial Integrity

**NEVER** use `input type="number"` for currency values:

```tsx
// ❌ BAD: Loses precision, allows decimals
<input type="number" step="0.01" />

// ✅ GOOD: Use CurrencyInput component
<CurrencyInput 
  value={priceInCents} 
  onChange={(cents) => setValue('price', cents)} 
/>
```

### 2. Data Integrity (IMEI/Serial)

**ALWAYS** use specialized inputs for tracking numbers:

```tsx
// ❌ BAD: Allows lowercase, spaces
<input type="text" />

// ✅ GOOD: Forces uppercase and trim
<IMEIInput 
  value={imei} 
  onChange={(value) => setValue('imei', value)} 
/>
```

### 3. Business Rules (Wholesale Security)

**ALWAYS** check client type for wholesale restrictions:

```tsx
// ✅ GOOD: Block credit cards for wholesale
if (clientType === 'atacado') {
  // Remove credit card payment option
  // Remove warranty/guarantee
  // Apply wholesale pricing rules
}
```

### 4. No Magic Strings

**NEVER** use hardcoded strings. Use enums from `field-standards.ts`:

```tsx
// ❌ BAD: Magic strings
if (field === 'imei1') { ... }

// ✅ GOOD: Use enums
import { ProductFields } from '@/utils/field-standards';
if (field === ProductFields.IMEI1) { ... }
```

---

## 🏗️ Component Architecture

### Single Responsibility Principle

Each component should do **ONE thing** well:

```tsx
// ❌ BAD: Component does too much
const ProductForm = () => {
  // 1200 lines handling:
  // - Form state
  // - Image upload
  // - Price calculations
  // - EAN scanning
  // - Validation
  // - API calls
  // - etc...
}

// ✅ GOOD: Focused components
const ProductForm = () => {
  return (
    <>
      <ProductBasicInfo />
      <ProductSpecifications />
      <ProductPricing />
      <ProductImages />
    </>
  )
}
```

### Component Breakdown Guidelines

When a component exceeds 500 lines:

1. **Identify Sections** - Group related UI elements
2. **Extract Sections** - Create separate components
3. **Extract Logic** - Move business logic to hooks
4. **Extract Utils** - Move pure functions to utils

---

## 🪝 Custom Hooks

### When to Create a Hook

Extract logic to a custom hook when:

- Logic is **reused** across components
- Logic is **complex** (>50 lines)
- Logic manages **state** or **side effects**

### Hook Naming

```tsx
// ✅ GOOD: Descriptive names
useProductForm()
useEANAutofill()
useCategoryConfig()

// ❌ BAD: Generic names
useData()
useStuff()
useHelper()
```

---

## 📁 File Organization

### Directory Structure

```
components/
├── products/
│   ├── ProductForm.tsx          (Main component, <300 lines)
│   ├── sections/                (Section components)
│   │   ├── ProductBasicInfo.tsx
│   │   ├── ProductPricing.tsx
│   │   └── ProductImages.tsx
│   └── hooks/                   (Component-specific hooks)
│       ├── useProductForm.ts
│       └── useEANAutofill.ts
├── categories/
│   ├── CategoryEditModal.tsx
│   └── sections/
│       ├── CategoryFieldConfig.tsx
│       └── CategoryAutofillConfig.tsx
└── shared/                      (Reusable components)
    ├── FormField.tsx
    └── ImageUpload.tsx
```

---

## 🎨 Code Style

### Import Organization

```tsx
// 1. React imports
import React, { useState, useEffect } from 'react';

// 2. Third-party imports
import { X, Plus } from 'lucide-react';

// 3. Type imports
import { Product, ProductInput } from '../../types/product';

// 4. Component imports
import { ProductBasicInfo } from './sections/ProductBasicInfo';

// 5. Hook imports
import { useProductForm } from './hooks/useProductForm';

// 6. Utility imports
import { formatPrice } from '../../utils/format';

// 7. Config imports
import { PRODUCT_FIELDS } from '../../config/product-fields';
```

### Component Structure

```tsx
interface Props {
  // Props definition
}

export const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // 1. Hooks
  const [state, setState] = useState();
  const { data } = useCustomHook();
  
  // 2. Derived state
  const computed = useMemo(() => calculate(state), [state]);
  
  // 3. Event handlers
  const handleClick = () => {
    // Handler logic
  };
  
  // 4. Effects
  useEffect(() => {
    // Effect logic
  }, []);
  
  // 5. Early returns
  if (!data) return null;
  
  // 6. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

---

## 🚨 Code Review Checklist

Before committing, verify:

- [ ] No component exceeds 500 lines
- [ ] No file exceeds 30 KB
- [ ] Each component has a single responsibility
- [ ] Complex logic is extracted to hooks
- [ ] Pure functions are in utils
- [ ] Imports are organized
- [ ] TypeScript types are defined
- [ ] No console.logs in production code (except intentional logging)

---

## 📊 Monitoring

Run this command to check component sizes:

```powershell
Get-ChildItem -Path "components" -Recurse -Filter "*.tsx" | 
  Select-Object Name, 
    @{Name="Lines";Expression={(Get-Content $_.FullName).Count}}, 
    @{Name="Size(KB)";Expression={[math]::Round($_.Length/1KB,2)}} |
  Where-Object {$_.Lines -gt 500} |
  Sort-Object Lines -Descending
```

---

## 🎯 Summary

### Golden Rules

1. **500 lines maximum** per component
2. **Single responsibility** per component
3. **Extract hooks** for complex logic
4. **Extract utils** for pure functions
5. **Organize imports** consistently
6. **Review before commit**

**Remember:** Small, focused components are easier to understand, test, and maintain! 🚀
