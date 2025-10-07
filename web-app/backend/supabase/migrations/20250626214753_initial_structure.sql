create table "public"."chats" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "riddle_id" bigint not null,
    "messages" jsonb default '[]'::jsonb,
    "updated_at" timestamp without time zone default now()
);


alter table "public"."chats" enable row level security;

create table "public"."riddles" (
    "id" bigint generated always as identity not null,
    "title" text not null,
    "question" text not null,
    "answer" text not null,
    "image_path" text not null,
    "release_date" date not null
);


alter table "public"."riddles" enable row level security;

create table "public"."scores" (
    "user_id" uuid not null,
    "riddle_id" bigint not null,
    "score" integer,
    "duration" integer,
    "msg_count" integer,
    "created_at" timestamp without time zone default now()
);


alter table "public"."scores" enable row level security;

CREATE UNIQUE INDEX chats_pkey ON public.chats USING btree (id);

CREATE UNIQUE INDEX riddles_pkey ON public.riddles USING btree (id);

CREATE UNIQUE INDEX scores_pkey ON public.scores USING btree (user_id, riddle_id);

alter table "public"."chats" add constraint "chats_pkey" PRIMARY KEY using index "chats_pkey";

alter table "public"."riddles" add constraint "riddles_pkey" PRIMARY KEY using index "riddles_pkey";

alter table "public"."scores" add constraint "scores_pkey" PRIMARY KEY using index "scores_pkey";

alter table "public"."chats" add constraint "chats_riddle_id_fkey" FOREIGN KEY (riddle_id) REFERENCES riddles(id) not valid;

alter table "public"."chats" validate constraint "chats_riddle_id_fkey";

alter table "public"."chats" add constraint "chats_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."chats" validate constraint "chats_user_id_fkey";

alter table "public"."scores" add constraint "scores_riddle_id_fkey" FOREIGN KEY (riddle_id) REFERENCES riddles(id) not valid;

alter table "public"."scores" validate constraint "scores_riddle_id_fkey";

alter table "public"."scores" add constraint "scores_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."scores" validate constraint "scores_user_id_fkey";

grant delete on table "public"."chats" to "anon";

grant insert on table "public"."chats" to "anon";

grant references on table "public"."chats" to "anon";

grant select on table "public"."chats" to "anon";

grant trigger on table "public"."chats" to "anon";

grant truncate on table "public"."chats" to "anon";

grant update on table "public"."chats" to "anon";

grant delete on table "public"."chats" to "authenticated";

grant insert on table "public"."chats" to "authenticated";

grant references on table "public"."chats" to "authenticated";

grant select on table "public"."chats" to "authenticated";

grant trigger on table "public"."chats" to "authenticated";

grant truncate on table "public"."chats" to "authenticated";

grant update on table "public"."chats" to "authenticated";

grant delete on table "public"."chats" to "service_role";

grant insert on table "public"."chats" to "service_role";

grant references on table "public"."chats" to "service_role";

grant select on table "public"."chats" to "service_role";

grant trigger on table "public"."chats" to "service_role";

grant truncate on table "public"."chats" to "service_role";

grant update on table "public"."chats" to "service_role";

grant delete on table "public"."riddles" to "anon";

grant insert on table "public"."riddles" to "anon";

grant references on table "public"."riddles" to "anon";

grant select on table "public"."riddles" to "anon";

grant trigger on table "public"."riddles" to "anon";

grant truncate on table "public"."riddles" to "anon";

grant update on table "public"."riddles" to "anon";

grant delete on table "public"."riddles" to "authenticated";

grant insert on table "public"."riddles" to "authenticated";

grant references on table "public"."riddles" to "authenticated";

grant select on table "public"."riddles" to "authenticated";

grant trigger on table "public"."riddles" to "authenticated";

grant truncate on table "public"."riddles" to "authenticated";

grant update on table "public"."riddles" to "authenticated";

grant delete on table "public"."riddles" to "service_role";

grant insert on table "public"."riddles" to "service_role";

grant references on table "public"."riddles" to "service_role";

grant select on table "public"."riddles" to "service_role";

grant trigger on table "public"."riddles" to "service_role";

grant truncate on table "public"."riddles" to "service_role";

grant update on table "public"."riddles" to "service_role";

grant delete on table "public"."scores" to "anon";

grant insert on table "public"."scores" to "anon";

grant references on table "public"."scores" to "anon";

grant select on table "public"."scores" to "anon";

grant trigger on table "public"."scores" to "anon";

grant truncate on table "public"."scores" to "anon";

grant update on table "public"."scores" to "anon";

grant delete on table "public"."scores" to "authenticated";

grant insert on table "public"."scores" to "authenticated";

grant references on table "public"."scores" to "authenticated";

grant select on table "public"."scores" to "authenticated";

grant trigger on table "public"."scores" to "authenticated";

grant truncate on table "public"."scores" to "authenticated";

grant update on table "public"."scores" to "authenticated";

grant delete on table "public"."scores" to "service_role";

grant insert on table "public"."scores" to "service_role";

grant references on table "public"."scores" to "service_role";

grant select on table "public"."scores" to "service_role";

grant trigger on table "public"."scores" to "service_role";

grant truncate on table "public"."scores" to "service_role";

grant update on table "public"."scores" to "service_role";

create policy "User owns chat"
on "public"."chats"
as permissive
for all
to public
using ((user_id = auth.uid()));


create policy "Read today's riddle"
on "public"."riddles"
as permissive
for select
to public
using ((release_date <= CURRENT_DATE));


create policy "User owns score"
on "public"."scores"
as permissive
for all
to public
using ((user_id = auth.uid()));



