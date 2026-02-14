-- ============================================================================
-- CoTravel - Test Data (Seed)
-- ============================================================================
-- Run after init.sql to populate the database with realistic test data.
--
-- Usage:
--   docker exec -i impacta-postgres psql -U impacta -d impacta_db < database/seed.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- USERS (7 new + 1 demo_user from init.sql = 8 total)
-- ============================================================================

INSERT INTO users (wallet_address, username, avatar_url, role)
VALUES ('GCRSI4EKBFJ2UNBJBHSGBIBYV3PBM3OKA4OPMTDQXFIHAFTUFMH6OYTJ', 'maria_garcia', NULL, 'user'),
       ('GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOBD3BPSIDGQ2HKY', 'carlos_lopez', NULL, 'user'),
       ('GBNHWCAACPUFKR6DWOCDIHMQPYRCZLSXWXFAG3IUQDXDGNLFMQXHGNEV', 'ana_martinez', NULL, 'admin'),
       ('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNY', 'pedro_sanchez', NULL, 'user'),
       ('GDY47CJARRHHL66JH3RJURDYXAMIQ5DMXZLP3TDAYFTKBD3YOOSQTGP5', 'lucia_fernandez', NULL, 'user'),
       ('GCFONE23AB7Y6C5YZOMKUKGETPIAJA752ZKLHKJAGRGZZC7P6FHACIWN', 'diego_ramirez', NULL, 'user'),
       ('GBDEVU63Y6NTHJQQZIKVTC23NWLQHMWICWQXHPRPSFUUMFCAHYNESQMN', 'sofia_torres', NULL,
        'user') ON CONFLICT (wallet_address) DO NOTHING;

-- ============================================================================
-- BUSINESSES (6 businesses across categories)
-- ============================================================================

INSERT INTO businesses (owner_id, name, category, description, logo_url, wallet_address, contact_email)
VALUES
    -- Hotel (owned by maria_garcia)
    (2, 'Hotel Patagonia Sur', 'lodging',
     'Boutique hotel in El Calafate with views of Lago Argentino. Premium rooms with breakfast included.',
     '/images/logo-hotel-patagonia.png', 'GA2C5RFPE6GCKMY3US5PAB6UZLKIGSPIUKSLRB6Q723BM2OATLMD6OAH',
     'bookings@patagoniahotel.com'),

    -- Airline (owned by carlos_lopez)
    (3, 'Southern Airlines', 'transport',
     'Direct flights to tourist destinations in Patagonia and southern Argentina.',
     '/images/logo-southern-airlines.png', 'GDI73WJ4SX7LOG3XZDJC3KCK6ED6E5NBYK2JUBQSPBCNNUI6YX62SUHA',
     'sales@southernair.com'),

    -- Restaurant (owned by ana_martinez)
    (4, 'Asado & Malbec', 'dining',
     'Argentine restaurant specializing in grilled meats and Mendoza wines. Large group capacity.',
     '/images/logo-asado-malbec.png', 'GDVDKQFP665JAO7A2LSHNLQIUNEZ53JDPADAISBMAFWHILE2PGHMRVGH',
     'info@asadoymalbec.com'),

    -- Tour Operator (owned by pedro_sanchez)
    (5, 'Glacier Adventure', 'tourism',
     'Guided excursions to Perito Moreno Glacier, ice trekking and boat tours through the Iceberg Channel.',
     '/images/logo-glacier-adventure.png', 'GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IDF4HHT6V3COGL3DBRWKGOH',
     'tours@glacieradventure.com'),

    -- Ground transport (owned by lucia_fernandez)
    (6, 'Calafate Transfers', 'transport',
     'Airport-hotel shuttle service and private excursions in El Calafate and El Chaltén.',
     '/images/logo-calafate-transfers.png', 'GC3C4AKRBQLHOJ45U4XG35ESVWRDECWO5XLDGYADO6DPR3L7SDBTDEP4',
     'contact@calafatetransfers.com'),

    -- Equipment rental (owned by diego_ramirez)
    (7, 'Outdoor Patagonia', 'equipment',
     'Trekking, camping and outdoor gear rental. Technical clothing and accessories.',
     '/images/logo-outdoor-patagonia.png', 'GBCFAMVYPJTXHVWRFP7VO7F42MERAHZTTBHP6VGV6MGCOD3FHRMA6TPH',
     'rental@outdoorpatagonia.com') ON CONFLICT DO NOTHING;

