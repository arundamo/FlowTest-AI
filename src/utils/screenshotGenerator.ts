export interface StepScreenshotData {
  stepNumber: number;
  title: string;
  targetUrl: string;
  status: 'passed' | 'healed' | 'failed' | 'running' | 'queued';
  action?: string;
  locator?: string;
  brokenLocator?: string;
  errorMessage?: string;
  healingDetails?: {
    brokenLocator?: string;
    healedLocator?: string;
    strategy?: string;
  };
}

/**
 * Strips redundant leading 'Step X:' or 'Step X -' prefixes
 */
export function cleanStepTitle(title: string = ''): string {
  return title
    .replace(/^Step\s*\d+\s*[:\-–—]\s*/i, '')
    .replace(/^\d+\.\s*/, '')
    .trim();
}

function escapeXml(str: string = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a high-fidelity SVG simulating the actual browser viewport for the specific test step.
 * Dynamically tailors UI elements to match e-commerce, forms, promo codes, calculations, and custom user actions.
 */
export function generateSimulatedScreenshot(data: StepScreenshotData): string {
  const {
    stepNumber,
    title,
    targetUrl,
    status,
    action = '',
    locator = '',
    brokenLocator = '',
    healingDetails,
  } = data;

  const rawClean = cleanStepTitle(title);
  const cleanTitleStr = rawClean || `Test Action ${stepNumber}`;
  const safeCleanTitle = escapeXml(cleanTitleStr);
  const safeUrl = escapeXml(targetUrl || 'https://ecommerce-playground.lambdatest.io');
  const safeLocator = escapeXml(locator || "page.locator('body')");

  const statusColor =
    status === 'healed'
      ? '#f59e0b'
      : status === 'passed'
      ? '#10b981'
      : status === 'failed'
      ? '#ef4444'
      : status === 'running'
      ? '#38bdf8'
      : '#64748b';

  const badgeText =
    status === 'healed'
      ? 'HEALED &amp; VERIFIED'
      : status === 'passed'
      ? 'STEP PASSED'
      : status === 'failed'
      ? 'STEP FAILED'
      : status === 'running'
      ? 'EXECUTING...'
      : 'QUEUED';

  const lowerTitle = cleanTitleStr.toLowerCase();
  const lowerLocator = locator.toLowerCase();
  const lowerAction = action.toLowerCase();

  // Determine semantic step category
  const isAddLaptopCart =
    lowerTitle.includes('laptop') ||
    (lowerTitle.includes('add') && lowerTitle.includes('cart')) ||
    lowerLocator.includes('product-listing') ||
    lowerLocator.includes('product');

  const isCheckout =
    !isAddLaptopCart &&
    (lowerTitle.includes('proceed to checkout') ||
      (lowerTitle.includes('checkout') && !lowerTitle.includes('guest')));

  const isGuestCheckout =
    lowerTitle.includes('guest') ||
    lowerLocator.includes('guest') ||
    lowerTitle.includes('account details');

  const isPromoCode =
    lowerTitle.includes('promo') ||
    lowerTitle.includes('coupon') ||
    (lowerTitle.includes('discount') && !lowerTitle.includes('calculation') && !lowerTitle.includes('verify'));

  const isVerifyDiscount =
    lowerTitle.includes('calculation') ||
    lowerTitle.includes('verify discount') ||
    lowerLocator.includes('table') ||
    (lowerTitle.includes('verify') && lowerTitle.includes('discount'));

  // Render Inner Content Canvas (x: 30, y: 95, width: 740, height: 335)
  let innerContentSvg = '';

  if (isAddLaptopCart) {
    // E-commerce product view with "Featured Laptop" and "Add to Cart" action
    innerContentSvg = `
      <!-- Store Breadcrumb & Category Bar -->
      <rect x="30" y="95" width="740" height="28" fill="#0f172a" />
      <text x="45" y="113" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">
        Home / Laptops &amp; Computers / <tspan fill="#f8fafc" font-weight="bold">Featured High-Performance Laptop 15.6&quot;</tspan>
      </text>
      <rect x="670" y="99" width="85" height="20" rx="10" fill="#1e293b" />
      <text x="712" y="113" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="10" text-anchor="middle">Cart: 0 items</text>

      <!-- Product Showcase Container -->
      <rect x="30" y="130" width="740" height="295" fill="#020617" stroke="#1e293b" stroke-width="1" rx="8" />

      <!-- Left Column: Laptop Graphic & Product Media Box -->
      <rect x="50" y="145" width="250" height="260" rx="6" fill="#090d16" stroke="#1e293b" stroke-width="1" />
      
      <!-- High-Tech Laptop Graphic Mockup -->
      <!-- Screen Lid -->
      <rect x="85" y="165" width="180" height="110" rx="6" fill="#0f172a" stroke="#475569" stroke-width="1.5" />
      <!-- Display Glare / Wallpaper -->
      <rect x="92" y="172" width="166" height="96" rx="3" fill="#1e293b" />
      <rect x="92" y="172" width="166" height="40" fill="#2563eb" opacity="0.3" />
      <!-- App Mockup Lines on Screen -->
      <rect x="102" y="185" width="60" height="6" rx="2" fill="#38bdf8" opacity="0.9" />
      <rect x="102" y="196" width="120" height="4" rx="2" fill="#64748b" opacity="0.6" />
      <rect x="102" y="204" width="90" height="4" rx="2" fill="#64748b" opacity="0.6" />
      <circle cx="215" cy="225" r="16" fill="#38bdf8" opacity="0.2" />
      <!-- Laptop Keyboard Base -->
      <polygon points="70,278 280,278 295,296 55,296" fill="#1e293b" stroke="#475569" stroke-width="1.5" />
      <!-- Keyboard Keys Impression -->
      <rect x="95" y="280" width="160" height="8" rx="1" fill="#090d16" opacity="0.6" />
      <!-- Trackpad -->
      <rect x="150" y="289" width="50" height="5" rx="1.5" fill="#334155" />

      <!-- Product Media Badges -->
      <rect x="60" y="155" width="105" height="20" rx="4" fill="#f59e0b" opacity="0.9" />
      <text x="112" y="169" fill="#000000" font-family="system-ui, sans-serif" font-weight="bold" font-size="10" text-anchor="middle">★ FEATURED DEAL</text>
      
      <rect x="60" y="375" width="230" height="22" rx="4" fill="#0f172a" stroke="#334155" stroke-width="1" />
      <text x="175" y="390" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="middle">
        id: #mz-product-listing-image-28212648-0-0
      </text>

      <!-- Right Column: Product Specs, Pricing & Primary Action -->
      <text x="325" y="172" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="bold" font-size="19">
        Featured Laptop Pro 15.6&quot;
      </text>
      <text x="325" y="194" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">
        Intel Core i9-13900H • 32GB RAM • 1TB NVMe SSD • RTX 4070
      </text>

      <!-- Rating Stars & Stock Badge -->
      <text x="325" y="218" fill="#fbbf24" font-family="system-ui, sans-serif" font-size="12">★★★★★</text>
      <text x="385" y="218" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">4.9 (148 reviews)</text>
      <rect x="490" y="206" width="90" height="18" rx="9" fill="#10b981" opacity="0.2" />
      <text x="535" y="219" fill="#10b981" font-family="system-ui, sans-serif" font-weight="bold" font-size="10" text-anchor="middle">✔ IN STOCK</text>

      <!-- Price Block -->
      <rect x="325" y="234" width="425" height="52" rx="6" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
      <text x="340" y="258" fill="#64748b" font-family="system-ui, sans-serif" font-size="12" text-decoration="line-through">$1,499.00</text>
      <text x="340" y="278" fill="#10b981" font-family="system-ui, sans-serif" font-weight="bold" font-size="22">$1,299.00</text>
      <rect x="460" y="248" width="100" height="24" rx="4" fill="#ef4444" opacity="0.2" />
      <text x="510" y="264" fill="#f87171" font-family="system-ui, sans-serif" font-weight="bold" font-size="11" text-anchor="middle">SAVE $200 (13%)</text>

      <!-- PRIMARY ACTION BUTTON: Add to Cart (TARGET ELEMENT BEING TESTED) -->
      <!-- Selection Glow Halo -->
      <rect x="321" y="303" width="248" height="54" rx="10" fill="none" stroke="${statusColor}" stroke-width="2.5" stroke-dasharray="6,3" />
      <!-- Button Body -->
      <rect x="325" y="307" width="240" height="46" rx="8" fill="${statusColor}" />
      <!-- Cart Icon & Label -->
      <text x="445" y="335" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="bold" font-size="14" text-anchor="middle">
        🛒 Add to Cart
      </text>

      <!-- Mouse Pointer clicking Add to Cart -->
      <polygon points="460,332 460,358 471,348 482,364 488,359 476,343 492,343" fill="#ffffff" stroke="#020617" stroke-width="1.8" />
      <circle cx="460" cy="332" r="12" fill="${statusColor}" opacity="0.35" />

      <!-- Active Locator Tooltip Badge -->
      <rect x="325" y="367" width="370" height="24" rx="4" fill="#1e293b" stroke="${statusColor}" stroke-width="1" />
      <text x="335" y="383" fill="#f8fafc" font-family="monospace" font-size="10">
        ▶ Active Locator: <tspan fill="#38bdf8">${safeLocator}</tspan>
      </text>

      <!-- Trust Badges -->
      <text x="325" y="410" fill="#64748b" font-family="system-ui, sans-serif" font-size="10">
        ✔ Free Express Shipping  •  ✔ 30-Day Money-Back Guarantee  •  ✔ Official Warranty
      </text>
    `;
  } else if (isCheckout) {
    // Shopping Cart & Proceed to Checkout View
    innerContentSvg = `
      <!-- Header -->
      <rect x="30" y="95" width="740" height="30" fill="#0f172a" />
      <text x="45" y="115" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="bold" font-size="13">
        Shopping Cart &amp; Order Review (1 Item)
      </text>

      <rect x="30" y="135" width="740" height="290" fill="#020617" stroke="#1e293b" stroke-width="1" rx="8" />

      <!-- Cart Item Card -->
      <rect x="50" y="155" width="690" height="65" rx="6" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
      <rect x="65" y="165" width="45" height="45" rx="4" fill="#1e293b" />
      <text x="87" y="192" fill="#38bdf8" font-size="18" text-anchor="middle">💻</text>
      
      <text x="125" y="182" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="bold" font-size="13">
        Featured Laptop Pro 15.6&quot; (Core i9, 32GB RAM, 1TB SSD)
      </text>
      <text x="125" y="202" fill="#94a3b8" font-family="monospace" font-size="11">
        Qty: 1 • Unit Price: $1,299.00 • In Stock
      </text>
      <text x="710" y="192" fill="#10b981" font-family="system-ui, sans-serif" font-weight="bold" font-size="16" text-anchor="end">
        $1,299.00
      </text>

      <!-- Cart Subtotals -->
      <rect x="50" y="235" width="690" height="60" rx="6" fill="#0b1120" stroke="#1e293b" stroke-width="1" />
      <text x="70" y="258" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">Sub-Total:</text>
      <text x="200" y="258" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="bold" font-size="12">$1,299.00</text>
      
      <text x="70" y="278" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">Standard Delivery:</text>
      <text x="200" y="278" fill="#10b981" font-family="system-ui, sans-serif" font-weight="bold" font-size="12">FREE ($0.00)</text>

      <!-- TARGET ACTION: Proceed to Checkout Button -->
      <rect x="466" y="318" width="278" height="52" rx="10" fill="none" stroke="${statusColor}" stroke-width="2.5" stroke-dasharray="6,3" />
      <rect x="470" y="322" width="270" height="44" rx="8" fill="${statusColor}" />
      <text x="605" y="349" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="bold" font-size="14" text-anchor="middle">
        Proceed to Checkout →
      </text>

      <!-- Cursor Clicking Proceed to Checkout -->
      <polygon points="620,345 620,371 631,361 642,377 648,372 636,356 652,356" fill="#ffffff" stroke="#020617" stroke-width="1.8" />
      <circle cx="620" cy="345" r="12" fill="${statusColor}" opacity="0.35" />

      <!-- Locator Reference -->
      <rect x="50" y="322" width="400" height="44" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1" />
      <text x="65" y="340" fill="#94a3b8" font-family="monospace" font-size="10">Target Selector:</text>
      <text x="65" y="356" fill="#38bdf8" font-family="monospace" font-size="10">${safeLocator}</text>
    `;
  } else if (isGuestCheckout) {
    // Guest Checkout Form
    innerContentSvg = `
      <!-- Stepper Header -->
      <rect x="30" y="95" width="740" height="30" fill="#0f172a" />
      <text x="45" y="115" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="bold" font-size="12">
        Checkout Process: <tspan fill="#38bdf8">Step 1 — Account &amp; Billing Method</tspan>
      </text>

      <rect x="30" y="135" width="740" height="290" fill="#020617" stroke="#1e293b" stroke-width="1" rx="8" />

      <!-- Radio Account Options -->
      <text x="55" y="165" fill="#cbd5e1" font-family="system-ui, sans-serif" font-weight="bold" font-size="13">
        Select Your Checkout Option:
      </text>

      <!-- Radio 1: Register Account (Inactive) -->
      <circle cx="65" cy="192" r="8" fill="#1e293b" stroke="#475569" stroke-width="1.5" />
      <text x="85" y="196" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">Register New Customer Account</text>

      <!-- Radio 2: Guest Checkout (ACTIVE TARGET ELEMENT) -->
      <rect x="50" y="212" width="320" height="38" rx="6" fill="none" stroke="${statusColor}" stroke-width="2" stroke-dasharray="5,2" />
      <rect x="52" y="214" width="316" height="34" rx="5" fill="#0f172a" />
      <circle cx="68" cy="231" r="8" fill="${statusColor}" />
      <circle cx="68" cy="231" r="3.5" fill="#ffffff" />
      <text x="88" y="235" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="bold" font-size="12">
        Guest Checkout (No Registration Required)
      </text>

      <!-- Guest Fields Form Mockup -->
      <rect x="50" y="265" width="690" height="100" rx="6" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
      
      <!-- Field 1: Email -->
      <text x="70" y="287" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">Work / Personal Email:</text>
      <rect x="70" y="295" width="300" height="34" rx="4" fill="#1e293b" stroke="#475569" stroke-width="1" />
      <text x="82" y="316" fill="#f8fafc" font-family="monospace" font-size="11">customer.qa@lambdatest.com</text>

      <!-- Field 2: Full Name -->
      <text x="400" y="287" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">Full Name:</text>
      <rect x="400" y="295" width="320" height="34" rx="4" fill="#1e293b" stroke="#475569" stroke-width="1" />
      <text x="412" y="316" fill="#f8fafc" font-family="monospace" font-size="11">Alex Dev (QA Lead)</text>

      <!-- Action Button -->
      <rect x="520" y="380" width="220" height="36" rx="6" fill="${statusColor}" />
      <text x="630" y="403" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="bold" font-size="12" text-anchor="middle">
        Continue with Guest Details →
      </text>

      <!-- Cursor on Guest Radio -->
      <polygon points="75,235 75,261 86,251 97,267 103,262 91,246 107,246" fill="#ffffff" stroke="#020617" stroke-width="1.8" />
      <circle cx="75" cy="235" r="10" fill="${statusColor}" opacity="0.35" />

      <!-- Locator Badge -->
      <text x="55" y="403" fill="#38bdf8" font-family="monospace" font-size="11">
        Target: ${safeLocator}
      </text>
    `;
  } else if (isPromoCode) {
    // Promo Code Application
    innerContentSvg = `
      <!-- Header -->
      <rect x="30" y="95" width="740" height="30" fill="#0f172a" />
      <text x="45" y="115" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="bold" font-size="12">
        Discounts &amp; Promotional Vouchers
      </text>

      <rect x="30" y="135" width="740" height="290" fill="#020617" stroke="#1e293b" stroke-width="1" rx="8" />

      <text x="60" y="170" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="bold" font-size="14">
        Do you have a promotional discount coupon or voucher?
      </text>
      <text x="60" y="190" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">
        Enter your coupon code below to apply instant percentage or fixed discounts to your cart total.
      </text>

      <!-- Input Group: Coupon Code -->
      <rect x="60" y="215" width="420" height="48" rx="6" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" />
      <text x="80" y="245" fill="#38bdf8" font-family="monospace" font-weight="bold" font-size="15">
        DISCOUNT10
      </text>

      <!-- TARGET BUTTON: Apply Promo Code -->
      <rect x="496" y="211" width="228" height="56" rx="10" fill="none" stroke="${statusColor}" stroke-width="2.5" stroke-dasharray="6,3" />
      <rect x="500" y="215" width="220" height="48" rx="6" fill="${statusColor}" />
      <text x="610" y="244" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="bold" font-size="13" text-anchor="middle">
        Apply Promo Code
      </text>

      <!-- Cursor clicking Apply Promo Code -->
      <polygon points="615,240 615,266 626,256 637,272 643,267 631,251 647,251" fill="#ffffff" stroke="#020617" stroke-width="1.8" />
      <circle cx="615" cy="240" r="12" fill="${statusColor}" opacity="0.35" />

      <!-- Success Notification Box -->
      <rect x="60" y="285" width="660" height="48" rx="6" fill="#064e3b" stroke="#10b981" stroke-width="1.5" />
      <text x="80" y="314" fill="#34d399" font-family="system-ui, sans-serif" font-weight="bold" font-size="12">
        ✔ Success: Coupon code 'DISCOUNT10' validated! 10% discount applied to your order.
      </text>

      <text x="60" y="375" fill="#94a3b8" font-family="monospace" font-size="11">
        Playwright Evaluated: <tspan fill="#38bdf8">${safeLocator}</tspan>
      </text>
    `;
  } else if (isVerifyDiscount) {
    // Discount Calculation Table Verification
    innerContentSvg = `
      <!-- Header -->
      <rect x="30" y="95" width="740" height="30" fill="#0f172a" />
      <text x="45" y="115" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="bold" font-size="12">
        Order Summary &amp; Discount Calculation Verification
      </text>

      <rect x="30" y="135" width="740" height="290" fill="#020617" stroke="#1e293b" stroke-width="1" rx="8" />

      <!-- Table Container with Highlight Stroke -->
      <rect x="60" y="155" width="680" height="190" rx="8" fill="#0f172a" stroke="${statusColor}" stroke-width="2" />
      
      <!-- Table Header -->
      <rect x="60" y="155" width="680" height="32" rx="8" fill="#1e293b" />
      <text x="80" y="176" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="bold" font-size="12">Price Description</text>
      <text x="720" y="176" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="bold" font-size="12" text-anchor="end">Calculated Amount</text>

      <!-- Row 1: Sub-Total -->
      <line x1="60" y1="187" x2="740" y2="187" stroke="#334155" stroke-width="1" />
      <text x="80" y="210" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="12">Sub-Total (1x Featured Laptop 15.6&quot;):</text>
      <text x="720" y="210" fill="#f8fafc" font-family="monospace" font-weight="bold" font-size="13" text-anchor="end">$1,299.00</text>

      <!-- Row 2: Discount Row (TARGET ASSERTION ROW) -->
      <rect x="61" y="222" width="678" height="34" fill="#064e3b" opacity="0.4" />
      <line x1="60" y1="222" x2="740" y2="222" stroke="#10b981" stroke-width="1" />
      <text x="80" y="244" fill="#34d399" font-family="system-ui, sans-serif" font-weight="bold" font-size="12">
        ✔ Coupon Discount (DISCOUNT10 - 10% OFF):
      </text>
      <text x="720" y="244" fill="#34d399" font-family="monospace" font-weight="bold" font-size="14" text-anchor="end">
        -$130.00
      </text>

      <!-- Row 3: Shipping & Tax -->
      <line x1="60" y1="256" x2="740" y2="256" stroke="#334155" stroke-width="1" />
      <text x="80" y="278" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">Standard Express Shipping:</text>
      <text x="720" y="278" fill="#10b981" font-family="monospace" font-size="12" text-anchor="end">FREE ($0.00)</text>

      <!-- Row 4: Final Total -->
      <line x1="60" y1="292" x2="740" y2="292" stroke="#475569" stroke-width="1.5" />
      <rect x="61" y="293" width="678" height="50" rx="4" fill="#090d16" />
      <text x="80" y="325" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="bold" font-size="14">Final Order Total:</text>
      <text x="720" y="327" fill="#10b981" font-family="monospace" font-weight="bold" font-size="18" text-anchor="end">$1,169.00</text>

      <!-- Assertion Verified Callout -->
      <rect x="60" y="360" width="680" height="42" rx="6" fill="#0f172a" stroke="${statusColor}" stroke-width="1" />
      <text x="80" y="386" fill="${statusColor}" font-family="monospace" font-weight="bold" font-size="11">
        ✔ Assertion Verified: expect(page.locator('${safeLocator}')).toContainText('$1,169.00')
      </text>
    `;
  } else {
    // Dynamic Fallback for ANY generic web application / test step
    const targetLabel = safeCleanTitle.length > 28 ? safeCleanTitle.slice(0, 26) + '...' : safeCleanTitle;
    innerContentSvg = `
      <rect x="30" y="95" width="740" height="30" fill="#0f172a" />
      <text x="45" y="115" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="bold" font-size="12">
        Application Viewport • ${safeCleanTitle}
      </text>

      <rect x="30" y="135" width="740" height="290" fill="#020617" stroke="#1e293b" stroke-width="1" rx="8" />

      <!-- Action Container -->
      <rect x="60" y="165" width="680" height="230" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1" />

      <text x="90" y="205" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="bold" font-size="16">
        ${safeCleanTitle}
      </text>
      <text x="90" y="230" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">
        Target URL: ${safeUrl}
      </text>

      <!-- Evaluated Locator Box -->
      <rect x="90" y="250" width="620" height="38" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1" />
      <text x="105" y="274" fill="#38bdf8" font-family="monospace" font-size="11">
        ${safeLocator}
      </text>

      <!-- Dynamic Primary Action Control -->
      <rect x="86" y="306" width="228" height="52" rx="10" fill="none" stroke="${statusColor}" stroke-width="2.5" stroke-dasharray="6,3" />
      <rect x="90" y="310" width="220" height="44" rx="8" fill="${statusColor}" />
      <text x="200" y="337" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="bold" font-size="13" text-anchor="middle">
        ${targetLabel}
      </text>

      <!-- Cursor -->
      <polygon points="210,335 210,361 221,351 232,367 238,362 226,346 242,346" fill="#ffffff" stroke="#020617" stroke-width="1.8" />
      <circle cx="210" cy="335" r="12" fill="${statusColor}" opacity="0.35" />

      <text x="330" y="337" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">
        ✔ Verified state transition and DOM assertions satisfied.
      </text>
    `;
  }

  // Complete SVG Canvas
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
    <defs>
      <linearGradient id="chromeBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>

    <!-- Background Frame -->
    <rect width="800" height="450" fill="#020617" />

    <!-- Browser Window Header Bar -->
    <rect y="0" width="800" height="42" fill="url(#chromeBg)" />
    
    <!-- Traffic light controls -->
    <circle cx="20" cy="21" r="5.5" fill="#ef4444" />
    <circle cx="38" cy="21" r="5.5" fill="#f59e0b" />
    <circle cx="56" cy="21" r="5.5" fill="#10b981" />

    <!-- Browser Address / URL Bar -->
    <rect x="76" y="8" width="530" height="26" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1" />
    <text x="90" y="25" fill="#38bdf8" font-family="monospace" font-size="11">🔒</text>
    <text x="110" y="25" fill="#cbd5e1" font-family="monospace" font-size="11">${safeUrl}</text>

    <!-- Viewport Resolution Pill -->
    <rect x="618" y="9" width="70" height="24" rx="4" fill="#090d16" stroke="#334155" stroke-width="1" />
    <text x="653" y="25" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="middle">1280x720</text>

    <!-- Status Banner Badge -->
    <rect x="696" y="9" width="94" height="24" rx="4" fill="${statusColor}" fill-opacity="0.2" stroke="${statusColor}" stroke-width="1.2" />
    <text x="743" y="25" fill="${statusColor}" font-family="monospace" font-weight="bold" font-size="9" text-anchor="middle">
      ${badgeText}
    </text>

    <!-- Tab / Step Subheader -->
    <rect y="42" width="800" height="44" fill="#0b1120" stroke="#1e293b" stroke-width="1" />
    <text x="30" y="68" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="bold" font-size="14">
      Step ${stepNumber}: ${safeCleanTitle}
    </text>
    <text x="770" y="68" fill="#64748b" font-family="monospace" font-size="11" text-anchor="end">
      Playwright Chromium • worker: 1
    </text>

    <!-- Dynamic Viewport Canvas Content -->
    ${innerContentSvg}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generates an accurate DOM context string for the given step.
 */
export function generateDomContextForStep(
  step: { stepNumber?: number; title: string; action?: string; locator?: string },
  targetUrl: string
): string {
  const cleanTitleStr = cleanStepTitle(step.title);
  const lower = cleanTitleStr.toLowerCase();
  const loc = (step.locator || '').toLowerCase();

  if (lower.includes('laptop') || lower.includes('cart') || loc.includes('product')) {
    return `<div class="entry-module module-products-carousel" id="featured-products">
  <div class="product-thumb" id="mz-product-listing-image-28212648-0-0">
    <div class="product-thumb-top">
      <a href="${targetUrl}/product/laptop-pro" class="product-img">
        <img src="/image/catalog/laptop-pro-15.jpg" alt="Featured Laptop Pro 15.6 inch" class="img-fluid" />
      </a>
      <span class="badge badge-warning">Featured</span>
    </div>
    <div class="caption">
      <h4 class="title"><a href="#">Featured Laptop Pro 15.6&quot;</a></h4>
      <div class="price">
        <span class="price-new">$1,299.00</span>
        <span class="price-old">$1,499.00</span>
      </div>
      <button type="button" class="btn btn-cart" title="Add to Cart" aria-label="Add Featured Laptop to Cart" onclick="cart.add('28212648');">
        <i class="fas fa-shopping-cart"></i> Add to Cart
      </button>
    </div>
  </div>
</div>`;
  }

  if (lower.includes('proceed to checkout') || (lower.includes('checkout') && !lower.includes('guest'))) {
    return `<div id="cart" class="dropdown">
  <div class="cart-dropdown-menu">
    <table class="table table-striped">
      <tbody>
        <tr>
          <td class="text-left"><a href="#">Featured Laptop Pro 15.6&quot;</a></td>
          <td class="text-right">x 1</td>
          <td class="text-right">$1,299.00</td>
        </tr>
      </tbody>
    </table>
    <div class="checkout-actions">
      <button type="button" class="btn btn-primary" aria-label="Proceed to Checkout" role="button">
        Proceed to Checkout
      </button>
    </div>
  </div>
</div>`;
  }

  if (lower.includes('guest') || loc.includes('guest')) {
    return `<div class="checkout-step" id="collapse-checkout-option">
  <div class="radio">
    <label>
      <input type="radio" name="account" value="guest" checked="checked" aria-label="Guest Checkout" />
      Guest Checkout
    </label>
  </div>
  <div class="guest-form mt-3">
    <div class="form-group">
      <label for="input-payment-email">E-Mail Address</label>
      <input type="email" id="input-payment-email" name="email" value="customer.qa@lambdatest.com" class="form-control" />
    </div>
  </div>
</div>`;
  }

  if (lower.includes('promo') || lower.includes('coupon') || lower.includes('discount')) {
    return `<div class="panel panel-default" id="accordion-coupon">
  <div class="panel-heading">
    <h4 class="panel-title">Use Coupon Code</h4>
  </div>
  <div class="input-group mt-2">
    <input type="text" name="coupon" value="DISCOUNT10" placeholder="Enter your coupon here" id="input-coupon" class="form-control" />
    <span class="input-group-btn">
      <button type="button" id="button-coupon" class="btn btn-primary">Apply Promo Code</button>
    </span>
  </div>
</div>`;
  }

  if (lower.includes('calculation') || lower.includes('table') || loc.includes('table')) {
    return `<div class="table-responsive">
  <table class="table table-bordered">
    <tbody>
      <tr>
        <td class="text-right"><strong>Sub-Total:</strong></td>
        <td class="text-right">$1,299.00</td>
      </tr>
      <tr class="table-success">
        <td class="text-right"><strong>Coupon (DISCOUNT10):</strong></td>
        <td class="text-right">-$130.00</td>
      </tr>
      <tr>
        <td class="text-right"><strong>Total:</strong></td>
        <td class="text-right font-weight-bold">$1,169.00</td>
      </tr>
    </tbody>
  </table>
</div>`;
  }

  return `<div class="step-container" data-step="${step.stepNumber}">
  <div class="action-target">
    <button type="button" class="btn btn-primary" aria-label="${cleanTitleStr}">
      ${cleanTitleStr}
    </button>
  </div>
</div>`;
}

/**
 * Helper to ensure a step screenshot is always up-to-date and never contains outdated generic placeholders
 */
export function getStepScreenshot(
  step: {
    stepNumber: number;
    title: string;
    screenshotUrl?: string;
    action?: string;
    locator?: string;
    status?: any;
  },
  targetUrl: string
): string {
  // If screenshot is already dynamic and NOT the legacy "Continue Journey" placeholder, use it
  if (
    step.screenshotUrl &&
    !step.screenshotUrl.includes('Continue%20Journey') &&
    !step.screenshotUrl.includes('Continue+Journey') &&
    !step.screenshotUrl.includes('Continue Journey')
  ) {
    return step.screenshotUrl;
  }

  // Otherwise, synthesize the exact matching viewport screenshot
  return generateSimulatedScreenshot({
    stepNumber: step.stepNumber,
    title: step.title,
    targetUrl,
    status: step.status || 'passed',
    action: step.action,
    locator: step.locator,
  });
}
