# TODO: Add Maintenance Subscription Services Page

## Tasks
- [ ] Create MaintenanceSubscription.tsx page component
- [ ] Add service tiers (Essential, Pro, Premium) WITHOUT pricing
- [ ] Add Portfolio Residential Program WITHOUT per-unit pricing
- [ ] Add Commercial Membership WITHOUT pricing
- [ ] Highlight benefits and value propositions
- [ ] Add strong CTA to contact for custom quote
- [ ] Add route to App.tsx
- [ ] Add link to Navigation component
- [ ] Create new checkpoint


## Marketing Dashboard Integration
- [x] Create marketing dashboard page with authentication
- [x] Add direct links to Google Business posting interface
- [x] Add direct links to Google Ads campaign creation
- [x] Add direct links to Meta Business Suite (Facebook/Instagram)
- [x] Create campaign templates from marketing documents
- [x] Create lead tracking page at /leads with source dropdown
- [x] Create campaign launch checklist PDF
- [x] Add monthly budget calculator to dashboard
- [ ] Add campaign performance tracking
- [x] Create campaign library with ad copy

## Bug Fixes
- [x] Fix Partnerships page layout - upper part of site (navigation/header) is being removed or hidden when clicking Partnerships link

## New Marketing Enhancements
- [x] Add automated email notifications when new leads are logged in tracker
- [x] Create campaign performance dashboard with Google Ads API integration
- [x] Create campaign performance dashboard with Facebook API integration
- [x] Build customer testimonials page with before/after photos
- [x] Add video review support to testimonials page
- [x] Add testimonials page to navigation

## Lead Capture System
- [x] Create exit-intent pop-up to capture leaving visitors
- [x] Fix testimonials page - remove placeholder videos and update before/after images
- [x] Create quick quote form component
- [x] Add lead capture to database and email notifications
- [ ] Add inline lead capture forms on key pages (services, rebate guide)
- [ ] Create newsletter signup component for footer
- [ ] Add downloadable rebate guide with email gate

## Updates to Lead Capture & Testimonials
- [x] Add first name and last name fields to exit popup
- [x] Change exit popup messaging to focus on commercial and other services
- [x] Remove before/after images from testimonials page
- [x] Update lead capture database schema to include firstName and lastName

## Exit Popup Updates
- [x] Update exit popup to include both residential and commercial services with incentives

## Content Updates
- [x] Replace all instances of BIM with BMS throughout the website

## New Enhancements
- [x] Add marketing dashboard link to main navigation (visible only when logged in)
- [ ] Create automated email drip campaign system for captured leads
- [ ] Add social proof badges to exit popup (installations completed, customer satisfaction)

## SEO Improvements
- [x] Reduce homepage keywords from 10 to 6 focused keywords
- [x] Shorten meta description from 163 to 137 characters

## Analytics & Tracking
- [x] Add Google Ads conversion tracking tag (AW-17768263516)

## Bug Fixes
- [x] Add 15-second timer to exit popup (in addition to exit-intent trigger)

## Popup Enhancements
- [x] Add social proof badges to exit popup (installations completed, customer satisfaction)
- [x] Add Google Ads conversion tracking for popup form submissions
- [x] Create A/B test variants for popup (headlines, button colors, timer delays)

## Urgent Bug Fix
- [ ] Debug and fix popup not showing after latest changes
- [x] Fix 404 error on /marketing-dashboard route (fixed missing useAuth import)

## AI Virtual Assistant System

### Phase 1: Database & Credentials
- [x] Create database schema for AI VA credentials
- [x] Create database schema for call logs (Vapi)
- [x] Create database schema for SMS conversations (Twilio)
- [x] Create database schema for social posts
- [x] Create database schema for social interactions
- [x] Create database schema for AI VA analytics
- [x] Create credentials management page (AI VA Settings)
- [x] Add secure credential storage for Vapi (API key, Assistant ID)
- [x] Add secure credential storage for Twilio (Account SID, Auth Token, Phone Number)
- [x] Add secure credential storage for Facebook/Instagram (App ID, App Secret, Access Token)
- [x] Add secure credential storage for Google Business Profile (API credentials)

### Phase 2: Vapi Voice AI Integration
- [x] Create Vapi webhook endpoints for call events
- [x] Build inbound call handler with lead qualification
- [x] Implement outbound call system for follow-ups
- [x] Add call transfer logic for hot leads
- [x] Store call recordings and transcriptions
- [x] Create call logs viewer in dashboard

### Phase 3: Twilio SMS System
- [x] Set up Twilio webhook for incoming SMS
- [x] Build two-way SMS conversation handler
- [x] Create automated follow-up sequences (Day 1, 3, 7)
- [x] Implement SMS lead qualification flow
- [x] Add appointment reminder system
- [x] Create SMS conversation viewer

### Phase 4: Social Media Direct API Integration
- [x] Integrate Facebook Graph API for posting
- [x] Integrate Instagram Business API for posting
- [x] Integrate Google Business Profile API for posting
- [x] Build unified posting interface
- [x] Add social comment/message monitoring
- [x] Implement AI response system for social interactions

### Phase 5: AI Content Generator & Automation
- [x] Build AI content generator for HVAC posts
- [x] Create post templates (tips, rebates, seasonal, testimonials)
- [x] Implement automated daily posting schedule
- [x] Add post performance tracking
- [x] Create content calendar view

### Phase 6: AI VA Dashboard
- [x] Create main AI VA dashboard page
- [x] Add weekly lead goal tracker (20+ leads/week)
- [x] Build lead pipeline visualization
- [x] Implement lead scoring system (hot/warm/cold)
- [x] Add real-time activity feed
- [x] Create performance analytics view
- [x] Add conversation history viewer
- [x] Add AI VA Dashboard link to navigation menu
- [x] Add AI VA Settings link to dashboard