-- ============================================================================
-- SERVICES (multiple per business)
-- ============================================================================

-- Hotel Patagonia Sur (business_id=1)
INSERT INTO services (business_id, name, description, price, image_url)
VALUES (1, 'Double Room - 3 nights',
        'Lake-view double room with buffet breakfast included. Check-in 2PM, check-out 10AM.', 450.0000000,
        '/images/svc-double-room.png'),
       (1, 'Single Room - 3 nights', 'Single room with continental breakfast included.', 280.0000000,
        '/images/svc-single-room.png'),
       (1, 'Premium Suite - 3 nights', 'Suite with jacuzzi, panoramic balcony and room service.', 750.0000000,
        '/images/svc-premium-suite.png'),
       (1, 'Group Welcome Dinner', 'Private group dinner with tasting menu and wine pairing.', 85.0000000,
        '/images/svc-welcome-dinner.png');

-- Southern Airlines (business_id=2)
INSERT INTO services (business_id, name, description, price, image_url)
VALUES (2, 'BUE-FTE Round Trip Flight', 'Buenos Aires (EZE) - El Calafate (FTE). Economy class, 1 checked bag.',
        320.0000000, '/images/svc-flight-economy.png'),
       (2, 'BUE-FTE Premium Flight',
        'Buenos Aires (EZE) - El Calafate (FTE). Premium class, 2 bags + priority boarding.', 520.0000000,
        '/images/svc-flight-premium.png'),
       (2, 'Group Travel Insurance', 'Medical and luggage coverage for the entire group during the trip.', 45.0000000,
        '/images/svc-travel-insurance.png');

-- Asado & Malbec (business_id=3)
INSERT INTO services (business_id, name, description, price, image_url)
VALUES (3, 'Group BBQ Dinner',
        'Full Argentine BBQ for groups: skirt steak, flank, chorizo, blood sausage. Includes salads and dessert.',
        65.0000000, '/images/svc-bbq-dinner.png'),
       (3, 'Wine Tasting Experience', 'Tasting experience with 5 Mendoza varietals + cheese board.', 40.0000000,
        '/images/svc-wine-tasting.png'),
       (3, 'Group Business Lunch', '3-course menu with drinks included. Ideal for groups of 8+.', 35.0000000,
        '/images/svc-business-lunch.png');

-- Glacier Adventure (business_id=4)
INSERT INTO services (business_id, name, description, price, image_url)
VALUES (4, 'Perito Moreno Full Day Tour',
        'Guided visit to Perito Moreno Glacier with boat tour through the Iceberg Channel. Lunch included.',
        120.0000000, '/images/svc-perito-moreno-tour.png'),
       (4, 'Mini Ice Trekking', '1.5h walk on the glacier with crampons. Includes glacier whisky on the rocks.',
        180.0000000, '/images/svc-mini-ice-trek.png'),
       (4, 'Big Ice - Advanced Trekking',
        '4h trek on the glacier. Intermediate-advanced level. Full equipment included.', 250.0000000,
        '/images/svc-big-ice-trek.png'),
       (4, 'Iceberg Kayaking', 'Kayak ride on Lago Argentino among icebergs. 3 hours with guide.', 150.0000000,
        '/images/svc-iceberg-kayak.png');

-- Calafate Transfers (business_id=5)
INSERT INTO services (business_id, name, description, price, image_url)
VALUES (5, 'Airport-Hotel Transfer (group)', 'Minibus for up to 12 people. FTE Airport - El Calafate hotel area.',
        80.0000000, '/images/svc-airport-transfer.png'),
       (5, 'Hotel-Perito Moreno Transfer', 'Round trip shuttle to Los Glaciares National Park.', 60.0000000,
        '/images/svc-park-transfer.png'),
       (5, 'El Chaltén Day Trip', 'Round trip El Calafate - El Chaltén with photo stops.', 95.0000000,
        '/images/svc-chalten-daytrip.png');

