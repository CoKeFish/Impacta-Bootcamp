-- ============================================================================
-- NEGOCIOS DE PRUEBA
-- ============================================================================

-- 1. Caribbean Adventures (Tours & Aventura)
INSERT INTO businesses (owner_id, name, category, description, logo_url, wallet_address, contact_email, location, location_data, schedule, contact_info)
VALUES (
  2,
  'Caribbean Adventures',
  'Tours & Aventura',
  'Experiencias de aventura inolvidables en el Caribe colombiano. Catamaranes, zip-lines, snorkeling y mas.',
  '/images/logo-adventures.png',
  'GAVWT64LAMYH2YE5HE7DBBK7E67P6WQMWIZZSKZYPCQSLXTVAFP6TM3Q',
  'info@caribbeanadventures.co',
  'Cartagena de Indias, Colombia',
  '{"country": "Colombia", "country_code": "CO", "city": "Cartagena de Indias", "address": "Muelle de la Bodeguita, Centro Historico", "lat": 10.4236, "lng": -75.5498}',
  '{"not_applicable": false, "timezone": "America/Bogota", "slots": {"monday": [{"from": "07:00", "to": "17:00"}], "tuesday": [{"from": "07:00", "to": "17:00"}], "wednesday": [{"from": "07:00", "to": "17:00"}], "thursday": [{"from": "07:00", "to": "17:00"}], "friday": [{"from": "07:00", "to": "17:00"}], "saturday": [{"from": "06:00", "to": "18:00"}], "sunday": [{"from": "06:00", "to": "18:00"}]}}',
  '{"email": "info@caribbeanadventures.co", "phone": "+57 315 456 7890", "whatsapp": "+57 315 456 7890", "website": "https://caribbeanadventures.co"}'
);

-- 2. Sabor Caribeno (Restaurante)
INSERT INTO businesses (owner_id, name, category, description, logo_url, wallet_address, contact_email, location, location_data, schedule, contact_info)
VALUES (
  2,
  'Sabor Caribeno',
  'Gastronomia',
  'Cocina tradicional colombiana con los mejores sabores del Caribe. Bandeja paisa, ceviches, arroces de mariscos y cafe artesanal de origen.',
  '/images/logo-sabor.png',
  'GAVWT64LAMYH2YE5HE7DBBK7E67P6WQMWIZZSKZYPCQSLXTVAFP6TM3Q',
  'reservas@saborcaribeno.co',
  'Santa Marta, Colombia',
  '{"country": "Colombia", "country_code": "CO", "city": "Santa Marta", "address": "Calle 19 #3-62, Centro Historico", "lat": 11.2408, "lng": -74.1990}',
  '{"not_applicable": false, "timezone": "America/Bogota", "slots": {"monday": [], "tuesday": [{"from": "12:00", "to": "22:00"}], "wednesday": [{"from": "12:00", "to": "22:00"}], "thursday": [{"from": "12:00", "to": "22:00"}], "friday": [{"from": "12:00", "to": "23:00"}], "saturday": [{"from": "11:00", "to": "23:00"}], "sunday": [{"from": "11:00", "to": "20:00"}]}}',
  '{"email": "reservas@saborcaribeno.co", "phone": "+57 300 123 4567", "whatsapp": "+57 300 123 4567"}'
);

-- 3. Hotel Coral (Hospedaje)
INSERT INTO businesses (owner_id, name, category, description, logo_url, wallet_address, contact_email, location, location_data, schedule, contact_info)
VALUES (
  2,
  'Hotel Coral',
  'Hospedaje',
  'Boutique hotel frente al mar con vista al Caribe. Habitaciones modernas con balcon, piscina infinita y acceso directo a la playa.',
  '/images/logo-coral.png',
  'GAVWT64LAMYH2YE5HE7DBBK7E67P6WQMWIZZSKZYPCQSLXTVAFP6TM3Q',
  'reservas@hotelcoral.co',
  'San Andres Isla, Colombia',
  '{"country": "Colombia", "country_code": "CO", "city": "San Andres", "address": "Av. Colombia #1-19, Frente al mar", "lat": 12.5847, "lng": -81.7006}',
  '{"not_applicable": true}',
  '{"email": "reservas@hotelcoral.co", "phone": "+57 318 765 4321", "whatsapp": "+57 318 765 4321", "website": "https://hotelcoral.co"}'
);

