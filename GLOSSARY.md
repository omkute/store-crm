# Glossary — Store CRM ubiquitous language

Single source of truth for domain words. Use exactly these terms in code, tests, PRDs, and issues.

- **Customer**: a person the store sells to. Fields: name, email, phone, notes.
- **Product**: an item in inventory. Fields: name, SKU, price, stock quantity.
- **Order**: a customer's purchase. Has one customer, one or more line items (product + qty), a total, a status, a date. Recording an order decrements stock; an order must never oversell (qty must not exceed available stock).
- **Dashboard**: the overview page. Shows today's revenue, the low-stock list, and recent orders.
