# Delivery Workers Shortcut Design

## Goal

Give admins a fast path from the dashboard to the registered delivery workers without creating a separate management surface.

## Recommended Approach

Add an "Entregadores" quick access card to the admin dashboard. The card navigates to `/admin/customers?delivery=1`.

The existing customer list reads the `delivery=1` query parameter, applies `is_delivery_worker: true`, opens the filter panel, and shows a small active-filter indicator. The customer list also gets a "Tipo" filter with "Todos", "Clientes", and "Entregadores" so the admin can switch the view after landing there.

## Architecture

Reuse `CustomerListPage` and `customerService.list(filters)`, because the service already supports `is_delivery_worker`. Keep the route unchanged and treat the dashboard card as a pre-filtered entry point.

## Testing

Add a focused static regression test that checks:
- the dashboard quick access links to `/admin/customers?delivery=1`;
- `CustomerListPage` imports `useLocation`;
- `CustomerListPage` derives the initial filter from `delivery=1`;
- the UI exposes the "Tipo" filter and delivery active indicator.
