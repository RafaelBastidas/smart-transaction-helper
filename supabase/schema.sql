create table if not exists transactions (
  transaction_id     text primary key,
  timestamp          timestamptz not null,
  type               text not null,
  merchant_recipient text,
  amount             numeric(14, 2) not null,
  status             text not null,
  error_code         text,
  internal_note      text,
  risk_score         numeric(5, 2),
  card_is_frozen     boolean not null default false,
  bin                text
);
