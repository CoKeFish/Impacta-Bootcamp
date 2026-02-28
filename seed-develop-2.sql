-- ============================================================================
-- NEGOCIOS DE PRUEBA - BATCH 2
-- ============================================================================

-- 5. Olas del Pacifico (Surf)
INSERT INTO businesses (owner_id, name, category, description, logo_url, wallet_address, contact_email, location, location_data, schedule, contact_info)
VALUES (
  2,
  'Olas del Pacifico',
  'Deportes Acuaticos',
  'Escuela de surf en la costa del Pacifico colombiano. Clases para todos los niveles, alquiler de tablas y surf trips guiados a los mejores spots.',
  '/images/logo-olas.png',
  'GAVWT64LAMYH2YE5HE7DBBK7E67P6WQMWIZZSKZYPCQSLXTVAFP6TM3Q',
  'hola@olasdelpacifico.co',
  'Nuqui, Choco, Colombia',
  '{"country": "Colombia", "country_code": "CO", "city": "Nuqui", "address": "Playa Guachalito, Nuqui", "lat": 5.7130, "lng": -77.2740}',
  '{"not_applicable": false, "timezone": "America/Bogota", "slots": {"monday": [{"from": "06:00", "to": "17:00"}], "tuesday": [{"from": "06:00", "to": "17:00"}], "wednesday": [{"from": "06:00", "to": "17:00"}], "thursday": [{"from": "06:00", "to": "17:00"}], "friday": [{"from": "06:00", "to": "17:00"}], "saturday": [{"from": "05:30", "to": "18:00"}], "sunday": [{"from": "05:30", "to": "18:00"}]}}',
  '{"email": "hola@olasdelpacifico.co", "phone": "+57 320 987 6543", "whatsapp": "+57 320 987 6543"}'
);

-- 6. Selva Spa (Bienestar)
INSERT INTO businesses (owner_id, name, category, description, logo_url, wallet_address, contact_email, location, location_data, schedule, contact_info)
VALUES (
  2,
  'Selva Spa',
  'Bienestar',
  'Spa de lujo en medio de la selva tropical. Tratamientos ancestrales con ingredientes naturales, piscinas termales y rituales de relajacion profunda.',
  '/images/logo-selva.png',
  'GAVWT64LAMYH2YE5HE7DBBK7E67P6WQMWIZZSKZYPCQSLXTVAFP6TM3Q',
  'reservas@selvaspa.co',
  'Tayrona, Santa Marta, Colombia',
  '{"country": "Colombia", "country_code": "CO", "city": "Santa Marta", "address": "Via Tayrona Km 8, Santa Marta", "lat": 11.3000, "lng": -74.0500}',
  '{"not_applicable": false, "timezone": "America/Bogota", "slots": {"monday": [{"from": "09:00", "to": "20:00"}], "tuesday": [{"from": "09:00", "to": "20:00"}], "wednesday": [{"from": "09:00", "to": "20:00"}], "thursday": [{"from": "09:00", "to": "20:00"}], "friday": [{"from": "09:00", "to": "21:00"}], "saturday": [{"from": "08:00", "to": "21:00"}], "sunday": [{"from": "08:00", "to": "19:00"}]}}',
  '{"email": "reservas@selvaspa.co", "phone": "+57 317 555 1234", "whatsapp": "+57 317 555 1234", "website": "https://selvaspa.co"}'
);

-- 7. Colombia Salvaje (Ecoturismo)
INSERT INTO businesses (owner_id, name, category, description, logo_url, wallet_address, contact_email, location, location_data, schedule, contact_info)
VALUES (
  2,
  'Colombia Salvaje',
  'Ecoturismo',
  'Tours fotograficos de vida silvestre y avistamiento de especies. Expediciones al Choco, Amazonia y Sierra Nevada guiadas por biologos expertos.',
  '/images/logo-salvaje.png',
  'GAVWT64LAMYH2YE5HE7DBBK7E67P6WQMWIZZSKZYPCQSLXTVAFP6TM3Q',
  'info@colombiasalvaje.co',
  'Cali, Colombia',
  '{"country": "Colombia", "country_code": "CO", "city": "Cali", "address": "Calle 5 #38-25, San Fernando", "lat": 3.4372, "lng": -76.5225}',
  '{"not_applicable": false, "timezone": "America/Bogota", "slots": {"monday": [{"from": "08:00", "to": "18:00"}], "tuesday": [{"from": "08:00", "to": "18:00"}], "wednesday": [{"from": "08:00", "to": "18:00"}], "thursday": [{"from": "08:00", "to": "18:00"}], "friday": [{"from": "08:00", "to": "18:00"}], "saturday": [{"from": "07:00", "to": "16:00"}], "sunday": []}}',
  '{"email": "info@colombiasalvaje.co", "phone": "+57 312 876 5432", "whatsapp": "+57 312 876 5432", "website": "https://colombiasalvaje.co"}'
);