-- Outdoor Patagonia (business_id=6)
INSERT INTO services (business_id, name, description, price, image_url)
VALUES (6, 'Full Trekking Kit (3 days)', 'Trekking poles, 40L backpack, waterproof jacket, thermal fleece.', 55.0000000,
        '/images/svc-trekking-kit.png'),
       (6, 'Crampon & Ice Gear Rental', 'Ice walking equipment. Includes helmet and safety harness.', 30.0000000,
        '/images/svc-crampon-gear.png'),
       (6, 'Adventure Photography Kit', 'Wind-resistant tripod, ND filters, waterproof camera case.', 25.0000000,
        '/images/svc-photo-kit.png');

-- ============================================================================
-- INVOICES (5 invoices in different statuses)
-- ============================================================================

-- Invoice 1: Full group trip - "funding" (active, receiving contributions)
INSERT INTO invoices (organizer_id, contract_invoice_id, name, description, icon,
                      total_amount, token_address, min_participants, penalty_percent,
                      deadline, auto_release, invite_code,
                      status, total_collected, participant_count, version, confirmation_count)
VALUES (2, 1001, 'Patagonia Trip - March 2026',
        '5-day group trip to El Calafate. Includes flights, hotel, excursions and meals.',
        '🏔️', 1850.0000000,
        'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        4, 10, '2026-03-15 23:59:59', false, 'PATA2026MAR',
        'funding', 740.0000000, 4, 0, 0);

-- Invoice 2: New Year's Eve dinner - completed and released
INSERT INTO invoices (organizer_id, contract_invoice_id, name, description, icon,
                      total_amount, token_address, min_participants, penalty_percent,
                      deadline, auto_release, invite_code,
                      status, total_collected, participant_count, version, confirmation_count)
VALUES (4, 1002, 'New Year''s Eve Dinner 2025', 'Group New Year''s Eve dinner at Asado & Malbec. BBQ + wines + toast.',
        '🥂', 630.0000000,
        'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        6, 5, '2025-12-28 20:00:00', false, 'CENA2025FIN',
        'released', 630.0000000, 6, 0, 4);

-- Invoice 3: El Chaltén Trekking - draft (not yet published)
INSERT INTO invoices (organizer_id, contract_invoice_id, name, description, icon,
                      total_amount, token_address, min_participants, penalty_percent,
                      deadline, auto_release, invite_code,
                      status, total_collected, participant_count, version, confirmation_count)
VALUES (5, NULL, 'El Chaltén Trekking - April 2026',
        '3-day trekking expedition in El Chaltén. Fitz Roy and Laguna de los Tres.',
        '🥾', 580.0000000,
        'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        3, 15, '2026-04-10 23:59:59', false, 'TREK2026ABR',
        'draft', 0.0000000, 0, 0, 0);

-- Invoice 4: Cancelled trip
INSERT INTO invoices (organizer_id, contract_invoice_id, name, description, icon,
                      total_amount, token_address, min_participants, penalty_percent,
                      deadline, auto_release, invite_code,
                      status, total_collected, participant_count, version, confirmation_count)
VALUES (3, 1003, 'Bariloche Ski Trip - July 2025', 'Ski week at Cerro Catedral. Minimum participants not reached.',
        '⛷️', 2200.0000000,
        'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        6, 10, '2025-06-15 23:59:59', false, 'ESQUI2025JL',
        'cancelled', 450.0000000, 3, 1, 0);

-- Invoice 5: Photo safari with auto_release, completed
INSERT INTO invoices (organizer_id, contract_invoice_id, name, description, icon,
                      total_amount, token_address, min_participants, penalty_percent,
                      deadline, auto_release, invite_code,
                      status, total_collected, participant_count, version, confirmation_count)
VALUES (7, 1004, 'Iberá Photo Safari - Feb 2026',
        'Photo safari in Iberá Wetlands. 4 days with naturalist guide and gear.',
        '📸', 920.0000000,
        'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        3, 5, '2026-02-20 23:59:59', true, 'FOTO2026FEB',
        'completed', 920.0000000, 4, 0, 0);

-- ============================================================================
-- INVOICE ITEMS
-- ============================================================================

