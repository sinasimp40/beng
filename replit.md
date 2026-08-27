# Digital Marketplace

## Overview

This is a digital e-commerce platform for selling gift cards, rewards points, and premium digital products. The application features a dark, cyberpunk-inspired aesthetic with cryptocurrency payment integration. It includes both a customer-facing storefront and an admin panel for product management. The shop name, logo, and branding are fully customizable through the admin panel.

## Running on Replit

- Use the **Start application** workflow, which runs `npm run dev`.
- The Express and Vite application listens on `0.0.0.0:5000`.
- Apply development database schema changes with `npm run db:push`.
- Validate the project with `npm run check` and `npm run build`.
- Payment gateway, SMTP, reCAPTCHA, and Telegram settings are optional for local startup and can be configured through the admin panel.

## User Preferences

Preferred communication style: Simple, everyday language.

### Product Data Source
- **Source**: Products should be copied from https://xt1.gl/ including images, descriptions, prices, stock counts, and categories
- **Console Logging**: Response body logging (:: [...]) is disabled in server logs for cleaner output
- **Product Images**: Use the xt1.gl static product image URLs (e.g., https://xt1.gl/static/products/...)

### Email Template
- **Default Template**: Order Confirmation email template with dark theme (black background, cyan accents)
- **Template Variables**: {{orderId}}, {{productName}}, {{quantity}}, {{payAmount}}, {{payCurrency}}, {{email}}, {{sentStock}}, {{shopName}}
- **Design**: Matches the success payment modal design with green success icon, order details card, and stock delivery section

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing (home page and admin panel)
- **State Management**: TanStack React Query for server state management with custom query client configuration
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **Theme**: Dark mode by default with light/dark toggle support, using CSS custom properties for theming
- **Theme Customization**: Admin-configurable primary color theme with 10 presets and custom HSL sliders
- **UI Components**: Comprehensive shadcn/ui component library with Radix UI primitives
- **Dynamic Metadata**: Page title, meta description, and favicon update dynamically from admin settings

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful JSON API endpoints under `/api/*` prefix
- **WebSocket**: Real-time payment status updates using the `ws` library
- **Build Process**: Custom build script using esbuild for server bundling and Vite for client

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all database table definitions
- **Current Storage**: In-memory storage implementation (`MemStorage`) with interface designed for database migration
- **Database Config**: Drizzle Kit configured for PostgreSQL with migrations output to `./migrations`

### Payment Integration
- **Provider**: Cryptocurrency payment gateway
- **Supported Currencies**: BTC, ETH, LTC, USDT, DOGE, XMR, XRP, BNB, SOL
- **Payment Flow**: Modal-driven checkout with real-time WebSocket status updates
- **IPN Handling**: Webhook support for payment confirmation with signature verification

### Key Design Patterns
- **Shared Types**: Common schema types shared between client and server via `@shared/*` path alias
- **Modal-Driven UX**: Product details and payment flows use modal dialogs for seamless experience
- **Category Filtering**: Products organized by categories (FLIGHTS, HOTELS, SHOPPING, GIFTCARDS, etc.)
- **Country Support**: Products can be associated with multiple countries using flag-based UI

### Project Structure
```
├── client/           # React frontend application
│   └── src/
│       ├── components/   # UI components including admin panel
│       ├── pages/        # Route page components
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Utilities and providers
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data storage interface
│   └── nowpayments.ts # Payment service integration
├── shared/           # Shared code between client/server
│   └── schema.ts     # Database schema and types
└── migrations/       # Drizzle database migrations
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database (via DATABASE_URL environment variable)
- **Drizzle ORM**: Database access layer with Zod schema validation

### Payment Processing
- **Crypto Gateway API**: Cryptocurrency payment processing
- **Environment Variables**: Requires API key and IPN secret for payment processing

### Email Service
- **Provider**: SMTP via Nodemailer (configurable in admin panel)
- **Settings**: SMTP Host, Port, Secure (SSL/TLS), Username, Password, From Email, From Name
- **Storage**: SMTP settings stored in database settings table (smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, smtp_from_email, smtp_from_name)
- **API Endpoints**: GET/POST /api/settings/smtp, POST /api/settings/smtp/test
- **Admin UI**: SMTP Settings section in Admin Panel Settings tab

### Database Backup System
- **Export/Import**: Full database export to JSON, import from backup files
- **Progress Tracking**: Real-time WebSocket progress updates with 1% granularity
- **Telegram Integration**: Send backups directly to Telegram chat via bot
- **Encryption**: Telegram bot tokens encrypted using AES-256-GCM with persistent encryption key
- **Scheduled Backups**: Configurable auto-backup intervals (hourly, daily, weekly, monthly)
- **API Endpoints**: POST /api/admin/database/export, POST /api/admin/database/import, POST /api/admin/database/send-telegram
- **Security**: All database backup routes protected with requireAdmin middleware
- **Service Files**: server/services/databaseBackupService.ts, server/services/telegramService.ts

### Frontend Libraries
- **React Day Picker**: Calendar component
- **Embla Carousel**: Carousel functionality
- **React Hook Form**: Form management with Zod resolver
- **Lucide React**: Icon library
- **React Icons**: Additional icons (crypto currency symbols)

### Development Tools
- **Vite**: Development server with HMR and production bundling
- **Replit Plugins**: Runtime error overlay, cartographer, and dev banner for Replit environment
