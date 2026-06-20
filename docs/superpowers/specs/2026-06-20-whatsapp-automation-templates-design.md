# WhatsApp Automation Templates Design

## Goal
Create an editable WhatsApp automation template center that starts with transactional templates and leaves clear room for promotional, informational, and future templates.

## Scope
The first implementation creates template definitions, persistence, admin editing UI, and VPS schema support. It does not yet connect every automatic event trigger to real message sending.

## Template Model
Each template has a stable key, category, title, description, editable body, enabled flag, variables list, and audit timestamps. The enabled flag is the per-message safety switch used to pause one automation without disabling the others.

Initial transactional templates:
- Customer registration from website.
- Customer registration from admin with temporary password.
- Purchase completed.
- Birthday greeting with a future coupon variable.
- Delivery out for route.

Initial future-use templates:
- Promotional campaign.
- Informational announcement.
- Post-sale follow-up.
- Warranty reminder.

## Admin Experience
The WhatsApp center shows a template panel with category filters, a template selector, an enabled toggle, editable message body, available variables, preview text, and save/reset actions.

## Persistence
Templates are saved in `whatsapp_automation_templates` through the VPS table-data API. The frontend seeds missing defaults on load so new installs have usable templates immediately.

## Verification
Static tests confirm the service, defaults, panel, WhatsApp page integration, and VPS schema exist. Build verification confirms the TypeScript/React changes compile.
