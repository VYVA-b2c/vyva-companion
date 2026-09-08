alter table if exists my_medicines
  add column if not exists inventory_unit text,
  add column if not exists inventory_units_per_dose numeric(10,2);

update my_medicines
set
  inventory_unit = coalesce(inventory_unit, dose_unit),
  inventory_units_per_dose = coalesce(inventory_units_per_dose, units_per_dose)
where inventory_tracking_enabled = true
  and (inventory_unit is null or inventory_units_per_dose is null);
