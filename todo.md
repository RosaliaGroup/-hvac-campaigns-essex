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

## Lead Generation Campaign System
- [x] Research NJ HVAC market, keywords, and competitor landscape
- [x] Build Google Ads campaign page with ad copy, keywords, and targeting settings
- [x] Build Facebook/Instagram campaign page with ad copy and audience targeting
- [x] Build email outreach sequences (residential, commercial, follow-up)
- [x] Build SMS follow-up campaign templates
- [x] Create Campaign Generator dashboard tying all channels together
- [x] Add launch checklists for each campaign channel
- [x] Test all campaign pages

## Dedicated Campaign Landing Pages
- [x] LP: Google Ads - Residential Heat Pump Rebates (/lp/heat-pump-rebates)
- [x] LP: Google Ads - Commercial VRV/VRF Systems (/lp/commercial-vrv)
- [x] LP: Google Ads - Emergency HVAC Service (/lp/emergency-hvac)
- [x] LP: Facebook - Residential Homeowners (/lp/fb-residential)
- [x] LP: Facebook - Commercial Business Owners (/lp/fb-commercial)
- [x] LP: Email - Rebate Guide Download (/lp/rebate-guide)
- [x] LP: SMS/Email - Maintenance Tune-Up Offer (/lp/maintenance-offer)
- [x] Add all landing page routes to App.tsx
- [x] Link landing pages from campaign management pages
- [x] Add conversion tracking to all landing pages

