alter table payments add column if not exists mercadopago_payment_id text;
comment on column payments.status is 'pending | declarado | paid | failed';

select column_name from information_schema.columns where table_name='payments' and column_name='mercadopago_payment_id';
