create table "public"."premium_access" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "access_type" text not null check (access_type in ('single', 'subscription')),
    "riddle_id" bigint,
    "valid_until" timestamp with time zone,
    "stripe_session_id" text,
    "created_at" timestamp with time zone default now(),
    constraint premium_access_single_requires_riddle check (
        (access_type <> 'single') or (riddle_id is not null)
    )
);

alter table "public"."premium_access" enable row level security;

create table "public"."resource_orders" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "resource_slug" text not null,
    "stripe_session_id" text,
    "status" text default 'pending'::text,
    "download_url" text,
    "created_at" timestamp with time zone default now(),
    "fulfilled_at" timestamp with time zone
);

alter table "public"."resource_orders" enable row level security;

create unique index "premium_access_pkey" on public.premium_access using btree (id);
create unique index "resource_orders_pkey" on public.resource_orders using btree (id);
create unique index "premium_access_session_key" on public.premium_access using btree (stripe_session_id) where stripe_session_id is not null;
create unique index "resource_orders_session_key" on public.resource_orders using btree (stripe_session_id) where stripe_session_id is not null;
create unique index "premium_access_single_unique" on public.premium_access using btree (user_id, coalesce(riddle_id, 0)) where access_type = 'single';
create unique index "premium_access_subscription_unique" on public.premium_access using btree (user_id) where access_type = 'subscription';
create unique index "resource_orders_unique" on public.resource_orders using btree (user_id, resource_slug);

alter table "public"."premium_access" add constraint "premium_access_pkey" primary key using index "premium_access_pkey";
alter table "public"."resource_orders" add constraint "resource_orders_pkey" primary key using index "resource_orders_pkey";
alter table "public"."premium_access" add constraint "premium_access_user_id_fkey" foreign key (user_id) references auth.users(id) not valid;
alter table "public"."premium_access" validate constraint "premium_access_user_id_fkey";
alter table "public"."premium_access" add constraint "premium_access_riddle_id_fkey" foreign key (riddle_id) references riddles(id) not valid;
alter table "public"."premium_access" validate constraint "premium_access_riddle_id_fkey";
alter table "public"."resource_orders" add constraint "resource_orders_user_id_fkey" foreign key (user_id) references auth.users(id) not valid;
alter table "public"."resource_orders" validate constraint "resource_orders_user_id_fkey";

grant select, insert, update on table "public"."premium_access" to "authenticated";
grant select, insert, update on table "public"."resource_orders" to "authenticated";
grant select, insert, update on table "public"."premium_access" to "service_role";
grant select, insert, update on table "public"."resource_orders" to "service_role";

create policy "Users manage their premium access"
on "public"."premium_access"
as permissive
for all
to "authenticated"
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));

create policy "Users manage their resource orders"
on "public"."resource_orders"
as permissive
for all
to "authenticated"
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));
