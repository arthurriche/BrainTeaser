SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: riddles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."riddles" ("id", "title", "question", "answer", "image_path", "release_date") OVERRIDING SYSTEM VALUE VALUES
	(1, 'The Road to Truthshire', 'You''re traveling through a country divided into two regions:

- **Truthshire** — where all citizens always tell the truth  
- **Liesburg** — where all citizens always lie

Each region has its own customs and culture, but the only difference that matters is this behavioral rule:  
- Truthshire residents **always tell the truth**  
- Liesburg residents **always lie**

You come to a **fork in the road**. One path leads to Truthshire, the other to Liesburg — but you don’t know which is which. At the fork stands a local resident. You have **no idea whether they are from Truthshire or Liesburg**.

You''re allowed to ask **one question** to determine **which path leads to Truthshire**.

**What question do you ask?**', '**Ask:**

> “Which of these roads leads to your home region?”

### Why this works:

- If the person is from **Truthshire**, they will truthfully point to **Truthshire** (their home region).
- If the person is from **Liesburg**, they will lie about the direction to **Liesburg** — and instead point to **Truthshire**.

In **both cases**, they will indicate the path to **Truthshire**, allowing you to confidently take the correct road.', 'test', '2025-06-24'),
	(2, 'The Eye Color Paradox', 'Aboard a vast interstellar research station, a group of scientists with various eye colors has lived in isolation for years. These scientists are all **flawless in logic** — if something can be deduced, they will do so immediately. None of them knows their own eye color. They can observe everyone else on the station at all times and keep a tally of the eye colors they see, but they **cannot communicate** about it in any way. There are no reflective surfaces, and they have no way of seeing their own reflection.

Every night at 00:00 station time, a shuttle docks briefly. Any scientist who has logically deduced their own eye color may **board the shuttle and leave**. The others must stay. All the scientists understand these rules perfectly and know that everyone else does, too.

On this station, there are:
- **100 scientists with blue eyes**
- **100 scientists with hazel eyes**
- **1 Commander with emerald green eyes**

Each blue-eyed scientist sees:
- **99 blue-eyed scientists**
- **100 hazel-eyed scientists**
- **1 green-eyed Commander**

But does **not** know their own eye color.

The Commander is permitted to make **only one public announcement** in all the endless years the station has existed. At precisely noon on a particular day, she addresses the entire crew:

> "I can see someone who has blue eyes."

**Who leaves the station, and on which night?**', '**All 100 blue-eyed scientists leave on the 100th night.**

### Explanation by induction:

- **Case of 1 blue-eyed scientist:**  
  They see no one else with blue eyes. The Commander’s statement must refer to them. They leave on **night 1**.

- **Case of 2:**  
  Each sees one blue-eyed person. They both think:  
  *“If I don’t have blue eyes, that person sees no one and will leave on night 1.”*  
  When no one leaves the first night, both realize:  
  *“I must also have blue eyes.”*  
  They both leave on **night 2**.

- **Case of 3:**  
  Each sees two blue-eyed people. They expect the two to leave on night 2 if there are only two. When no one leaves on night 2, they each realize there must be **three**.  
  All leave on **night 3**.

- **...and so on...**

- **Case of 100:**  
  Each blue-eyed scientist sees 99 others. They think:  
  *“If there are only 99, they will all leave on night 99.”*  
  When no one leaves on night 99, they all deduce:  
  *“I must be the 100th.”*  
  So all **100 blue-eyed scientists leave on night 100**.

The **Commander’s statement** creates **common knowledge** — everyone now knows that **everyone knows** that **at least one person has blue eyes**, which breaks the logical stasis and begins the chain of reasoning.', 'test', '2025-06-25'),
	(5, 'The Monks and the Ribbons', 'Every year, a secretive society of scholars visits a remote monastery of monks. During the visit, the scholars make all the monks **stand in a straight line**, ordered **from the tallest at the back to the shortest at the front**. Each monk can only see the monks in front of him (i.e., the shorter ones), not behind.

The scholars then place either a **red** or a **blue** ribbon on each monk''s head. The monks cannot see their own ribbon, but they can see the ribbons of those in front.

Starting from the tallest monk (who sees the most ribbons), the scholars ask each monk, one by one, **to state the color of his own ribbon**.

If a monk guesses incorrectly, he is taken away silently. The others hear the answer spoken but don’t know if the monk was correct or not.

**What strategy can the monks agree upon in advance to minimize the number of monks taken away?**  
**What is the maximum number of monks who will be taken using this strategy?**', 'At most **one monk** will be taken away if the group agrees on the optimal strategy.

Let’s assign a value to each ribbon color:  
- **Red = 0**  
- **Blue = 1**

Each monk calculates the **parity (sum modulo 2, rest of the division of the sum by 2)** of the visible ribbons in front of him.

The **tallest monk** (at the back of the line) announces the color corresponding to the **parity he observes**. He might be taken away, since he cannot see his own ribbon and therefore cannot be sure.

Each following monk does the following:
1. Calculates the parity of the ribbons he sees.
2. Uses the announced parity from the first monk and the answers of previous monks to deduce his own ribbon color:
   - If his calculated parity matches the announced parity, **his ribbon is red (0)**.
   - If it differs, **his ribbon is blue (1)**.

Each successive monk can compute his ribbon color based on this logic.

**Conclusion:** Only the tallest monk might be taken. All others will survive with certainty using this strategy.', 'test', '2025-06-26');


--
-- Data for Name: chats; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: scores; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id") VALUES
	('riddle-images', 'riddle-images', NULL, '2025-06-26 18:40:15.987918+00', '2025-06-26 18:40:15.987918+00', false, false, NULL, NULL, NULL);


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") VALUES
	('ccea0d83-fd36-45d1-b3ec-b2b5cb65f50d', 'riddle-images', '2.png', NULL, '2025-06-26 18:41:46.708808+00', '2025-06-26 18:41:46.708808+00', '2025-06-26 18:41:46.708808+00', '{"eTag": "\"3b1d9c3e06f4c905440854bf2e60906c-1\"", "size": 2174716, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-06-26T18:41:46.000Z", "contentLength": 2174716, "httpStatusCode": 200}', '6faf4064-69e3-4bba-b3ea-c411170cbf64', NULL, NULL),
	('180bfd6f-6146-4493-b34e-df52def93523', 'riddle-images', '1.png', NULL, '2025-06-26 18:43:19.474823+00', '2025-06-26 18:43:19.474823+00', '2025-06-26 18:43:19.474823+00', '{"eTag": "\"f70dcb31466ec413732b210648ff2153-1\"", "size": 1798198, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-06-26T18:43:18.000Z", "contentLength": 1798198, "httpStatusCode": 200}', '851de668-1b83-4eb4-9c93-b8defac1b918', NULL, NULL),
	('dc54a9b7-c450-4aff-82b8-22f3d0a8fef9', 'riddle-images', '5.png', NULL, '2025-06-26 18:41:44.508552+00', '2025-06-26 18:45:02.28351+00', '2025-06-26 18:41:44.508552+00', '{"eTag": "\"739d59d1a9a8bcdf72c6533b50c3d6fd\"", "size": 2387870, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-06-26T18:45:02.000Z", "contentLength": 2387870, "httpStatusCode": 200}', 'c96a4edf-fc04-4dae-9580-919a52ea8a7c', NULL, NULL);


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 1, false);


--
-- Name: chats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."chats_id_seq"', 1, false);


--
-- Name: riddles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."riddles_id_seq"', 5, true);


--
-- PostgreSQL database dump complete
--

RESET ALL;