## Bug Fixes
- [ ] Fix error on /lp/heat-pump-rebates landing page (and all other landing pages)
- [ ] Fix /lp/* routing — 404 on production due to missing server-side fallback
- [ ] Verify all 7 landing pages load correctly on production

## Lead Management Dashboard
- [x] Add status and notes fields to leadCaptures schema
- [x] Add tRPC procedures: list leads with filters, update lead status, add notes
- [x] Build LeadManagement page with real-time data table
- [x] Add source/campaign filter (by landing page)
- [x] Add status management (New, Contacted, Qualified, Booked, Lost)
- [x] Add lead detail panel with notes and activity log
- [x] Add summary stats cards (total leads, by source, conversion rate)
- [x] Wire /lead-dashboard route in App.tsx
- [x] Add link from Admin Portal
- [x] Write unit tests (23 tests passing)
- [ ] Test with real lead submissions from landing pages

## Jessica AI Assistant — Appointment Booking
- [x] Write Jessica inbound prompt (modeled on Iron 65 booking flow)
- [x] Write Jessica outbound prompt (outbound sales + booking)
- [x] Update AI Assistant Prompts page with Jessica inbound + outbound prompts
- [x] Add Vapi tools documentation (getCallerInfo, sendForm, bookAppointment, rescheduleAppointment)
- [x] Add tool quick reference table to prompts page
- [ ] Configure bookAppointment webhook handler in server/routers.ts to save appointments to DB
- [ ] Configure rescheduleAppointment webhook handler
- [ ] Configure getCallerInfo webhook handler to look up existing leads
- [ ] Test Jessica booking flow end-to-end with Vapi

## Google Ads Two-Way Integration
- [ ] Collect Google Ads Developer Token, Customer ID, OAuth Client ID, OAuth Client Secret
- [ ] Add credentials as secrets in app
- [ ] Build Google Ads OAuth flow on server (authorize + refresh token)
- [ ] Build campaign push endpoint — create/update campaigns in Google Ads from app
- [ ] Build live performance data pull — sync spend, clicks, impressions, conversions
- [ ] Update Google Ads Campaigns page with Push to Google Ads button
- [ ] Update Campaign Performance page with live data from Google Ads API

## Sprint — All 3 Next Steps (Mar 3 2026)
- [ ] Add job-caller deflection to Jessica inbound script
- [ ] Update AI Assistant Prompts page with job-caller section
- [ ] Build Vapi webhook endpoint for bookAppointment tool
- [ ] Build Vapi webhook endpoint for rescheduleAppointment tool
- [ ] Build Vapi webhook endpoint for getCallerInfo tool
- [ ] Create appointments table in DB schema and push migration
- [ ] Add appointments section to Lead Dashboard
- [ ] Send owner notification on every new booking from Jessica
- [ ] Verify Google Ads OAuth connect flow end-to-end

## Automated Marketing System — 20 Appointments/Week Goal
- [ ] Push DB migration for appointments table
- [ ] Build Vapi webhook: bookAppointment handler (save to appointments table + notify owner)
- [ ] Build Vapi webhook: rescheduleAppointment handler
- [ ] Build Vapi webhook: getCallerInfo handler (look up existing leads)
- [ ] Build campaign performance scoring engine (AI-powered weekly analysis)
- [ ] Build 20-appointments/week goal tracker with gap analysis
- [ ] Build automated campaign adjustment recommendations (AI)
- [ ] Build automated Google Ads campaign creation when below goal
- [ ] Build Marketing Autopilot dashboard page
- [ ] Add weekly email report to owner (appointments booked, gap to goal, AI actions taken)
- [ ] Add automated budget reallocation logic (shift spend to best-performing campaigns)
- [ ] Add A/B test automation for ad headlines and descriptions

## Automated Marketing System (20 Appointments/Week Goal)
- [x] Add appointments table to database schema
- [x] Push DB migration for appointments table
- [x] Build Vapi tool webhook handler (bookAppointment, rescheduleAppointment, getCallerInfo)
- [x] Add appointments tRPC router (list, stats, weeklyTrend, updateStatus)
- [x] Build campaign engine service with AI-powered analysis
- [x] Build weekly trend tracker (8-week history)
- [x] Build AI recommendation engine (5 recommendations per analysis)
- [x] Add autopilot tRPC router (analyze, refresh)
- [x] Build Marketing Autopilot dashboard page (/marketing-autopilot)
- [x] Add goal progress banner with trend status
- [x] Add weekly bar chart visualization
- [x] Add AI recommendations tab with one-click Push to Google Ads
- [x] Add Appointments tab with confirm/cancel/complete actions
- [x] Add ⚡ Autopilot link to Navigation (desktop + mobile)
- [x] Add job-caller deflection to Jessica inbound script
- [ ] Connect Vapi tool webhook URL in Vapi Dashboard
- [ ] Test Jessica booking flow end-to-end
- [ ] Verify Google Ads OAuth connect flow on production

## Security — Auth Protection for Internal Pages
- [ ] Hide ⚡ Autopilot nav link from public visitors (show only when logged in)
- [ ] Add auth guard to /marketing-autopilot route
- [ ] Add auth guard to all other internal routes (marketing-dashboard, leads, lead-dashboard, ai-va-dashboard, ai-va-settings, lead-scoring, ai-assistant-prompts, ai-script-manager, admin, campaign-performance, google-ads-campaigns, facebook-campaigns, email-sms-campaigns, campaign-generator)
- [ ] Create a reusable ProtectedRoute component

## Bug Fix — Push to Google Ads + Budget Adjustment
- [ ] Diagnose why Push to Google Ads buttons are not working
- [ ] Fix Push to Google Ads flow (GoogleAdsCampaigns + MarketingAutopilot pages)
- [ ] Add adjustable daily budget input before pushing any campaign
- [ ] Add budget adjustment for existing campaigns (update budget without recreating)

## Fix Sprint — Marketing Dashboard Buttons & New Campaigns (Mar 3 2026)
- [ ] Fix Open Google Ads button → link to ads.google.com/aw/campaigns (signed-in account)
- [ ] Fix Open Facebook button → link to correct Facebook Business Manager URL
- [ ] Fix Open Instagram button → link to correct Instagram Business URL
- [ ] Fix Open Google Business button → link to business.google.com
- [ ] Fix Connect buttons on Settings tab to actually trigger OAuth flows
- [ ] Fix Open Google Search button in campaign modal → link to correct campaign in Google Ads
- [ ] Fix Open YouTube button → show message that video must be uploaded first
- [ ] Update all rebate copy: residential = up to $16,000, commercial = up to 80% covered by PSE&G
- [ ] Add Commercial HVAC Upgrades campaign (PSE&G up to 80% covered)
- [ ] Add Maintenance Subscription campaign
- [ ] Add Referral Partnership Program campaign
- [ ] Disable/replace YouTube campaign placeholder until video is ready

## Session 3 Updates (Mar 2026)
- [x] Fix all Open/Connect buttons in MarketingDashboard to use correct URLs (Google Business, Google Ads, Facebook/Instagram with Business Manager ID)
- [x] Add 3 new campaign templates: Commercial HVAC Upgrades (80% PSE&G), Maintenance Subscriptions, Referral Partnership Program
- [x] Add 'Commercial' tab to CampaignLibrary component
- [x] Update all rebate amounts to "up to $16,000" in campaignTemplates.ts
- [x] Fix Open Google Ads button to link to campaigns list (account 332-572-0049)
- [x] Update platformLinks to use correct Facebook Business Manager URL (ID: 25087499474212997)
- [x] Update platformInstructions to include account IDs for Google Ads and Meta

## Session 4 Updates (Mar 4, 2026)
- [x] Add Referral Partner landing page at /lp/referral-partner
- [x] Rebuild Maintenance Subscription LP at /lp/maintenance-offer with 3-tier plan selector
- [x] Add AI-powered social post generator and scheduler to Marketing Dashboard Posts tab
- [x] Add new tRPC procedures: generatePostContent, schedulePost, publishPost, deletePost
- [x] Add deleteSocialPost and updateSocialPostStatus to db.ts
- [x] Add lp_referral_partner and lp_maintenance_subscription captureType values to schema + db:push
- [x] Register all new routes in App.tsx

## Command Center Hub
- [x] Build Command Center hub page with all dashboard links organized by category
- [x] Add Command Center link to main navigation

## Session 4 - Team Access System
- [ ] Add teamMembers table to schema (email, passwordHash, inviteToken, role, status)
- [ ] Build backend: invite, acceptInvite, teamLogin, logout, resetPassword, sendResetEmail procedures
- [ ] Build frontend: TeamLogin page (/team-login), AcceptInvite page (/accept-invite), ResetPassword page
- [ ] Build Team Management page in Command Center (invite, list, revoke)
- [ ] Update all protected dashboard routes to accept team member sessions

## Promos Landing Page (Yard Sign QR Code)
- [x] Create /promos standalone landing page with rebate info, case studies, financing details, and booking CTA

## SMS Campaign Manager (TextBelt)
- [x] Create smsContacts DB table (firstName, lastName, phone, email, zip, segment, leadStatus, smsTag)
- [x] Create smsCampaigns DB table (name, message1, message2, message3, status)
- [x] Create smsSends DB table (contactId, campaignId, messageNum, status, sentAt, textId)
- [x] Build tRPC endpoints: importContacts, listContacts, sendSms, getCampaignStats, checkQuota
- [x] Build SMS Campaign page at /sms-campaigns
- [x] Add contact list with segment filter (Segment A / Segment B)
- [x] Add 3-message drip template editor (Day 1, Day 4, Day 10)
- [x] Add send individual or bulk SMS with personalization (first name merge tag)
- [x] Add TextBelt quota display
- [x] Add send history / delivery status per contact
- [x] Pre-load contacts from Excel file into DB
- [x] Add SMS Campaigns link to Command Center

## SMS Campaign Manager — Next Steps
- [x] Add scheduledSends DB table (contactId, campaignId, messageNum, scheduledAt, status)
- [x] Add scheduleForContact and scheduleForAll tRPC procedures
- [x] Add server-side cron job to process pending scheduled sends every 5 minutes
- [x] Add "Schedule Send" UI in SMS Campaign page (pick date/time for Day 4 and Day 10)
- [x] Show scheduled sends queue in Scheduled tab
- [x] Build TextBelt opt-out webhook endpoint (POST /api/sms/reply)
- [x] Auto-mark contact as optedOut when STOP reply received
- [x] Cancel all pending scheduled sends for opted-out contact
- [x] Add Opt-Out Setup tab with webhook URL and TextBelt configuration instructions

## Bug Fix — Password Reset Email
- [x] Fix reset password flow to send link directly to user's email (not just notify owner)
- [x] Use Resend email service to deliver reset link to user's email address
- [x] Also send team invite emails directly to new members
- [x] Test reset flow end-to-end (Resend API key validated)

## SMS Campaign Manager — Delete Contact
- [ ] Add deleteContact tRPC procedure in smsCampaigns router
- [ ] Add db helper to delete SMS contact by ID
- [ ] Add delete button (trash icon) to each row in Contacts tab with confirmation dialog

## SMS Campaign Manager — Edit Contact & Visible Delete
- [x] Add updateContact tRPC procedure in smsCampaigns router
- [x] Add Edit button that opens a dialog to edit name, phone, email, zip, segment
- [x] Make Delete button a standalone red icon button (trash icon) — always visible, not hidden in action group

## SMS — TextBelt Region Override
- [x] Switched to TextBelt Global key — works from any server location (no proxy needed)
- [x] Test SMS send confirmed successful: {"success":true} with quota remaining
- [x] Fixed Confirm Send preview to show personalized message (replaces {{contact.firstname}} with actual name)

## SMS — Remove URL from Default Templates (TextBelt URL whitelist pending)
- [x] Remove mechanicalenterprise.com URL from all 3 default message templates
- [x] Replace with call-to-action using phone number only until whitelist approved

## SMS Campaign Manager Improvements
- [ ] Fix "text Altman" contact name in database
- [ ] Add quota warning before bulk send (show credit count, warn if insufficient)
- [ ] Add contact notes field (DB schema + UI)
- [ ] Add drip auto-scheduler (schedule all 3 drip messages at once per contact)
- [ ] Show contact name in Scheduled tab (not just phone number)

## Dashboard Quick Access
- [x] Add SMS Campaigns as a top-level sidebar nav item in DashboardLayout
- [x] Add Marketing Dashboard as a top-level sidebar nav item in DashboardLayout
- [x] Ensure both appear prominently in Command Center card grid
- [x] Add InternalNav quick-access bar to all internal dashboard pages (SMS, Marketing, Leads, AI VA, Performance, etc.)

## TextBelt Opt-Out Link
- [x] Add replyWebhookUrl to all TextBelt sends so STOP replies auto-opt-out contacts
- [x] Fix phone normalization in webhook to match E.164 format stored in contacts

## Telnyx Migration
- [x] Store TELNYX_API_KEY and TELNYX_FROM_NUMBER as secrets
- [x] Rewrite smsCampaigns router to use Telnyx API
- [x] Rewrite scheduledSms service to use Telnyx API
- [x] Update webhook handler to support Telnyx inbound format
- [x] Update quota display to show Telnyx balance instead

## Team Login Fixes
- [x] Fix team login authentication — updated Ana's email to sales@mechanicalenterprise.com and set status to active
- [x] Add show/hide password toggle to login form

## SMS Delivery Fix
- [ ] Diagnose why Telnyx SMS sends show success but messages not delivered
- [ ] Add opt-out link to message templates

## TextBelt Revert (Telnyx 10DLC pending)
- [x] Revert SMS sends back to TextBelt while Telnyx 10DLC approval is pending

## Opt-Out Link in SMS Messages
- [ ] Add TextBelt opt-out URL to all SMS campaign message templates

## Booking Link in SMS Messages
- [ ] Add booking/appointment link to all 3 default SMS message templates

## Qualify Landing Page + SMS Links
- [x] Build /qualify page with rebate calculator (house details → rebate amount → out-of-pocket → book)
- [x] Add mechanicalenterprise.com/qualify link to all 3 SMS message templates
- [x] Wire /qualify into App.tsx routing

## TextBelt API Key Update
- [ ] Update TEXTBELT_API_KEY to new approved key

## HVAC Rebate Calculator & Quote Tool
- [ ] Analyze proposal PDFs to extract pricing, rebate tiers, equipment options
- [ ] Build /estimate page with address lookup and property details form
- [ ] Show ducted vs ductless options with high-efficiency and standard tiers
- [ ] Show rebate amounts, system cost, out-of-pocket, monthly savings
- [ ] Add 3 financing packages (100% finance, 12% deposit, $4500 project)
- [ ] Add assessment booking/order form with package selection
- [ ] Wire backend to save quote requests and notify Ana

## HVAC Rebate Calculator Tool (/rebate-calculator)
- [x] Build 4-step rebate calculator page at /rebate-calculator
- [x] Step 1: Home details (address, property type, year built, sqft, bedrooms, floors, ducts, heating, income)
- [x] Step 2: System options (ducted vs ductless, high-efficiency vs standard, with cost/rebate/OOP breakdown)
- [x] Step 3: Financing packages (100% finance, 12% deposit, $4500 deposit) with gift cards, warranty, incentives
- [x] Step 4: Book free assessment with preferred date/time
- [x] Add backend tRPC procedure for assessment submissions with owner notification
- [x] Wire /rebate-calculator route in App.tsx

## Rebate Calculator Enhancements (Phase 2)
- [x] Add Google Maps Places Autocomplete to address field (auto-fills city/state/zip)
- [x] Add address confirmation indicator (green checkmark when address verified)
- [x] Save rebate calculations to database (rebateCalculations table)
- [x] Add listSubmissions and updateStatus tRPC procedures for admin view
- [x] Create /assessment-submissions admin page with filters, status management, and financial summary
- [x] Add Assessment Submissions link to CommandCenter Lead Management section
- [x] Add Rebate Calculator link to CommandCenter Public Pages section
- [x] Fix duplicate rebateCalculator router conflict (merged into single router file)

## SMS Inbox (2-Way Messaging)
- [x] Add smsInboxMessages table to database schema
- [x] Update smsWebhook service to save all inbound messages to inbox
- [x] Add inbox tRPC procedures (listConversations, getConversation, sendReply, markRead)
- [x] Add Inbox tab to SMS Campaigns page with conversation view

## Rebate Calculator Financing & Pricing Update
- [x] Option 1: 3rd-party finance full $32,243 — client receives max PSE&G incentive up to $16K back after install
- [x] Option 2: 15% deposit upfront (~$5,707) + rest through PSE&G — total project $38,047 (18% higher cost), lower incentive (we wait for PSE&G)
- [x] Option 3: 100% PSE&G OBR covers everything — total project $41,916 (30% higher cost), highest cost (we wait full period)
- [x] Rebates only available for high-efficiency PSE&G-approved systems — clear warning in UI
- [x] Add standard/non-rebate option for comparison (no PSE&G incentives, lower base cost)
- [x] Update Step 2 to show High-Efficiency (with rebates) vs Standard (no rebates) side-by-side

## Address Auto-Populate & LMI Tooltip
- [x] Enhance Google Maps autocomplete to populate all available fields (county, neighborhood, property type hints from address type)
- [x] Auto-detect if address is in an LMI-eligible zip code/area from Google Maps data (NJ_LMI_ZIPS set)
- [x] Add LMI "?" tooltip next to Income Level field explaining what LMI means
- [x] Tooltip explains: LMI = Low-to-Moderate Income, 60% rebate vs 50% standard, Essex County income thresholds, PSE&G verification note

## Rebate Calculator — 3 New Enhancements
- [x] Expand NJ_LMI_ZIPS to cover all 21 NJ counties (not just Essex County focus)
- [ ] Add "Text me my estimate" button on Step 3 — client enters phone, receives SMS with quote summary and booking link via Telnyx
- [ ] Add progress save/resume link — generate unique session ID, store form state in DB, allow client to resume via URL

## Bug Fixes — Rebate Calculator
- [x] Fix: "Calculate My Rebates" button redirects to homepage — fixed with type="button" + e.preventDefault()
- [x] Fix: Address autocomplete replaced deprecated Autocomplete widget with Geocoder API + "Look Up" button — now reliably populates city/state/ZIP/county

## Rebate Calculator — Mobile & Rebate Logic Fixes
- [x] Fix mobile layout: step indicator takes 2/3 of screen on phones — now compact
- [x] Make all 4 steps single-column and phone-friendly (larger touch targets, readable fonts)
- [x] Fix rebate logic: rebate amount now FIXED across all 3 financing plans (uses quote.totalIncentive always)
- [x] Only the total project cost changes per plan (not the rebate amount)
- [x] Step 3 financing cards show same rebate but different project totals

## Rebate Calculator — PSE&G Branding Removal & Mobile Fix
- [x] Remove all "PSE&G" references from RebateCalculator page — replaced with "NJ Clean Heat", "Rebates & Incentives"
- [x] Fix mobile layout: step indicator now compact on phones
- [x] Fix rebate logic: rebate amount stays fixed, only total project cost changes per plan
- [x] Fix address lookup: server-side geocoding via tRPC (geocodeAddress procedure) — works reliably on all devices

## Rebate Calculator — Mobile Fix (Round 2)
- [x] Diagnose exact mobile layout issues by testing at 390px viewport (used Playwright)
- [x] Fix navigation bar — now collapsed hamburger menu on mobile
- [x] Fix step indicator — compact numbered circles ① → ② → ③ → ④ on phones
- [x] Fix all form grids to be single-column on mobile
- [x] Fix hero text overflow — title wraps to two lines on mobile
- [x] Fix html/body overflow-x: hidden to prevent horizontal scroll
- [x] Ensure all buttons are full-width and easy to tap on phones

## OBR LMI 120-Month Financing
- [x] Update Option 3 (100% OBR) to show 120-month term when home is flagged as LMI
- [x] Calculate and display lower monthly payment for 120-month OBR term for LMI customers
- [x] Keep standard term for non-LMI customers on Option 3

## Rebate Calculator — 4-Option Financing Overhaul & Electric Panel Questions
- [x] Revise Option 1 (Deposit): 1-year PM, 2-year warranty, $100 gift card
- [x] Add new Option 2 (OBR Client-Financed): client pays OBR, 2-year PM, 3-year warranty, $200 gift card
- [x] Revise Option 3 (100% OBR): 3-year PM, 5-year warranty, $500 gift card, $14k-$16k back
- [x] Revise Option 4 (All covered by NJ Clean Heat): 1-year warranty only (no PM, no gift card)
- [x] Add electric panel questions to Step 1 before pricing generation
- [x] Panel question: does client have space? (central air = min 2 spaces; no central air = min 4 spaces)
- [x] If yes: add $750 per condenser for disconnect switch
- [x] If unsure/no: add $2,500 + $250 permits per disconnect
- [x] If house has central air: 1 disconnect; if no central air: 2 disconnects
- [x] Update pricing calculation to include panel/disconnect adders

## Rebate Calculator — UX Improvements Round 2
- [x] Add panel adder line to booking confirmation email / assessment notification
- [x] Add "What is OBR?" tooltip on Option 2 and Option 3 financing cards
- [x] Add compare-all-4 summary table at the top of Step 3 (gift card, warranty, PM, monthly)
- [x] Add solar panel interest question to Step 1 with savings verbiage

## Rebate Calculator — UX Improvements Round 3
- [x] Solar CTA on confirmation screen when client said Yes/Maybe to solar
- [x] Solar Interest column in Lead Dashboard / assessment submissions table
- [x] Preferred contact method field (Call / Text / Email) in booking form

## CMO Video Strategy — Personalized Video Hub
- [x] Write Rebates video script (60-sec explainer + talking head version)
- [x] Write content strategy for all 5 video topics
- [x] Generate AI video visuals/assets for Rebates video
- [x] Build personalized Video Hub page (interest selector + YouTube embeds)
- [x] Add HeyGen talking-head CTA section
- [x] Add user interest tracking to profile (checklist on registration/profile)
- [x] Wire personalization logic (show relevant videos based on interests)
- [x] Add lead capture CTA inside each video section

## HeyGen Personalized Video Integration
- [x] Validate HeyGen API key and list available avatars/voices
- [x] Build server-side tRPC procedure to generate personalized HeyGen video
- [x] Build status polling procedure to check video generation progress
- [x] Wire HeyGen CTA on Video Hub to trigger personalized video for logged-in users
- [x] Add "Watch your personalized video" CTA on Rebate Calculator confirmation screen
- [x] Display generated video URL in user profile / Video Hub

## Video Hub — Unlock All 5 Cards
- [x] Write script: How OBR Financing Works (60-sec)
- [x] Write script: Solar + Heat Pump Savings (60-sec)
- [x] Write script: What to Expect at Your Assessment (60-sec)
- [x] Write script: Commercial HVAC Solutions (60-sec)
- [x] Generate AI video for NJ Rebates Explained
- [x] Unlock all 5 Video Hub cards (Rebates: AI preview video; others: YouTube subscribe CTA)

## HeyGen Avatar Videos — All 5 Scripts
- [ ] Generate Video 1: NJ Rebates Explained (avatar talking-head)
- [ ] Embed completed HeyGen video on Video Hub card 1
- [ ] Generate remaining 4 videos once Video 1 is confirmed

## 3-Platform Video Production (Kling 3.0 + Nano Banana 2 + HeyGen)
- [x] Write Nano Banana 2 slide content for NJ Rebates explainer
- [x] Generate Nano Banana 2 animated explainer video/slides
- [x] Generate Kling 3.0 cinematic B-roll scenes (3 key scenes)
- [x] Provide HeyGen production guide with corrected script + Daisy avatar
- [x] Embed all assets on Video Hub page (B-roll gallery + slide gallery)

## Action Items — Video Launch & Publishing
- [ ] Generate HeyGen Rebates avatar video (Daisy avatar, updated script) — see HeyGen guide below
- [x] Create 15-second social clip with text overlay from Kling B-roll
- [x] Final site checks and prepare for publishing
- [x] Deliver YouTube upload package with title, description, tags, thumbnail

## Before/After Documentary Video — Window AC → Heat Pump Transformation
- [ ] Write full video script with 4 acts: Before (window AC), Assessment, Installation, After
- [ ] Write Kling 3.0 generation prompts for each scene (8-10 scenes)
- [ ] Generate all cinematic B-roll scenes via Kling 3.0
- [ ] Generate voiceover audio (Google TTS or ElevenLabs)
- [ ] Merge voiceover + B-roll into finished video with ffmpeg
- [ ] Upload finished video to CDN
- [ ] Add to Video Hub as new card
- [ ] Deliver YouTube upload package (title, description, tags, thumbnail text)

## Documentary Video V2 — Corrected (Window AC → Modern Mini-Split)
- [ ] Research Mitsubishi/Daikin mini-split appearance for accurate Kling prompts
- [ ] Write 8 corrected 10-second scene prompts (no looping, correct equipment, correct costumes)
- [ ] Generate 8 Kling 3.0 scenes sequentially at 10s duration
- [ ] Assemble with voiceover, title card, end screen
- [ ] Upload to CDN and deliver

## Bug Fixes — Mar 14 2026
- [x] Fix typos on slide 5 (Mechanical Enterprise, Assessment, mechanicalenterprise.com) — regenerated with correct logo
- [x] Fix Mechanical Enterprise logo — replaced with correct gear+flame+snowflake logo from site
- [x] Fix Assessment Calculator tab — added ScrollToTop component in App.tsx, scrolls to top on every route change

## Remove All Videos From Site
- [ ] Remove all B-roll video players from Video Hub
- [ ] Remove explainer slides carousel from Video Hub
- [ ] Remove 15-second social clip section from Video Hub
- [ ] Remove any other embedded video content from the site

## SMS Opt-In — Rebate Calculator Results
- [x] Add `calculator.sendResultsSms` tRPC procedure using Telnyx
- [x] SMS message includes: rebate estimate, homeowner name, booking link, phone number
- [x] Add phone number input + "Text Me My Results" button to results step UI
- [x] Show success/error state after SMS send
- [x] Write vitest for the SMS procedure (16 tests passing)

## Rebate Calculator Revisions — Mar 14 2026
- [x] Fix energy savings: high-efficiency and standard show same figure — standard should be ~40% lower (heat pump COP vs resistive/gas)
- [x] Hide panel/disconnect adder line from rebate display — silently add to cost only, no line-item shown
- [x] Add Federal Tax Credit tooltip after total (25C: up to $2,000 for heat pumps) with ? explaining homeowner applies separately
- [x] Verify ducted vs ductless cost accuracy (ductless should be ~10-15% cheaper than ducted)
- [x] Reorder financing packages: 3rd-party financing = Option 1 (cheapest, paid in full, Mechanical gets paid right away, client receives rebates directly, up to $2K additional Mechanical incentive); current Option 1 (deposit+OBR) = Option 3
- [x] Option 1 (3rd-party financing): no OBR balance, paid in full, add up to $2K Mechanical incentive, client receives rebates directly
- [x] Current Option 3 (100% OBR) becomes Option 3 — re-labeled appropriately
- [x] Oil tank question: if currentHeating === 'oil', ask tank location (above ground, basement, crawl space, buried) — add $2K decommissioning adder if applicable
- [x] Remove "No — not right now" option from solar question (only Yes and Maybe)
- [x] Remove solar info from confirmation/submitted screen (was not in original report)

## Financing Card Fixes (Round 2)
- [x] Option 1: remove monthly payment row (lender rate unknown)
- [x] Option 3: update name and description — private financing of non-rebate balance, NOT utility OBR
