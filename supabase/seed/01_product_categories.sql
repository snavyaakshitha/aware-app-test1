-- Product Categories Seed Data
-- Created: April 2026
-- Purpose: Initialize core product category lookups

INSERT INTO public.product_categories
  (category_name, category_code, description, icon_name)
VALUES
  ('Skincare', 'skincare', 'Face and body skincare products', 'skin'),
  ('Haircare', 'haircare', 'Shampoos, conditioners, and hair treatments', 'hair'),
  ('Makeup', 'makeup', 'Cosmetics including foundations, lipsticks, and eyeshadow', 'makeup'),
  ('Fragrance', 'fragrance', 'Perfumes, colognes, and scented products', 'fragrance'),
  ('Food & Beverages', 'food_beverage', 'Packaged foods and drinks', 'food'),
  ('Household Cleaners', 'household', 'Cleaning supplies and detergents', 'home'),
  ('Supplements', 'supplements', 'Vitamins, minerals, and dietary supplements', 'supplement'),
  ('Oral Care', 'oral_care', 'Toothpaste and mouth care products', 'teeth'),
  ('Deodorant', 'deodorant', 'Personal antiperspirant and deodorant products', 'deodorant'),
  ('Sunscreen', 'sunscreen', 'Sun protection and UV protection products', 'sun')
ON CONFLICT (category_name) DO NOTHING;