-- 8. Viento del Caribe (Yates)
INSERT INTO businesses (owner_id, name, category, description, logo_url, wallet_address, contact_email, location, location_data, schedule, contact_info)
VALUES (
  2,
  'Viento del Caribe',
  'Navegacion',
  'Alquiler de yates y veleros de lujo en el Caribe colombiano. Experiencias privadas para grupos, puestas de sol, island hopping y eventos corporativos.',
  '/images/logo-viento.png',
  'GAVWT64LAMYH2YE5HE7DBBK7E67P6WQMWIZZSKZYPCQSLXTVAFP6TM3Q',
  'charter@vientodelcaribe.co',
  'Cartagena de Indias, Colombia',
  '{"country": "Colombia", "country_code": "CO", "city": "Cartagena de Indias", "address": "Club Nautico, Manga", "lat": 10.4100, "lng": -75.5400}',
  '{"not_applicable": false, "timezone": "America/Bogota", "slots": {"monday": [{"from": "08:00", "to": "18:00"}], "tuesday": [{"from": "08:00", "to": "18:00"}], "wednesday": [{"from": "08:00", "to": "18:00"}], "thursday": [{"from": "08:00", "to": "18:00"}], "friday": [{"from": "08:00", "to": "20:00"}], "saturday": [{"from": "07:00", "to": "20:00"}], "sunday": [{"from": "07:00", "to": "20:00"}]}}',
  '{"email": "charter@vientodelcaribe.co", "phone": "+57 315 222 3344", "whatsapp": "+57 315 222 3344", "website": "https://vientodelcaribe.co"}'
);

-- ============================================================================
-- SERVICIOS DE PRUEBA - BATCH 2
-- ============================================================================

-- Olas del Pacifico (business_id = 5)
INSERT INTO services (business_id, name, description, price, image_url, location, location_data) VALUES
(5, 'Clase de Surf Grupal', 'Clase de surf de 2 horas para principiantes e intermedios. Grupos de maximo 6 personas con instructor certificado. Incluye tabla, lycra y seguro. Las mejores olas del Pacifico colombiano.', 35.0000000, '/images/surf-lesson.png', 'Playa Guachalito, Nuqui', '{"country": "Colombia", "country_code": "CO", "city": "Nuqui", "address": "Playa Guachalito", "lat": 5.7130, "lng": -77.2740}');

INSERT INTO services (business_id, name, description, price, image_url, location, location_data) VALUES
(5, 'Alquiler de Tabla por Dia', 'Alquiler de tabla de surf premium por dia completo. Disponemos de shortboards, longboards y funboards para todos los niveles. Incluye leash y cera.', 15.0000000, '/images/surfboard-rental.png', 'Playa Guachalito, Nuqui', '{"country": "Colombia", "country_code": "CO", "city": "Nuqui", "address": "Playa Guachalito", "lat": 5.7130, "lng": -77.2740}');

-- Selva Spa (business_id = 6)
INSERT INTO services (business_id, name, description, price, image_url) VALUES
(6, 'Masaje con Piedras Volcanicas', 'Tratamiento de 90 minutos con piedras calientes volcanicas y aceites esenciales de la selva. Relaja musculos profundos y equilibra la energia. Incluye te de hierbas y fruta fresca.', 65.0000000, '/images/spa-massage.png');

INSERT INTO services (business_id, name, description, price, image_url) VALUES
(6, 'Circuito Termal Completo', 'Acceso de dia completo a piscinas termales, bano de lodo volcanico, sauna de eucalipto, duchas de cascada y zona de relajacion. Incluye toallas, bata y almuerzo saludable.', 50.0000000, '/images/thermal-pool.png');

-- Colombia Salvaje (business_id = 7)
INSERT INTO services (business_id, name, description, price, image_url, location, location_data) VALUES
(7, 'Safari Fotografico de Aves', 'Expedicion de dia completo al bosque de niebla para avistamiento de tucanes, quetzales y colibries. Guia biologo experto, transporte 4x4, almuerzo campestre y hasta 40 especies garantizadas.', 75.0000000, '/images/toucan.png', 'Bosque de Niebla, Cali', '{"country": "Colombia", "country_code": "CO", "city": "Cali", "address": "Reserva Natural San Cipriano", "lat": 3.8000, "lng": -76.8900}');

INSERT INTO services (business_id, name, description, price, image_url, location, location_data) VALUES
(7, 'Avistamiento de Ballenas', 'Tour de 4 horas en lancha para observar ballenas jorobadas en el Pacifico colombiano. Temporada julio-noviembre. Incluye chaleco, binoculares, guia marino y snack a bordo.', 55.0000000, '/images/whale-watching.png', 'Bahia Solano, Choco', '{"country": "Colombia", "country_code": "CO", "city": "Bahia Solano", "address": "Muelle de Bahia Solano", "lat": 6.2200, "lng": -77.4050}');

-- Viento del Caribe (business_id = 8)
INSERT INTO services (business_id, name, description, price, image_url, location, location_data) VALUES
(8, 'Dia en Yate Privado', 'Yate de lujo de 42 pies para hasta 12 personas. Recorrido por Islas del Rosario con paradas para snorkeling y natacion. Incluye capitan, marinero, almuerzo gourmet y barra libre premium.', 350.0000000, '/images/yacht-bay.png', 'Islas del Rosario, Cartagena', '{"country": "Colombia", "country_code": "CO", "city": "Cartagena", "address": "Club Nautico, Manga", "lat": 10.4100, "lng": -75.5400}');

INSERT INTO services (business_id, name, description, price, image_url, location, location_data) VALUES
(8, 'Sunset Cruise con Champagne', 'Navegacion al atardecer de 3 horas por la bahia de Cartagena y las murallas iluminadas. Incluye botella de champagne, tabla de quesos y musica en vivo. Experiencia romantica para parejas o grupos.', 120.0000000, '/images/yacht-sunset.png', 'Bahia de Cartagena', '{"country": "Colombia", "country_code": "CO", "city": "Cartagena", "address": "Muelle Club Nautico", "lat": 10.4100, "lng": -75.5400}');

-- Verify
SELECT 'Businesses: ' || count(*) FROM businesses
UNION ALL
SELECT 'Services: ' || count(*) FROM services;
