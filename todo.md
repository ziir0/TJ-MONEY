# Trading Journal - Development TODO

## Phase 1: Design System & Database
- [x] Design system with elegant color palette and typography
- [x] Database schema for trades, journal notes, and user data
- [x] Backend procedures for trade CRUD operations
- [x] Backend procedures for statistics calculations

## Phase 2: Core UI Layout
- [x] DashboardLayout integration with sidebar navigation
- [x] Navigation sections: Dashboard, Calendar, Trades, Analytics, Journal
- [x] Global styling and theme setup
- [x] Responsive design foundation

## Phase 3: Trade Entry & Logging
- [x] Trade entry form with all required fields
- [x] Form validation and error handling
- [x] Trade creation backend procedure
- [x] Trade list display with basic filtering

## Phase 4: Dashboard & Statistics
- [x] Key stat cards: Total P&L, Win Rate, Average Win/Loss, Profit Factor, Trade Count
- [x] Statistics calculation backend
- [x] Dashboard layout with stat cards
- [x] Real-time stat updates

## Phase 5: Calendar & Day View
- [x] Interactive calendar component with color-coded P&L
- [x] Day view with trades for selected day
- [x] Daily summary statistics
- [x] Calendar filtering and navigation

## Phase 6: Analytics & Charts
- [x] Cumulative P&L chart
- [x] P&L by day of week chart
- [x] Win/loss distribution chart
- [x] Trade duration analysis chart
- [x] Analytics page layout

## Phase 7: Journal & Import
- [x] Journal notes per trading day
- [x] Journal CRUD operations
- [x] CSV import functionality
- [x] Trade filtering by date, symbol, direction, outcome
- [x] Filtering UI

## Phase 8: Polish & Testing
- [x] UI refinement and visual polish
- [x] Component testing with vitest
- [x] Cross-browser testing (responsive browser QA completed across desktop and mobile layouts)
- [x] Performance optimization
- [x] Final delivery
- [x] Add rendered component tests for TradeEntryForm and CSVImport workflows

## Phase 9: Dashboard Equity Curve & CSV Export (User Request)
- [x] Add interactive P&L equity curve chart to the main Dashboard
- [x] Implement CSV export for filtered trades and performance summaries
- [x] Write unit tests for export and equity curve calculations
- [x] Save checkpoint and deliver enhanced features

## Phase 10: Daily Equity Curve Baseline Correction (User Request)
- [x] Add an explicit $0 starting point before the first daily trade in the P&L equity curve
- [x] Update equity curve tests to cover the $0 baseline
- [x] Verify the corrected chart and save a new checkpoint

## Phase 11: Equity Curve Period Toggles (User Request)
- [x] Add Daily, Weekly, and Monthly toggle buttons to the equity curve
- [x] Aggregate cumulative P&L accurately by selected period with a $0 baseline
- [x] Add tests for period aggregation and verify the updated dashboard
- [x] Save a new checkpoint and deliver the toggle enhancement

## Phase 12: Equity Curve Overlays & Custom Date Range (User Request)
- [x] Add account-balance overlay with configurable starting balance
- [x] Add drawdown overlay with peak-to-trough calculations
- [x] Add custom start and end date selectors for equity curve filtering
- [x] Add tests for overlay calculations and date-range filtering
- [x] Verify responsive chart behavior and save a new checkpoint
