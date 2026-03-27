-- =============================================================================
-- 056_proloco_external_sources.sql — Add 50 Pro Loco Facebook/Instagram pages
-- These are active Pro Loco associations across all 7 Veneto provinces.
-- They post sagre events, locandine, and food festival announcements.
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- =============================================
-- FACEBOOK PAGES (39 pages)
-- =============================================

INSERT INTO public.external_sources (type, name, url, notes, is_active) VALUES

-- === PADOVA (PD) — Colli Euganei + Pianura ===
('facebook', 'Pro Loco Monselice (PD)', 'https://www.facebook.com/prolocomonselice/events', 'Colli Euganei, Rocca in Fiore, 9.4K likes', true),
('facebook', 'Pro Loco Montegrotto Terme (PD)', 'https://www.facebook.com/prolocodimontegrottoterme/events', 'Terme Euganee, sagre estive', true),
('facebook', 'Pro Loco Vo'' Euganeo (PD)', 'https://www.facebook.com/prolocovoeuganeo/events', 'Colli Euganei, 2.8K likes', true),
('facebook', 'Pro Loco Abano Terme (PD)', 'https://www.facebook.com/prolocoabanoterme/events', 'Terme, sagre e feste', true),
('facebook', 'Pro Loco Selvazzano (PD)', 'https://www.facebook.com/proloco.selvazzano/events', 'Hinterland Padova', true),
('facebook', 'Pro Loco Piove di Sacco (PD)', 'https://www.facebook.com/prolocopiove/events', 'Saccisica, sagre', true),
('facebook', 'Pro Loco Cittadella (PD)', 'https://www.facebook.com/procittadella/events', 'Alta Padovana, sagre e feste', true),
('facebook', 'Pro Loco Este (PD)', 'https://www.facebook.com/prolocoeste/events', 'Bassa Padovana, Colli Euganei sud', true),

-- === VICENZA (VI) — Pedemontana + Valli ===
('facebook', 'Pro Loco Breganze (VI)', 'https://www.facebook.com/proloco.breganze/events', 'Pedemontana, 4.9K likes, torresano e vino', true),
('facebook', 'Festa del Bacala Pro Sandrigo (VI)', 'https://www.facebook.com/festadelbacala.prosandrigo/events', 'Sagra famosa bacala alla vicentina', true),
('facebook', 'Pro Loco Thiene (VI)', 'https://www.facebook.com/proloco.thiene/events', 'Medio Astico, sagre attive', true),
('facebook', 'Pro Loco Schio (VI)', 'https://www.facebook.com/prolocoschio/events', 'Alto vicentino, sagre e feste', true),
('facebook', 'Pro Loco Arzignano (VI)', 'https://www.facebook.com/prolocodiarzignano/events', 'Val Chiampo, 3.1K likes', true),
('facebook', 'Pro Loco Chiampo (VI)', 'https://www.facebook.com/ProLocoChiampo/events', 'Val Chiampo, 2.3K likes', true),
('facebook', 'Pro Valdagno (VI)', 'https://www.facebook.com/provaldagno/events', 'Val d''Agno, 2.4K likes', true),
('facebook', 'Pro Loco Lonigo (VI)', 'https://www.facebook.com/Pro-Loco-Lonigo-100077305587533/events', 'Basso vicentino', true),
('facebook', 'Pro Loco Bassano del Grappa (VI)', 'https://www.facebook.com/Associazione-Pro-Bassano-100081162166517/events', 'Bassano, sagre e feste', true),
('facebook', 'Pro Loco Recoaro Terme (VI)', 'https://www.facebook.com/proloco.recoaroterme/events', 'Piccole Dolomiti, 9K likes, molto attiva', true),
('facebook', 'Pro Loco Asiago (VI)', 'https://www.facebook.com/prolocoasiagoesasso/events', 'Altopiano, sagre montane', true),
('facebook', 'Pro Loco Bolzano Vicentino (VI)', 'https://www.facebook.com/proloco.bolzanovicentino/events', 'Sagra di Qualita 2026, molto attiva', true),
('facebook', 'UNPLI Vicenza Pro Loco (VI)', 'https://www.facebook.com/unplivicenza/events', 'Coordinamento provinciale, tutti gli eventi VI', true),

-- === TREVISO (TV) — Marca Trevigiana + Prosecco ===
('facebook', 'Pro Loco Castelfranco Veneto (TV)', 'https://www.facebook.com/proloco.castelfrancoveneto/events', '6K likes, sagre e feste', true),
('facebook', 'Pro Loco Valdobbiadene (TV)', 'https://www.facebook.com/prolocovaldo/events', 'Prosecco hills, 4K likes', true),
('facebook', 'Pro Loco Conegliano (TV)', 'https://www.facebook.com/prolococonegliano/events', 'Prosecco DOCG, sagre', true),
('facebook', 'Pro Loco Mogliano Veneto (TV)', 'https://www.facebook.com/prolocoMoglianoVeneto/events', 'Mostra del Radicchio', true),
('facebook', 'Pro Loco Combai (TV)', 'https://www.facebook.com/prolococombai/events', 'Festa dei Marroni, 8.3K likes, molto attiva', true),
('facebook', 'Pro Loco Pieve di Soligo (TV)', 'https://www.facebook.com/SpiedoGigante.PieveDiSoligo/events', 'Spiedo Gigante, Sagra di Qualita 2026', true),

