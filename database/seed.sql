-- =====================================================================
--  ELBAKRI Hotel Rate Hub — Seed data
--  Categories, hotel groups, packages and demo users.
--  NOTE: No real prices are seeded (per spec). Operations add rates later.
--  Run AFTER schema.sql
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- Demo users  (CHANGE THESE PASSWORDS IN PRODUCTION!)
--   admin@elbakri.com      / Admin@123
--   ops@elbakri.com        / Ops@123
--   sales@elbakri.com      / Sales@123
--   viewer@elbakri.com     / Viewer@123
-- Hashes are bcrypt (PHP password_verify compatible).
-- ---------------------------------------------------------------------
INSERT INTO `users` (`email`,`full_name`,`password_hash`,`role`,`is_active`) VALUES
('admin@elbakri.com',  'مدير النظام',     '$2b$10$QoL9RZukQ7PAVHS9iDjf9enoHCySUhi6pelSpRyeKhwn7SyXGrCaG', 'admin',      1),
('ops@elbakri.com',    'فريق العمليات',   '$2b$10$XsUN11lZgbtapX.f3y0Ruu0XxYMfYZKXhhzjY7w0FbvHu0fmjTqma', 'operations', 1),
('sales@elbakri.com',  'فريق المبيعات',   '$2b$10$tSqIaOJaRv0fCT4cM4.GC.3SeApxee7erNDtlXQ.9cbaQJSmFow4G', 'sales',      1),
('viewer@elbakri.com', 'مستخدم قراءة',    '$2b$10$I0uuIY1xGjW27xHYuCHZ5u3CNmaraTyK4J8n5u1O/Yyc00qQiiYmG', 'viewer',     1);

-- Access rules (scope-based). Admin/Operations = global edit+export.
-- Sales = global view+export (API still restricts to Ready). Viewer = view only.
INSERT INTO `user_access_rules` (`user_id`,`scope_type`,`scope_id`,`can_view`,`can_edit`,`can_export`) VALUES
(1,'all',NULL,1,1,1),
(2,'all',NULL,1,1,1),
(3,'all',NULL,1,0,1),
(4,'all',NULL,1,0,0);

-- ---------------------------------------------------------------------
-- Hotel groups
-- ---------------------------------------------------------------------
INSERT INTO `hotel_groups` (`name`,`brand_name`,`region`,`notes`) VALUES
('مجموعة الباتروس',   'Albatros',  'متعدد',     'سلاسل بيك ألباتروس في الغردقة وشرم ومرسى علم'),
('مجموعة نيفرلاند',   'Neverland', 'الغردقة',   'مجموعة نيفرلاند'),
('هاني مون',          'Honeymoon', 'متعدد',     'باقات شهر العسل'),
('باقات سيليكت',      'Select',    'متعدد',     'باقات سيليكت / بريميوم / إليت'),
('رحلات وانتقالات',   'Transfers', 'متعدد',     'خدمات الرحلات والانتقالات');

-- ---------------------------------------------------------------------
-- Packages (NO prices) — ids 1..10
-- ---------------------------------------------------------------------
INSERT INTO `packages`
  (`package_name`,`package_type`,`region`,`hotel_group_id`,`description`,`default_meal_plan`,`default_pricing_basis`,`status`) VALUES
('مجموعة الباتروس شرم الشيخ','Package','شرم الشيخ',1,'باقات فنادق الباتروس بشرم الشيخ','AI','per_person_per_night','Active'),
('مجموعة الباتروس الغردقة','Package','الغردقة',1,'باقات فنادق الباتروس بالغردقة','AI','per_person_per_night','Active'),
('مجموعة نيفرلاند','Package','الغردقة',2,'باقات مجموعة نيفرلاند','AI','per_person_per_night','Active'),
('باقة سيليكت','Select','متعدد',4,'باقة سيليكت','HB','per_person_package','Active'),
('باقة بريميوم','Premium','متعدد',4,'باقة بريميوم','HB','per_person_package','Active'),
('باقة إليت','Elite','متعدد',4,'باقة إليت','FB','per_person_package','Active'),
('هاني مون شرم الشيخ','Honeymoon','شرم الشيخ',3,'باقة شهر عسل بشرم الشيخ','HB','per_person_package','Active'),
('هاني مون دهب','Honeymoon','دهب وطابا',3,'باقة شهر عسل بدهب','HB','per_person_package','Active'),
('هاني مون الغردقة','Honeymoon','الغردقة',3,'باقة شهر عسل بالغردقة','HB','per_person_package','Active'),
('هاني مون مرسى علم','Honeymoon','مرسى علم',3,'باقة شهر عسل بمرسى علم','HB','per_person_package','Active');

-- ---------------------------------------------------------------------
-- Sample hotels (structure only, NO prices) — ids 1..12
-- ---------------------------------------------------------------------
INSERT INTO `hotels`
  (`hotel_group_id`,`hotel_name`,`region`,`sub_region`,`star_rating`,`status`,`child_policy_default`,`transfer_notes_default`) VALUES
(1,'Pickalbatros Aqua Park','الغردقة','الممشى السياحي',5,'Active','طفل حتى 11.99 سنة مجانًا في وجود بالغين','الانتقالات من وإلى مطار الغردقة'),
(1,'Albatros Palace Resort','الغردقة','سهل حشيش',5,'Active','طفل حتى 11.99 سنة مجانًا في وجود بالغين','الانتقالات من وإلى مطار الغردقة'),
(1,'Pickalbatros Royal Moderna','شرم الشيخ','نبق باي',5,'Active','طفل حتى 11.99 سنة مجانًا','الانتقالات من وإلى مطار شرم الشيخ'),
(1,'Pickalbatros Sea World','مرسى علم','بورت غالب',5,'Active','طفل حتى 11.99 سنة مجانًا','الانتقالات من وإلى مطار مرسى علم'),
(2,'Neverland Resort','الغردقة','الممشى السياحي',4,'Active','طفل حتى 11.99 سنة مجانًا','الانتقالات اختيارية'),
(NULL,'Novotel Sharm El Sheikh','شرم الشيخ','خليج نعمة',5,'Active','طفل حتى 11.99 سنة مجانًا','الانتقالات اختيارية'),
(NULL,'Sunrise Grand Select','مرسى علم','بورت غالب',5,'Active',NULL,NULL),
(NULL,'Steigenberger Al Dau','الغردقة','الممشى السياحي',5,'Active',NULL,NULL),
(NULL,'Iberotel Dahabeya','دهب وطابا','دهب',4,'Active',NULL,NULL),
(NULL,'Mövenpick El Gouna','الجونة','الجونة',5,'Active',NULL,NULL),
(NULL,'Jaz Makadi Oasis','مكادى','مكادي باي',5,'Active',NULL,NULL),
(NULL,'Tolip Resort El Galala','العين السخنة','الجلالة',5,'Active',NULL,NULL);

-- Link some hotels to packages (package_hotels)
INSERT INTO `package_hotels` (`package_id`,`hotel_id`) VALUES
(1,3),          -- Albatros Sharm package -> Royal Moderna
(2,1),(2,2),    -- Albatros Hurghada package -> Aqua Park, Palace
(3,5),          -- Neverland package -> Neverland Resort
(7,3),(7,6),    -- Honeymoon Sharm -> Royal Moderna, Novotel
(9,1),(9,8),    -- Honeymoon Hurghada -> Aqua Park, Steigenberger
(10,4),(10,7);  -- Honeymoon Marsa Alam -> Sea World, Sunrise

-- =====================================================================
--  End of seed
-- =====================================================================
