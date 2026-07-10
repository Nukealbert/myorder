# Rebuild Tasks Checklist

- `[x]` **Phase 1: Project Initialization & Configuration**
  - `[x]` Initialize Electron app with Vite-TypeScript template using create-electron-app
  - `[x]` Install packages: react, react-dom, better-sqlite3, pdf-lib, bwip-js, xlsx, zod, zustand
  - `[x]` Configure Vite plugins for React renderer
  - `[x]` Setup tsconfig and project layout files

- `[x]` **Phase 2: Database Layer**
  - `[x]` Configure SQLite database file paths and initialization logic
  - `[x]` Set up database migrations and tables (`import_batches`, `orders`, `shipments`, `pin_codes`)
  - `[x]` Populate offline PIN-code directory with a starter seed
  - `[x]` Implement repository operations for batches, orders, shipments, and PIN-code updates

- `[x]` **Phase 3: PDF & Excel Modules**
  - `[x]` Implement `pdf-reader` (extracting text from PDF page by page via pdfjs-dist)
  - `[x]` Implement `amazon.parser` (regular expression-based parsing of Amazon order invoices)
  - `[x]` Implement local Code 128 barcode generator using `bwip-js`
  - `[x]` Implement `pdf-writer` (pdf-lib modification overlaying header and barcodes)
  - `[x]` Implement `excel-exporter` (xlsx spreadsheet writer with formatted string columns)

- `[x]` **Phase 4: IPC Bridge & Preload**
  - `[x]` Implement preload script exposing narrow, isolated APIs
  - `[x]` Create main process IPC handlers calling repository and pdf/excel services

- `[x]` **Phase 5: Renderer Front-end Development**
  - `[x]` Create Zustand store for shared state (settings, active batch, notifications)
  - `[x]` Implement custom Vanilla CSS stylesheets for premium dark mode aesthetics
  - `[x]` Build Import Orders screen (file upload, page processor, review table, validation preview)
  - `[x]` Build Dispatch screen (Weight, Order ID, Post ID barcode scan fields with key listener workflow)
  - `[x]` Build Batch History screen (re-export, archive/delete operations, status table)
  - `[x]` Build Settings screen (seller name, barcode width/height, default path, DB info)

- `[x]` **Phase 6: Verification & Hardening**
  - `[x]` Write mock validation tests for Amazon parser and DB transaction integrity
  - `[x]` Run test builds and verify build artifacts

- `[x]` **Phase 7: UI/UX Design System Upgrades**
  - `[x]` Define premium obsidian variables and styling tokens in `index.css`
  - `[x]` Create glassmorphic card stylings and box-shadow glows
  - `[x]` Refine typography (font weight, letter spacing) and layout grids
  - `[x]` Implement micro-animations for buttons, tabs, hover lifts, and transitions
  - `[x]` Apply glowing outlines for focused scanner input fields
  - `[x]` Format tables with rounded headers and smooth row selections

- `[x]` **Phase 8: High-Fidelity Dashboard Redesign**
  - `[x]` Update `ImportOrdersPage.tsx` with drag-and-drop zone and summary stats cards
  - `[x]` Update `DispatchPage.tsx` with cockpit cockpit layout, scanning steps cards, customer badges, and CRT terminal logs
  - `[x]` Update `index.css` with dropzone, scanner cockpit, terminal, and animations CSS

- `[x]` **Phase 9: PIN Directory View**
  - `[x]` Add `search` function inside `pincode.repository.ts`
  - `[x]` Add `pincode:search` IPC handler in `shipment.ipc.ts`
  - `[x]` Declare `searchPinCodes` inside `desktop-api.types.ts` and `preload.ts`
  - `[x]` Create `PinDirectoryPage.tsx` React component (search bar, stats card, paginated list, add PIN form)
  - `[x]` Register tab and link in `App.tsx`