-- Items for Invoice 1: Patagonia Trip (funding)
INSERT INTO invoice_items (invoice_id, service_id, description, amount, recipient_wallet, sort_order)
VALUES (1, 5, 'BUE-FTE round trip flight (per person)', 320.0000000,
        'GDI73WJ4SX7LOG3XZDJC3KCK6ED6E5NBYK2JUBQSPBCNNUI6YX62SUHA', 1),
       (1, 1, 'Hotel Patagonia Sur - Double Room 3 nights (per person)', 225.0000000,
        'GA2C5RFPE6GCKMY3US5PAB6UZLKIGSPIUKSLRB6Q723BM2OATLMD6OAH', 2),
       (1, 12, 'Perito Moreno Full Day Tour', 120.0000000,
        'GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IDF4HHT6V3COGL3DBRWKGOH', 3),
       (1, 13, 'Mini Ice Trekking', 180.0000000,
        'GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IDF4HHT6V3COGL3DBRWKGOH', 4),
       (1, 16, 'Airport-Hotel Transfer (group)', 80.0000000,
        'GC3C4AKRBQLHOJ45U4XG35ESVWRDECWO5XLDGYADO6DPR3L7SDBTDEP4', 5),
       (1, 17, 'Hotel-Perito Moreno Transfer', 60.0000000,
        'GC3C4AKRBQLHOJ45U4XG35ESVWRDECWO5XLDGYADO6DPR3L7SDBTDEP4', 6),
       (1, 4, 'Group Welcome Dinner (per person)', 85.0000000,
        'GA2C5RFPE6GCKMY3US5PAB6UZLKIGSPIUKSLRB6Q723BM2OATLMD6OAH', 7),
       (1, 9, 'Group BBQ Dinner (per person)', 65.0000000,
        'GDVDKQFP665JAO7A2LSHNLQIUNEZ53JDPADAISBMAFWHILE2PGHMRVGH', 8),
       (1, 19, 'Full Trekking Kit (per person)', 55.0000000,
        'GBCFAMVYPJTXHVWRFP7VO7F42MERAHZTTBHP6VGV6MGCOD3FHRMA6TPH', 9);

-- Items for Invoice 2: New Year's Eve Dinner (released)
INSERT INTO invoice_items (invoice_id, service_id, description, amount, recipient_wallet, sort_order)
VALUES (2, 9, 'Full BBQ per person', 65.0000000,
        'GDVDKQFP665JAO7A2LSHNLQIUNEZ53JDPADAISBMAFWHILE2PGHMRVGH', 1),
       (2, 10, 'Wine Tasting per person', 40.0000000,
        'GDVDKQFP665JAO7A2LSHNLQIUNEZ53JDPADAISBMAFWHILE2PGHMRVGH', 2);

-- Items for Invoice 3: El Chaltén Trekking (draft)
INSERT INTO invoice_items (invoice_id, service_id, description, amount, recipient_wallet, sort_order)
VALUES (3, 18, 'El Chaltén Full Day Excursion', 95.0000000,
        'GC3C4AKRBQLHOJ45U4XG35ESVWRDECWO5XLDGYADO6DPR3L7SDBTDEP4', 1),
       (3, 15, 'Big Ice - Advanced Trekking', 250.0000000,
        'GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IDF4HHT6V3COGL3DBRWKGOH', 2),
       (3, 19, 'Full Trekking Kit (3 days)', 55.0000000,
        'GBCFAMVYPJTXHVWRFP7VO7F42MERAHZTTBHP6VGV6MGCOD3FHRMA6TPH', 3),
       (3, 2, 'Single Room 3 nights', 280.0000000,
        'GA2C5RFPE6GCKMY3US5PAB6UZLKIGSPIUKSLRB6Q723BM2OATLMD6OAH', 4);

-- Items for Invoice 4: Cancelled ski trip
INSERT INTO invoice_items (invoice_id, service_id, description, amount, recipient_wallet, sort_order)
VALUES (4, NULL, 'Weekly ski pass Cerro Catedral', 350.0000000,
        'GA2C5RFPE6GCKMY3US5PAB6UZLKIGSPIUKSLRB6Q723BM2OATLMD6OAH', 1),
       (4, NULL, 'Full ski equipment rental', 150.0000000,
        'GBCFAMVYPJTXHVWRFP7VO7F42MERAHZTTBHP6VGV6MGCOD3FHRMA6TPH', 2),
       (4, NULL, 'Group cabin lodging (7 nights)', 1200.0000000,
        'GA2C5RFPE6GCKMY3US5PAB6UZLKIGSPIUKSLRB6Q723BM2OATLMD6OAH', 3),
       (4, NULL, 'Group ski lessons (3 days)', 200.0000000,
        'GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IDF4HHT6V3COGL3DBRWKGOH', 4);

