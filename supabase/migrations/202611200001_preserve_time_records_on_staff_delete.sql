-- Preserve the employee ID on historical punches after personnel deletion.
alter table public.time_records drop constraint if exists time_records_staff_id_fkey;
