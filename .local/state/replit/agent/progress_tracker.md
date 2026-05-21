[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Verify the project is working using the feedback tool
[x] 4. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool
[x] 5-78. Previous migration and feature tasks (all completed)
[x] 79. Final import completion (Dec 15, 2025)
[x] 80. Feature Updates (Dec 15, 2025):
    - Country filter logic verified correct (ww filters to worldwide products)
    - Added ~200 countries with flag icons to shared/schema.ts
    - Updated product-form.tsx with searchable country selector
    - Redesigned search-bar.tsx with premium gradient glow effect
    - Added dynamic banner upload in shop-settings.tsx
    - Updated support-banner.tsx to load from settings
    - Updated server/routes.ts with banner_url setting
[x] 81. Environment migration complete (Dec 15, 2025):
    - npm dependencies installed
    - Workflow running successfully on port 5000
    - Application verified working via screenshot
[x] 82. UI/UX Improvements (Dec 15, 2025):
    - Removed banner image upload from shop settings (URL only now)
    - Fixed admin panel tabs responsive design (icon-only on mobile, scrollable)
    - Product grid now shows 1 column on mobile, 2 on tablet, 4 on desktop
    - Redesigned search bar with premium cyan gradient border
    - Added xs breakpoint (480px) to tailwind config
[x] 83. Final import verification (Dec 15, 2025):
    - npm install completed successfully
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot
    - Import marked as complete
[x] 84. Admin Panel Mobile Navigation Redesign (Dec 15, 2025):
    - Replaced horizontal scrolling tabs with dropdown menu on mobile
    - Mobile: Shows Select/dropdown with icon + label for each tab
    - Desktop: Shows horizontal tabs with icon + label
    - Better UX - no more side-by-side scrolling on mobile devices
[x] 85. Order Status Real-time Updates & Stock Display Fix (Dec 15, 2025):
    - Added WebSocket real-time updates to admin users tab (useOrderUpdates hook)
    - Enhanced useOrderUpdates hook to support isAdmin mode with proper query invalidation
    - Added trust proxy to Express for proper IP address detection behind proxies
    - Payment success modal now displays purchased stock information
    - Fixed: Order status now auto-updates across all views (user panel, admin users tab)
[x] 86. Environment Re-migration (Dec 16, 2025):
    - npm install completed successfully
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot
    - Import complete
[x] 87. Final Environment Migration (Dec 16, 2025):
    - npm dependencies installed successfully
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (ShopX storefront displaying correctly)
    - All systems operational
[x] 88. Payment Success Modal Stock Display Fix (Dec 16, 2025):
    - Fixed: fetchOrderStock function now properly handles wrapped { order: {...} } response
    - The backend returns order data wrapped in an object, frontend now correctly destructures it
    - Purchased stock items will now display in the payment success modal after payment confirmation
[x] 89. Environment Migration (Dec 16, 2025):
    - npm dependencies already installed and up to date
    - Workflow restarted successfully on port 5000
    - Application verified working via screenshot (ShopX storefront displaying correctly)
    - Import complete
[x] 90. Bug Fixes Session (Dec 16, 2025):
    - Fixed reCAPTCHA not appearing in forgot password modal: uses grecaptcha.reset() for mode changes
    - Fixed export/import database 401 Unauthorized: added SSR-safe auth headers to API requests
    - Fixed Telegram backup 401 error: auth headers now included in all authenticated endpoints
    - Fixed admin page accessible after logout: proper auth guard with loading states and redirect
[x] 91. Environment Migration (Dec 16, 2025):
    - Fixed missing asset file error in support-banner.tsx
    - Removed hardcoded asset import, now gracefully handles missing banner
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (ShopX storefront displaying correctly)
    - Import complete
[x] 92. Database Import Loading Fix (Dec 16, 2025):
    - Fixed: Import JSON loading spinner would get stuck indefinitely
    - Issue: isImporting state was never reset to false after successful import
    - Solution: Added proper state reset in finally block, success/error toasts, and progress clearing
    - Import now properly shows success message and clears loading state after completion
[x] 93. reCAPTCHA Modal Fix (Dec 16, 2025):
    - Fixed: reCAPTCHA not appearing/loading correctly when switching between login/forgot password modes
    - Each modal mode (login, register, forgot) now has its own separate reCAPTCHA container
    - When switching modes: old reCAPTCHA is destroyed, new one is created for the new mode
    - reCAPTCHA positioned above submit buttons in all modals (Sign In, Create Account, Send Reset Link)
    - Fixed: Container cleared properly when switching modes to prevent duplicate widget errors
[x] 94. Auth Guards & Database Import Logout Fix (Dec 16, 2025):
    - Fixed: User is now logged out automatically after successful database import
    - Database import now shows "Logging out..." message and redirects to home page
    - Fixed: Dashboard page now properly redirects to home if user is not logged in
    - Added proper loading state to dashboard while checking authentication
    - Admin panel already had proper auth guards (verified working)
    - No cached bugs found - all protected pages now properly guard against unauthenticated access
[x] 95. reCAPTCHA Challenge Close Fix (Dec 16, 2025):
    - Fixed: reCAPTCHA widget now properly resets when user closes the challenge popup
    - Added error-callback to reCAPTCHA render options
    - When user closes challenge (clicks X or outside), widget resets so user can try again
    - Applies to all modals: login, register, and forgot password
[x] 96. Environment Migration (Dec 16, 2025):
    - npm dependencies installed successfully
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (ShopX storefront displaying correctly)
    - Import complete
[x] 97. Environment Migration (Dec 16, 2025):
    - npm dependencies installed successfully
    - Database schema pushed (tables created)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (ShopX storefront displaying correctly)
    - Import complete
[x] 98. reCAPTCHA Disappearing on Input Focus Fix (Dec 16, 2025):
    - Fixed: reCAPTCHA widget disappearing when user clicks on email input after closing challenge
    - Root cause: RecaptchaWidget was defined inside AuthModal component, causing DOM unmount/remount on every re-render
    - Solution: Changed to stable renderStableRecaptcha function that uses display:none/flex instead of conditional rendering
    - reCAPTCHA container now stays in DOM but is hidden when not needed
    - Applies to all modals: login, register, and forgot password
[x] 99. Telegram Test Connection "Failed" Toast Fix (Dec 16, 2025):
    - Fixed: Test Connection button showing "Failed" even when message is successfully delivered to Telegram
    - Root cause: apiRequest returns Response object, but code was treating it as parsed JSON without calling .json()
    - Solution: Added res.json() call to properly parse the API response before reading success/message fields
    - Now correctly shows "Success" toast when Telegram message is delivered
[x] 100. Environment Migration (Dec 16, 2025):
    - npm dependencies installed successfully (npm install)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (ShopX storefront displaying correctly)
    - Import complete
[x] 101. Premium Close Warning for All Modals (Dec 16, 2025):
    - Created reusable CloseWarningDialog component with premium design
    - Premium design features:
      - Gradient backgrounds with subtle glow effects
      - ShieldAlert icon with animated pulse glow
      - Dark glass-like modal with cyan gradient accents
      - Cyan gradient "Yes, Close" button with shadow
      - Clean "Stay Here" secondary button
    - Applied to all modals:
      - Product Detail Modal: Shows warning when closing product view
      - Payment Modal: Shows warning during checkout/payment process (except success/error states)
      - Auth Modal: Shows warning only if user has entered data
    - Each modal has context-appropriate title and description messages
    - Prevents accidental modal closure and loss of user progress
[x] 102. Environment Migration (Dec 16, 2025):
    - npm dependencies installed successfully
    - Database schema pushed (tables created)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (ShopX storefront displaying correctly)
    - Import complete
[x] 103. Real-time Order Updates & IP Detection Fix (Dec 16, 2025):
    - Fixed: User panel and admin users tab view orders modal now update instantly via WebSocket
    - Added invalidation for per-user order queries (["/api/admin/users", email, "orders"])
    - Fixed: IP address now properly captured using req.ip (which respects trust proxy setting)
    - IP detection order: req.ip > x-forwarded-for > x-real-ip > socket.remoteAddress > unknown
    - New orders will now show actual IP address instead of "Unknown"
[x] 104. Environment Migration (Dec 16, 2025):
    - npm dependencies installed successfully (npm install)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (ShopX storefront displaying correctly)
    - Import complete
[x] 105. Database Import Settings Fix (Dec 16, 2025):
    - Fixed: Settings (payment, SMTP, Telegram, reCAPTCHA) not importing correctly from JSON backup
    - Root cause: Settings table has unique constraint on 'key' column, but import used onConflictDoNothing() based on primary key (id)
    - When settings with same keys but different IDs were imported, unique constraint violation caused silent failures
    - Solution: Added special handling for settings table using proper upsert logic:
      - Check if setting with same key exists
      - If exists: UPDATE the value
      - If not: INSERT new setting
    - All settings (nowpayments_api_key, smtp_host, smtp_password, telegram_bot_token, etc.) now import correctly
[x] 106. Order IP Address Capture Fix (Dec 16, 2025):
    - Fixed: IP address showing as "Unknown" for all orders in admin panel
    - Root cause: The payment creation endpoint (/api/payments/create) was not capturing the client IP address
    - Orders were being created without the ipAddress field when users initiated payments
    - Solution: Added IP address capture to the payment creation endpoint:
      - Uses req.ip (respects trust proxy setting)
      - Fallback to x-forwarded-for header
      - Fallback to x-real-ip header
      - Fallback to socket.remoteAddress
    - New orders will now properly log the visitor's IP address
[x] 107. Environment Migration (Dec 17, 2025):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (ShopX storefront displaying correctly)
    - Import complete
[x] 108. Environment Migration (Dec 17, 2025):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (ShopX storefront displaying correctly)
    - Import complete
[x] 109. Environment Migration (Dec 17, 2025):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (ShopX storefront displaying correctly)
    - Import complete
[x] 110. Environment Migration (Dec 17, 2025):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (BuyBit storefront displaying correctly)
    - Import complete
[x] 111. Environment Migration (Dec 17, 2025):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (BuyBit storefront displaying correctly)
    - Import complete
[x] 112. Environment Migration (Dec 17, 2025):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (BuyBit storefront displaying correctly)
    - Import complete
[x] 113. Social Widget Improvements (Dec 17, 2025):
    - Removed outer glow effect from social widget floating button
    - Removed glow effect from widget modal/panel
    - Added 14 new social media platforms: Instagram, X (Twitter), Discord, YouTube, WhatsApp, Facebook, TikTok, LinkedIn, Reddit, Twitch, Snapchat, Pinterest, GitHub
    - Each platform has its own brand-colored icon
    - Widget floating button now uses the first link's platform icon
    - Admin panel shows icon preview next to platform selector
    - All changes verified working
[x] 114. Metadata & Widget Icon Update (Dec 17, 2025):
    - Removed "Digital Marketplace" from all metadata (page title, meta description, og:title)
    - Now just shows the shop name only (e.g., "BuyBit" instead of "BuyBit - Digital Marketplace")
    - Updated index.html default values
    - Updated use-shop-settings.ts dynamic metadata
    - Changed widget floating button to use generic message/contact icon (cyan/blue gradient)
    - More professional and neutral appearance for contact widget
[x] 115. Environment Migration (Dec 17, 2025):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (BuyBit storefront displaying correctly)
    - Import complete
[x] 116. Responsive Design Fixes (Dec 17, 2025):
    - Fixed banner being cut off on mobile: now uses w-full on mobile, maxWidth: 100% instead of fixed 900px
    - Fixed main content padding: reduced to px-2 on mobile for more space
    - Added bottom padding (pb-20) on mobile to account for social widget floating button
    - Social widget button position adjusted: bottom-4 right-4 on mobile, bottom-6 right-6 on desktop
    - Social widget panel width adjusted: calc(100%-2rem) on mobile for proper margins
    - Fixed LSP type error in product-card.tsx for null countries array
[x] 117. Environment Migration (Dec 17, 2025):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (BuyBit storefront displaying correctly)
    - Import complete
[x] 118. Remove Default Favicon & Title Flash Fix (Dec 17, 2025):
    - Removed default "BuyBit" title from index.html (now empty)
    - Removed default favicon.png from client/public folder
    - Cleared all default meta tags (description, og:title, og:description, keywords)
    - No more flash of default branding before user's custom settings load
    - User's database settings will now be the first thing displayed
[x] 119. Favicon Flash Fix (Dec 17, 2025):
    - Fixed: Browser showing cached favicon from other sites before custom logo loads
    - Added transparent 1x1 pixel PNG as default favicon using base64 data URI
    - Prevents browser from looking for default favicon.ico at root
    - Custom shop logo will replace the transparent placeholder when loaded
[x] 119. Environment Migration (Dec 17, 2025):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (storefront displaying correctly)
    - Import complete
[x] 120. Environment Migration (Jan 20, 2026):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (storefront displaying correctly)
    - Import complete
[x] 121. Theme Color Customization Feature (Jan 20, 2026):
    - Added new "Theme" tab to admin panel with Palette icon
    - Created ThemeSettings component with:
      - 10 preset color themes (Cyan, Blue, Purple, Pink, Red, Orange, Yellow, Green, Teal, Emerald)
      - Custom HSL sliders (Hue 0-360, Saturation 0-100%, Lightness 20-80%)
      - Live preview of buttons and badges
      - Color swatch preview showing current selection
      - Reset to default (Cyan) functionality
    - Created useThemeColors hook that:
      - Fetches theme settings from database
      - Applies CSS custom properties dynamically to entire site
      - Updates all theme-related colors: primary, accent, ring, sidebar, charts
      - Listens for dark/light mode changes and reapplies theme
      - Reverts preview changes when leaving admin without saving
    - Added API routes for theme settings:
      - GET /api/settings/theme (public - for visitors to see theme)
      - POST /api/settings/theme (admin-only with validation)
    - Colors apply to: buttons, links, search bar glow, card hovers, charts, accents, modals, and all components
[x] 122. Environment Migration (Jan 20, 2026):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (storefront displaying correctly)
    - Import complete
[x] 123. Database Import Settings & Order Status Sync Fix (Jan 20, 2026):
    - Fixed: Settings not importing correctly from backup.json (Payment, SMTP, Telegram settings)
    - Root cause: Encryption key from backup was different from current database
    - Solution: Import encryption_key FIRST before other settings, then clear the cached key
    - This ensures encrypted values (telegram_bot_token, etc.) can be decrypted correctly
    - Added new "Sync Status" button in Orders tab to sync order statuses from NOWPayments
    - Sync feature checks all pending orders against NOWPayments and updates to correct status
    - Maps NOWPayments statuses: waiting/confirming/confirmed → pending, finished → completed, expired → expired
[x] 124. Environment Migration (Jan 21, 2026):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (storefront displaying correctly)
    - Import complete
[x] 125. Environment Migration (Jan 23, 2026):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (storefront displaying correctly)
    - Import complete
[x] 126. Environment Migration (Jan 23, 2026):
    - npm dependencies installed successfully (npm install)
    - Database schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (storefront displaying correctly)
    - Import complete
[x] 127. Database Import Settings Reload Fix (Jan 23, 2026):
    - Fixed: NOWPayments, SMTP, and Telegram settings not working after JSON import on Hostinger
    - Root cause: Services read from environment variables (`process.env`), not directly from database
    - Settings were imported to database correctly, but `process.env` was not updated
    - Solution: Added settings reload after database import completes:
      - Reloads NOWPayments API key and IPN secret into `process.env`
      - Reloads reCAPTCHA keys into `process.env`
      - Reloads SMTP settings and updates emailService configuration
    - Now all settings work immediately after import without needing server restart
[x] 128. Reviews Export/Import & Telegram Token Fix (Jan 23, 2026):
    - Fixed: Reviews table was NOT included in database export/backup
    - Added `reviews` table to TABLES array in databaseBackupService.ts
    - Added reviews import handling with proper upsert logic (update if exists, insert if new)
    - Fixed: Telegram bot token encryption failing during import
    - Root cause: After importing encryption_key, cache was cleared but not reloaded
    - The encryptToken() function uses getEncryptionKeySync() which threw error on empty cache
    - Solution: After clearing cache, immediately call await getEncryptionKey() to reload the imported key
    - Now Telegram token is properly encrypted during import using the correct encryption key
    - Reviews and Telegram settings now fully work after JSON import
[x] 129. Environment Migration (Feb 18, 2026):
    - npm dependencies installed successfully (npm install)
    - Database created and schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (storefront displaying correctly)
    - Import complete
[x] 130. Announcement Bar Feature (Feb 18, 2026):
    - Added Announcement Bar section to admin shop-settings.tsx:
      - Enable/disable toggle switch
      - Text area for announcement messages
      - Support for rotating messages using /n separator
      - Preview section showing all messages
      - Rotating Messages help text with examples
    - Updated backend routes (GET/POST /api/settings/shop) to save/load:
      - announcement_enabled (stored as string "true"/"false")
      - announcement_text (raw text with /n separators)
    - Created AnnouncementBar component (client/src/components/announcement-bar.tsx):
      - Displays below header on homepage
      - Rotates messages every 2 seconds with smooth pan transition
      - Megaphone navigation icons on left/right sides
      - Listens for shopSettingsUpdated events for real-time updates
    - Integrated into home.tsx below the header
[x] 131. Environment Migration (Feb 22, 2026):
    - npm dependencies installed successfully (npm install)
    - Database created and schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (storefront displaying correctly)
[x] 132. Feature Updates (Feb 22, 2026):
    - Fixed theme flash: Shop settings (name, logo) now cached in localStorage for instant display
    - Added product enable/disable with toggle in admin, disabled products hidden from storefront
    - Added hot product feature with animated HOT badge and priority sorting
    - Added product sorting: Default, Price Low/High, Name A-Z/Z-A dropdown in search bar
[x] 133. Environment Migration (Feb 22, 2026):
    - npm dependencies installed successfully (npm install)
    - Database created and schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (storefront displaying correctly)
    - Import complete
[x] 134. HOT Product & Reviews Redesign (Feb 22, 2026):
    - Redesigned HOT product indicator: removed overlay badge, added glowing orange/red border around entire card
    - Added flame icons flanking the product name in the title bar for hot products
    - Subtle pulsing border glow animation that works on any product image background
    - Redesigned reviews page with Trustpilot-style layout:
      - Summary card with overall rating score, star breakdown bars, and rating label (Excellent/Great/etc.)
      - Individual review cards with star ratings, customer initials avatar, verified badge, time-ago dates
      - Clean emerald green color scheme for stars and verified badges
    - Updated admin panel reviews to include Customer Name and Rating fields
    - Admin review table now shows Customer, Rating (stars), Review, Date columns
    - Added proper data-testid attributes to key display elements
    - Fixed plural grammar in time-ago display (1 week ago vs 1 weeks ago)
[x] 135. HOT Badge & Reviews Fixes (Feb 22, 2026):
    - Reverted HOT badge to original overlay style, moved to top-right corner of product image
    - Removed glowing border and flame icons from product cards
    - Removed summary dashboard from reviews page
    - Removed customer name/avatar from review cards
    - Changed review stars and verified badge from green to theme primary color
    - Reviews now show: star rating, comment text, time ago, and verified purchase badge
[x] 136. Review Cards Light/Dark Mode & Animations (Feb 22, 2026):
    - Fixed review cards to properly adapt to light/dark mode (bg-card, text-foreground, border-border)
    - Moved star ratings to bottom of each review card
    - Changed stars to yellow/gold color with pop-in animation
    - Changed verified badge to green with glow pulse animation
    - Added fade-in-up animation for review cards on page load
    - All text colors now use theme-aware classes (foreground, muted-foreground)
[x] 137. Product Card & Review Card Animations (Feb 22, 2026):
    - Animated product card title bar: theme color glow sweeps across with pulse effect
    - Added titleGlowSwipe and titlePulse keyframe animations
    - Review cards now have theme color accents: top gradient line, left side stripe, subtle bg gradient
    - Moved verified badge to bottom-right, next to stars at bottom-left
    - Date moved to top-left alone for cleaner layout
[x] 138. Environment Migration (Feb 23, 2026):
    - npm dependencies installed successfully (npm install)
    - Database created and schema pushed (tables created with drizzle-kit push)
    - Workflow restarted and running on port 5000
    - Application verified working via screenshot (storefront displaying correctly)
    - Import complete
[x] 139. Update System Security & Reliability Fix (Feb 23, 2026):
    - Fixed: GitHub repo owner/name was visible in admin Updates tab (security leak)
    - Backend no longer sends repoDisplay with owner/repo info - only shows "Connected" status
    - Removed commit hash and repo name display from frontend
    - Fixed: Update process now uses safe staging approach:
      1. Downloads ALL files to .update_staging/ temp directory first
      2. Copies package.json and runs npm install BEFORE touching existing code
      3. Only after dependencies succeed, applies file changes to live code
      4. Old files are NOT deleted until after build succeeds
      5. On any failure, staging dir is cleaned up and existing code stays untouched
    - Added download error threshold: aborts if >10% of files fail to download
    - Added .update_staging/ to ignore patterns so it's not tracked
    - pm2 restart still happens last (after build + schema sync complete)
[x] 140. Environment Migration (May 20, 2026):
    - Fixed tsx not found: updated npm scripts to use node_modules/.bin/tsx
    - Fixed Vite allowedHosts for Replit proxy environment
    - Fixed Vite HMR WebSocket: configured REPLIT_DEV_DOMAIN for wss:// protocol
    - Fixed WebSocket conflict: converted all app WebSocket servers to noServer mode
      with manual upgrade router so Vite HMR path is not intercepted
    - Fixed global rate limiter: added /vite-hmr and /ws/ to skip list
    - Database schema pushed (drizzle-kit push)
    - Workflow running and serving on port 5000
    - Vite HMR connected ([vite] connected.)
    - All API endpoints responding correctly
    - Import complete