-- Items for Invoice 5: Photo Safari (completed)
INSERT INTO invoice_items (invoice_id, service_id, description, amount, recipient_wallet, sort_order)
VALUES (5, NULL, 'Naturalist guide (4 days)', 300.0000000,
        'GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IDF4HHT6V3COGL3DBRWKGOH', 1),
       (5, NULL, 'Iberá lodge accommodation (4 nights)', 400.0000000,
        'GA2C5RFPE6GCKMY3US5PAB6UZLKIGSPIUKSLRB6Q723BM2OATLMD6OAH', 2),
       (5, 20, 'Adventure Photography Kit per person', 25.0000000,
        'GBCFAMVYPJTXHVWRFP7VO7F42MERAHZTTBHP6VGV6MGCOD3FHRMA6TPH', 3),
       (5, NULL, '4x4 transport through the wetlands', 195.0000000,
        'GC3C4AKRBQLHOJ45U4XG35ESVWRDECWO5XLDGYADO6DPR3L7SDBTDEP4', 4);

-- ============================================================================
-- PARTICIPANTS
-- ============================================================================

-- Invoice 1: Patagonia Trip (4 active participants, funding)
INSERT INTO invoice_participants (invoice_id, user_id, contributed_amount, contributed_at_version, status)
VALUES (1, 2, 462.5000000, 0, 'active'), -- maria_garcia (organizer) - paid full share
       (1, 3, 185.0000000, 0, 'active'), -- carlos_lopez - partial payment
       (1, 5, 92.5000000, 0, 'active'),  -- pedro_sanchez - partial payment
       (1, 8, 0.0000000, 0, 'active');
-- sofia_torres - joined but hasn't paid yet

-- Invoice 2: New Year's Eve Dinner (6 participants, released)
INSERT INTO invoice_participants (invoice_id, user_id, contributed_amount, contributed_at_version, confirmed_release,
                                  status)
VALUES (2, 4, 105.0000000, 0, true, 'active'),  -- ana_martinez (organizer)
       (2, 2, 105.0000000, 0, true, 'active'),  -- maria_garcia
       (2, 3, 105.0000000, 0, true, 'active'),  -- carlos_lopez
       (2, 5, 105.0000000, 0, false, 'active'), -- pedro_sanchez
       (2, 6, 105.0000000, 0, true, 'active'),  -- lucia_fernandez
       (2, 7, 105.0000000, 0, false, 'active');
-- diego_ramirez

-- Invoice 4: Cancelled ski trip (3 participants, 1 withdrew with penalty)
INSERT INTO invoice_participants (invoice_id, user_id, contributed_amount, contributed_at_version, penalty_amount,
                                  status)
VALUES (4, 3, 200.0000000, 0, 0.0000000, 'active'), -- carlos_lopez
       (4, 6, 150.0000000, 1, 0.0000000, 'active'), -- lucia_fernandez (contributed at v1)
       (4, 7, 0.0000000, 0, 10.0000000, 'withdrawn');
-- diego_ramirez - withdrew, paid penalty

-- Invoice 5: Photo Safari (4 participants, completed)
INSERT INTO invoice_participants (invoice_id, user_id, contributed_amount, contributed_at_version, status)
VALUES (5, 8, 230.0000000, 0, 'active'), -- sofia_torres (organizer)
       (5, 2, 230.0000000, 0, 'active'), -- maria_garcia
       (5, 5, 230.0000000, 0, 'active'), -- pedro_sanchez
       (5, 6, 230.0000000, 0, 'active');
-- lucia_fernandez

-- ============================================================================
-- INVOICE MODIFICATIONS
-- ============================================================================

-- Invoice 4 had a modification (cabin change)
INSERT INTO invoice_modifications (invoice_id, version, change_summary, items_snapshot)
VALUES (4, 1, 'Switched to a cheaper group cabin and added ski lessons.',
        '[
          {"description": "Weekly ski pass Cerro Catedral", "amount": 350},
          {"description": "Full ski equipment rental", "amount": 150},
          {"description": "Group cabin lodging (7 nights)", "amount": 1200},
          {"description": "Group ski lessons (3 days)", "amount": 200}
        ]'::jsonb);