## Lead Scoring System
- [x] Design lead scoring algorithm with point values for different interactions
- [x] Add lead score field to database schema
- [x] Create backend scoring calculation logic
- [x] Implement automatic score updates on new interactions
- [x] Create API endpoint to get scored leads list
- [x] Build lead scoring dashboard component
- [x] Add lead priority badges (Hot/Warm/Cold)
- [x] Create lead details view with score breakdown
- [x] Add score history tracking
- [x] Implement lead prioritization sorting

## Bug Fixes
- [x] Fix 404 error on /ai-va-settings route
- [x] Verify all AI VA routes are properly registered

## AI VA Settings Bug Fixes
- [x] Implement backend API endpoints for saving credentials
- [x] Implement backend API endpoints for retrieving credentials
- [x] Connect frontend AI VA Settings page to backend API
- [x] Add proper form validation and error handling
- [x] Test credential saving and retrieval
- [x] Push database schema to create AI VA tables

## AI VA Settings Credential Persistence Bug
- [x] Debug why credentials don't persist after clicking save
- [x] Check if credentials are being loaded on page refresh
- [x] Add visual feedback (toast notifications) when save succeeds/fails
- [x] Verify database queries are working correctly
- [x] Create getAllCredentials endpoint to fetch all credentials at once
- [x] Fix TypeScript errors in credential loading logic
- [x] Test all four credential tabs (Vapi, Twilio, Facebook, Google)

## Vapi Integration Setup
- [x] Save user's Vapi API key to database
- [x] Save user's Vapi Assistant ID to database
- [x] Verify credentials are stored correctly
- [x] Provide webhook configuration instructions
- [ ] Test Vapi integration with live credentials

## Vapi Assistant Customization
- [x] Design conversation flow for residential leads
- [x] Design conversation flow for commercial leads
- [x] Create VRV/VRF system qualification script
- [x] Add rebate information handling (up to $16K residential, 80% commercial)
- [x] Create emergency vs scheduled service routing logic
- [x] Write master AI assistant prompt with all scenarios
- [x] Create prompt library page in website
- [x] Add link to AI Assistant Prompts from AI VA Settings
- [ ] Test different lead scenarios with AI responses

## AI Script Management System
- [x] Design database schema for storing custom AI scripts (title, category, content, timestamps)
- [x] Create database table for AI scripts
- [x] Build backend API endpoint to create new script
- [x] Build backend API endpoint to get all scripts
- [x] Build backend API endpoint to update existing script
- [x] Build backend API endpoint to delete script
- [x] Create frontend script management page with list view
- [x] Add "Create New Script" form with title, category, content fields
- [x] Add "Edit Script" functionality with pre-filled form
- [x] Add "Delete Script" confirmation dialog
- [x] Add script categories (Master, Residential, Commercial, VRV/VRF, Objections, Custom)
- [x] Add copy-to-clipboard functionality for each script
- [ ] Test full CRUD workflow (create, read, update, delete)

## Navigation & Routing Fixes
- [x] Investigate why AI Script Manager shows 404 on published site (route exists in code, needs publishing)
- [x] Remove Dashboard link from front page navigation
- [x] Remove AI VA link from front page navigation
- [x] Test all navigation links work correctly
- [ ] Verify changes on both dev and production

## Admin Portal
- [x] Create admin portal page component at /admin
- [x] Add organized sections for different tool categories
- [x] Add quick access cards for Marketing Dashboard, AI VA Dashboard, Lead Scoring, Script Manager
- [x] Add authentication protection to admin route
- [x] Add admin portal route to App.tsx
- [x] Test admin portal access and navigation

## Deployment & Configuration Steps
- [x] Configure Vapi webhook URL setup guide
- [x] Create publishing guide for production deployment
- [x] Add discreet admin portal link to footer (visible only when authenticated)
- [ ] Publish latest checkpoint to production
- [ ] Update Vapi webhook URL to production domain
- [ ] Test all features on production site

## Bug Fixes
- [x] Investigate why exit intent popup disappeared
- [x] Restore exit intent popup functionality
- [x] Test popup on all pages (homepage, services, residential, commercial, etc.)

## Scroll-Triggered Rebate Popup
- [x] Create ScrollRebatePopup component with email capture form
- [x] Add scroll detection logic (trigger at 50% page scroll)
- [x] Add popup to Residential page
- [x] Add popup to Commercial page
- [x] Test scroll trigger on both pages
- [x] Verify lead capture saves to database

## Exit Intent Popup Restoration
- [x] Investigate why exit intent popup disappeared from homepage
- [x] Restore ExitIntentPopup to Home.tsx
- [x] Test popup triggers correctly (15s timer + exit intent)
- [x] Verify popup closes properly and saves leads to database

## Popup Trigger Fixes
- [x] Change ScrollRebatePopup to trigger on exit intent (mouse leaving page) instead of scroll
- [x] Update popup component name from ScrollRebatePopup to ExitRebatePopup
- [x] Debug homepage exit intent popup - not triggering on mouse exit
- [x] Test all three exit intent popups (homepage, residential, commercial)
- [x] Verify all popups save leads correctly to database

## Popup Restoration
- [x] Check if ExitIntentPopup component exists in client/src/components/
- [x] Check if ScrollRebatePopup component exists in client/src/components/
- [x] Verify popups are imported in Home.tsx, ResidentialCampaigns.tsx, CommercialCampaigns.tsx
- [x] Test all three popups to ensure they trigger correctly