-- 4. Deep Blue Diving (Buceo)
INSERT INTO businesses (owner_id, name, category, description, logo_url, wallet_address, contact_email, location, location_data, schedule, contact_info)
VALUES (
  2,
  'Deep Blue Diving',
  'Deportes Acuaticos',
  'Centro de buceo certificado PADI con 15 anos de experiencia. Cursos de buceo, snorkeling, inmersiones guiadas y expediciones a arrecifes de coral.',
  '/images/logo-diving.png',
  'GAVWT64LAMYH2YE5HE7DBBK7E67P6WQMWIZZSKZYPCQSLXTVAFP6TM3Q',
  'dive@deepbluediving.co',
  'Providencia, Colombia',
  '{"country": "Colombia", "country_code": "CO", "city": "Providencia", "address": "Bahia Suroeste, Providencia Island", "lat": 13.3500, "lng": -81.3753}',
  '{"not_applicable": false, "timezone": "America/Bogota", "slots": {"monday": [{"from": "06:00", "to": "16:00"}], "tuesday": [{"from": "06:00", "to": "16:00"}], "wednesday": [{"from": "06:00", "to": "16:00"}], "thursday": [{"from": "06:00", "to": "16:00"}], "friday": [{"from": "06:00", "to": "16:00"}], "saturday": [{"from": "06:00", "to": "15:00"}], "sunday": []}}',
  '{"email": "dive@deepbluediving.co", "phone": "+57 311 234 5678", "whatsapp": "+57 311 234 5678", "website": "https://deepbluediving.co"}'
);

-- ============================================================================
-- SERVICIOS DE PRUEBA
-- ============================================================================

-- Caribbean Adventures services (business_id = 1)
INSERT INTO services (business_id, name, description, price, image_url, location, location_data) VALUES
(1, 'Tour en Catamaran - Islas del Rosario', 'Dia completo navegando por las Islas del Rosario en catamaran privado. Incluye snorkeling, almuerzo buffet de mariscos, barra libre y parada en Playa Blanca. Maximo 20 personas.', 85.0000000, '/images/catamaran.png', 'Islas del Rosario, Cartagena', '{"country": "Colombia", "country_code": "CO", "city": "Cartagena", "address": "Islas del Rosario", "lat": 10.1750, "lng": -75.7450}');

INSERT INTO services (business_id, name, description, price, image_url, location, location_data) VALUES
(1, 'Zip-Line sobre la Selva Tropical', 'Aventura de 3 horas volando sobre la copa de los arboles del bosque tropical. 7 cables de diferentes alturas con vistas espectaculares al mar. Incluye transporte y equipo.', 45.0000000, '/images/zipline.png', 'Baru, Cartagena', '{"country": "Colombia", "country_code": "CO", "city": "Cartagena", "address": "Selva de Baru", "lat": 10.2200, "lng": -75.5900}');

-- Sabor Caribeno services (business_id = 2)
INSERT INTO services (business_id, name, description, price, image_url) VALUES
(2, 'Bandeja Paisa Tradicional', 'El plato mas emblematico de Colombia: frijoles, arroz, chicharron, carne molida, chorizo, huevo frito, tajadas de platano, arepa y aguacate. Porcion generosa para compartir.', 12.5000000, '/images/bandeja.png');

INSERT INTO services (business_id, name, description, price, image_url) VALUES
(2, 'Experiencia de Cafe Artesanal', 'Degustacion guiada de 5 variedades de cafe colombiano de origen unico. Incluye explicacion del proceso de cultivo, tostado y preparacion. Acompanado de postres tipicos.', 18.0000000, '/images/coffee.png');

-- Hotel Coral services (business_id = 3)
INSERT INTO services (business_id, name, description, price, image_url, schedule) VALUES
(3, 'Suite Vista al Mar - Por noche', 'Suite premium con balcon privado frente al Caribe. Cama king, minibar incluido, desayuno buffet, acceso a piscina infinita y playa privada. Wi-Fi de alta velocidad.', 120.0000000, '/images/hotel-room.png', '{"not_applicable": true}');

-- Deep Blue Diving services (business_id = 4)
INSERT INTO services (business_id, name, description, price, image_url, location, location_data) VALUES
(4, 'Inmersion en Arrecife de Coral', 'Buceo guiado en los arrecifes de Providencia, la tercera barrera de coral mas grande del mundo. 2 inmersiones de 45 min cada una. Incluye equipo completo, instructor y fotos subacuaticas.', 95.0000000, '/images/diving.png', 'Barrera de Coral, Providencia', '{"country": "Colombia", "country_code": "CO", "city": "Providencia", "address": "Old Providence McBean Lagoon", "lat": 13.3650, "lng": -81.3600}');

-- Verify
SELECT 'Businesses: ' || count(*) FROM businesses
UNION ALL
SELECT 'Services: ' || count(*) FROM services;