-- ============================================================================
-- TRANSACTIONS (blockchain history)
-- ============================================================================

-- Transactions for Invoice 1 (funding)
INSERT INTO transactions (invoice_id, user_id, tx_hash, type, amount, ledger_sequence, event_data)
VALUES (1, 2, 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
        'create', 1850.0000000, 50001,
        '{"trip_id": 1001, "organizer": "GCRSI4EKBFJ2UNBJBHSGBIBYV3PBM3OKA4OPMTDQXFIHAFTUFMH6OYTJ", "target_amount": 18500000000}'::jsonb),

       (1, 2, 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b3',
        'contribute', 462.5000000, 50010,
        '{"trip_id": 1001, "participant": "GCRSI4EKBFJ2UNBJBHSGBIBYV3PBM3OKA4OPMTDQXFIHAFTUFMH6OYTJ", "amount": 4625000000}'::jsonb),

       (1, 3, 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b4',
        'contribute', 185.0000000, 50015,
        '{"trip_id": 1001, "participant": "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOBD3BPSIDGQ2HKY", "amount": 1850000000}'::jsonb),

       (1, 5, 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b5',
        'contribute', 92.5000000, 50020,
        '{"trip_id": 1001, "participant": "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNY", "amount": 925000000}'::jsonb);

-- Transactions for Invoice 2 (released)
INSERT INTO transactions (invoice_id, user_id, tx_hash, type, amount, ledger_sequence, event_data)
VALUES (2, 4, 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b6',
        'create', 630.0000000, 48001,
        '{"trip_id": 1002, "organizer": "GBNHWCAACPUFKR6DWOCDIHMQPYRCZLSXWXFAG3IUQDXDGNLFMQXHGNEV"}'::jsonb),

       (2, 4, 'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b7',
        'release', 630.0000000, 49500,
        '{"trip_id": 1002, "total_released": 6300000000, "recipients_count": 2}'::jsonb);

-- Transactions for Invoice 4 (cancelled)
INSERT INTO transactions (invoice_id, user_id, tx_hash, type, amount, ledger_sequence, event_data)
VALUES (4, 3, 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b8',
        'create', 2200.0000000, 45001,
        '{"trip_id": 1003, "organizer": "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOBD3BPSIDGQ2HKY"}'::jsonb),

       (4, 7, 'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b9',
        'withdraw', 90.0000000, 46200,
        '{"trip_id": 1003, "participant": "GCFONE23AB7Y6C5YZOMKUKGETPIAJA752ZKLHKJAGRGZZC7P6FHACIWN", "refunded": 900000000, "penalty": 100000000}'::jsonb),

       (4, 3, 'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1c0',
        'cancel', 450.0000000, 47000,
        '{"trip_id": 1003, "total_refunded": 4500000000}'::jsonb);

-- Transactions for Invoice 5 (completed)
INSERT INTO transactions (invoice_id, user_id, tx_hash, type, amount, ledger_sequence, event_data)
VALUES (5, 8, 'd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1c1',
        'create', 920.0000000, 49001,
        '{"trip_id": 1004, "organizer": "GBDEVU63Y6NTHJQQZIKVTC23NWLQHMWICWQXHPRPSFUUMFCAHYNESQMN", "auto_release": true}'::jsonb),

       (5, 8, 'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1c2',
        'contribute', 230.0000000, 49010, NULL),

       (5, 2, 'f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1c3',
        'contribute', 230.0000000, 49020, NULL),

       (5, 5, 'a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1c4',
        'contribute', 230.0000000, 49030, NULL),

       (5, 6, 'b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1c5',
        'contribute', 230.0000000, 49040, NULL);

COMMIT;

-- ============================================================================
-- Summary of inserted data:
-- ============================================================================
-- 7 new users (+ 1 demo_user = 8 total)
-- 6 businesses (lodging, transport, dining, tourism, equipment)
-- 20 services across businesses
-- 5 invoices (1 funding, 1 released, 1 draft, 1 cancelled, 1 completed)
-- 23 invoice items
-- 17 invoice participants
-- 1 invoice modification
-- 14 blockchain transactions
-- ============================================================================
