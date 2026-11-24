# Design Guidelines: E-Commerce Shop Platform

## Design Approach

**Reference-Based Approach**: Drawing primary inspiration from xt1.gl's dark, modern cyberpunk aesthetic, combined with elements from Stripe's payment UIs and modern e-commerce platforms like Shopify for clean transaction flows.

**Key Design Principles**:
- Dark, tech-forward aesthetic with high contrast
- Card-based product grid system
- Modal-driven interactions for seamless purchase flow
- Animated visual elements for engagement
- Clean information hierarchy despite dense product catalogs

---

## Typography

**Font Selection**:
- Primary: Inter or DM Sans (via Google Fonts) - modern, clean sans-serif
- Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

**Type Scale**:
- Hero/Stats Numbers: text-5xl to text-6xl, font-bold
- Section Headers: text-2xl to text-3xl, font-semibold
- Product Titles: text-lg, font-medium
- Product Categories: text-xs uppercase, font-semibold, tracking-wide
- Body Text: text-sm to text-base, font-normal
- Prices: text-xl, font-bold
- Button Text: text-sm, font-medium

---

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, and 16 (e.g., p-4, gap-6, m-8) for consistent rhythm throughout the application.

**Container Strategy**:
- Max-width: max-w-7xl for main content areas
- Padding: px-4 on mobile, px-6 md:px-8 on desktop
- Product Grid: 1 column mobile, 2-3 columns tablet, 4 columns desktop

**Grid System**:
- Product Cards: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
- Admin Form Layouts: Two-column forms on desktop, single column on mobile
- Category Filters: Horizontal scroll on mobile, wrapped flex layout on desktop

---

## Component Library

### Navigation Header
- Logo/brand name (left-aligned)
- Search bar (center-prominent, full-width on mobile)
- Admin/User menu (right-aligned)
- Category navigation pills below header (horizontal scroll)
- Country filter badges with flag icons

### Statistics Dashboard
- Three-column grid displaying: Products Sold, Customers, Reviews
- Large numbers with labels
- Centered alignment with generous spacing

### Product Cards
**Structure**:
- Card container with subtle border and hover elevation
- Product image (square aspect ratio, supports GIF animations)
- Category badge (top-left overlay on image)
- Product title (2-line truncation)
- Country flag indicators (small circular badges)
- Stock counter with icon
- Price (large, bold)
- "Buy Now" button (full-width, primary style)

**Interactions**:
- Hover: Subtle scale transform (scale-105) and shadow increase
- Click: Opens product detail modal

### Category Filter Pills
- Pill-shaped buttons with rounded-full
- Active state: Filled background with prominent styling
- Inactive: Border-only with transparent fill
- Uppercase text with tight letter-spacing
- Horizontal scrollable on mobile

### Modal System

**Product Detail Modal**:
- Centered overlay with backdrop blur
- Large product image showcase (supports GIF)
- Product information: title, category, description, specifications
- Country availability with flag badges
- Stock indicator with real-time count
- Quantity selector
- Prominent "Buy Now" button leading to payment modal
- Close button (X) in top-right corner

**Payment Modal (NOWPayments)**:
- Compact, focused layout
- Order summary section (product, quantity, total)
- Cryptocurrency payment options
- Payment status indicator
- QR code display for crypto address
- Transaction timer/countdown
- Success/failure state handling

### Admin Panel Components

**Product Management Table**:
- Sortable columns: Image, Name, Category, Price, Stock, Countries, Actions
- Inline edit capabilities
- Delete confirmation
- Bulk actions toolbar

**Product Form (Create/Edit)**:
- Image upload with preview (supports GIF)
- Text inputs: Name, Description
- Dropdown: Category selection
- Number inputs: Price, Stock count
- Multi-select: Country flags
- Rich text editor for detailed descriptions
- Save/Cancel action buttons

### Buttons
- Primary: Filled with high contrast, used for main CTAs
- Secondary: Outlined style for alternative actions
- Danger: Red-toned for delete operations
- Sizes: Small (admin actions), Medium (default), Large (primary CTAs)
- All buttons include hover and active states with smooth transitions

### Form Inputs
- Consistent border styling with focus states
- Label positioning above inputs
- Placeholder text for guidance
- Error states with red accents and helper text
- Success states with green accents

---

## Images

### Hero Section
**Not applicable** - This is a product catalog shop, no traditional hero needed. The site leads with the category navigation and immediately displays the product grid.

### Product Images
- **Location**: Primary visual in each product card, large display in product modal
- **Type**: Square aspect ratio (1:1), support for both static images and animated GIFs
- **Style**: Products on transparent or simple backgrounds, high-quality photography
- **Fallback**: Placeholder with product category icon if no image provided

### Admin Interface
- **No images needed** for admin panel - focus on data tables and forms

### Icon Usage
- Category icons: Use Font Awesome or Heroicons via CDN
- UI icons: Shopping cart, search, filter, close (X), edit, delete, flag icons
- Payment icons: Cryptocurrency logos from NOWPayments branding

---

## Visual Treatment Notes

**Background**:
- Primary background: Very dark (near black)
- Card backgrounds: Slightly lighter dark shade for contrast
- Subtle gradient or pattern overlay for depth

**Borders & Dividers**:
- Subtle borders in dark gray/charcoal tones
- Avoid harsh white borders - keep it dark and sleek

**Elevation & Depth**:
- Product cards: Subtle shadow on hover, increased on active
- Modals: Strong backdrop blur with prominent shadow
- Layering: Clear z-index hierarchy for overlays

**Country Flags**:
- Small circular badges (24x24px)
- Display inline for product cards
- Larger badges (32x32px) in product detail modal
- Support for multiple flags per product

**Animations**:
- Card hover transforms (scale, shadow)
- Modal enter/exit transitions (fade + scale)
- Button interactions (subtle press effect)
- Loading states for payment processing
- Avoid excessive motion - keep it purposeful

This design creates a modern, professional e-commerce platform with a distinctive dark aesthetic that balances visual impact with usability and efficient product browsing.