-- === VERONA (VR) — Basso Veronese + Lago ===
('facebook', 'Pro Loco Valeggio sul Mincio (VR)', 'https://www.facebook.com/ProLocoValeggio/events', 'Festa del Nodo d''Amore, 31.7K likes, molto attiva', true),
('facebook', 'Pro Loco Soave (VR)', 'https://www.facebook.com/SoaveProLoco/events', 'Fiera del Gusto, 11.8K likes', true),
('facebook', 'Pro Loco Isola della Scala (VR)', 'https://www.facebook.com/Prolocoisoladellascala/events', 'Fiera del Riso Nano, 1.5K likes', true),
('facebook', 'Pro Loco Legnago (VR)', 'https://www.facebook.com/prolocolegnago/events', 'Basso veronese, 3.8K likes', true),
('facebook', 'Pro Loco Bussolengo (VR)', 'https://www.facebook.com/prolocobussolengo/events', '2.3K likes, territorio promotion', true),

-- === VENEZIA (VE) — Costiere + Entroterra ===
('facebook', 'Pro Loco Mira - Riviera del Brenta (VE)', 'https://www.facebook.com/proloco.mira/events', '8.6K likes, sagre Riviera', true),
('facebook', 'Pro Loco Dolo (VE)', 'https://www.facebook.com/proloco.dolo/events', 'Riviera del Brenta', true),
('facebook', 'Pro Loco Rosolina (VE)', 'https://www.facebook.com/proloco.rosolina/events', 'Delta del Po, 7.3K likes', true),
('facebook', 'Pro Loco Caorle (VE)', 'https://www.facebook.com/www.prolococaorle.it/events', 'Festa del Pesce, costiera', true),
('facebook', 'Pro Loco Portogruaro (VE)', 'https://www.facebook.com/portogruaro.proloco/events', 'Veneto Orientale, 4.8K likes', true),
('facebook', 'Pro Loco Noale (VE)', 'https://www.facebook.com/proloconoale/events', 'Miranese, 9K likes', true),
('facebook', 'Pro Loco Mirano (VE)', 'https://www.facebook.com/ProlocoMirano/events', 'Fiera de l''Oca, Radicchio', true),
('facebook', 'Pro Loco San Dona di Piave (VE)', 'https://www.facebook.com/prolocosandonadipiave/events', 'Basso Piave, 1.3K likes', true),

-- === BELLUNO (BL) — Dolomiti ===
('facebook', 'Pro Loco Tiziano Pieve di Cadore (BL)', 'https://www.facebook.com/proloco.tizianopieve/events', 'Cadore, 4.3K likes', true),
('facebook', 'Pro Loco Auronzo di Cadore (BL)', 'https://www.facebook.com/prolocoauronzo/events', 'Cadore, 4.1K likes', true),
('facebook', 'Pro Loco Ponte nelle Alpi (BL)', 'https://www.facebook.com/proloco.pontealpi/events', 'Valbelluna, sagre montane', true),

-- === ROVIGO (RO) — Polesine ===
('facebook', 'Pro Loco Badia Polesine (RO)', 'https://www.facebook.com/prolocobadia/events', 'Polesine, 2.7K likes', true)

ON CONFLICT (url) DO NOTHING;


-- =============================================
-- INSTAGRAM PAGES (8 pages)
-- =============================================

INSERT INTO public.external_sources (type, name, url, notes, is_active) VALUES

('instagram', 'Pro Loco Dueville (VI)', 'https://www.instagram.com/proloco.dueville/', 'Pedemontana vicentina, 139 followers', true),
('instagram', 'Pro Loco Piove di Sacco (PD)', 'https://www.instagram.com/prolocopiovedisacco/', 'Saccisica, 1.1K followers', true),
('instagram', 'Pro Loco Camposampiero (PD)', 'https://www.instagram.com/proloco.camposampiero/', 'Alta Padovana, 1.2K followers, Sagra del Santo', true),
('instagram', 'Pro Loco Auronzo (BL)', 'https://www.instagram.com/pro_loco_auronzo/', 'Cadore, Dolomiti', true),
('instagram', 'Pro Loco Caorle (VE)', 'https://www.instagram.com/visit_caorle/', 'Costiera, 349 followers', true),
('instagram', 'Guida alle Sagre Veneto', 'https://www.instagram.com/guidaallesagre/', 'Aggregatore sagre Veneto, 3.2K followers, molto attiva', true),
('instagram', 'Pro Loco Montagnana (PD)', 'https://www.instagram.com/prolocomontagnana/', 'Citta murata, Prosciutto Veneto DOP', true),
('instagram', 'Pro Loco Malo (VI)', 'https://www.instagram.com/prolocomalo/', 'Alto vicentino', true)

ON CONFLICT (url) DO NOTHING;
