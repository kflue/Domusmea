# Data model

The SQLite schema after migration 8 (`Domusmea/src/server/db.ts`). Money is integer Rappen,
calendar dates `YYYY-MM-DD` and timestamps ISO 8601 UTC, all stored as `TEXT` or `INTEGER` (ADR
0004). Capex is derived from `items.purchase_date` and `items.cost_rappen`; no totals are stored.

```mermaid
erDiagram
  ITEMS ||--o{ JOURNAL_ENTRIES : "repaired by"
  ROLES ||--o{ ROLE_PERMISSIONS : grants
  ROLES ||--o{ USERS : "assigned to"
  USERS ||--o{ SESSIONS : "signed in with"
  USERS ||--o{ SIGN_INS : "recorded in"
  SUBSCRIPTIONS ||--o{ SUBSCRIPTION_PRICE_CHANGES : "priced by"
  UTILITY_BILLS ||--|{ UTILITY_ENTRIES : contains

  ITEMS {
    integer id PK
    text name
    text category "appliance, building-part or NULL (Other)"
    text purchase_date "NOT NULL; capex year, future = planned"
    integer cost_rappen "nullable"
    text warranty_expires "nullable"
    text manufacturer
    text model
    text serial_number
    text seller
    text warranty_notified_at "ADR 0003"
    text created_at
    text updated_at
  }
  JOURNAL_ENTRIES {
    integer id PK
    text date "repair date; opex month"
    text title
    integer cost_rappen "nullable"
    text contractor
    text notes
    integer item_id FK "nullable, ON DELETE SET NULL"
    text created_at
    text updated_at
  }
  SUBSCRIPTIONS {
    integer id PK
    text name
    text interval "monthly or annual"
    integer cost_rappen
    text start_date
    text end_date "nullable"
    integer notice_months "nullable"
    text cancel_reminded_for "ADR 0010"
    text created_at
    text updated_at
  }
  SUBSCRIPTION_PRICE_CHANGES {
    integer subscription_id PK, FK
    text valid_from PK
    integer cost_rappen
  }
  UTILITY_BILLS {
    integer id PK
    text invoice_number
    text notes
    text created_at
    text updated_at
  }
  UTILITY_ENTRIES {
    integer id PK
    integer bill_id FK "ON DELETE CASCADE"
    text commodity
    text period_from
    text period_to
    integer amount_milli "nullable"
    integer cost_rappen
    integer fixed_fee_rappen
    text created_at
    text updated_at
  }
  ROLES {
    integer id PK
    text name UK
  }
  ROLE_PERMISSIONS {
    integer role_id PK, FK
    text permission PK
  }
  USERS {
    integer id PK
    text username UK
    text password_hash
    integer role_id FK
    integer must_change_credentials
    text created_at
    text updated_at
  }
  SESSIONS {
    text token_hash PK
    integer user_id FK
    text created_at
    text last_seen_at
  }
  SIGN_INS {
    integer id PK
    integer user_id FK
    text signed_in_at
    text address
    text forwarded_for
  }
  EMAIL_SETTINGS {
    integer id PK "always 1"
    text smtp_host
    integer smtp_port
    text smtp_security
    text smtp_username
    text smtp_password "encrypted, ADR 0006"
    text from_address
    text recipients "JSON array"
    text updated_at
  }
```

Indexes: `items_warranty_pending`, `journal_entries_date`, `journal_entries_item`, `sessions_user`,
`sign_ins_user`, `utility_entries_commodity`, `utility_entries_bill`.
