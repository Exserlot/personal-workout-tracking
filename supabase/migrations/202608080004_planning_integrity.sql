alter table public.template_set_prescriptions
  alter column target_weight_kg type numeric(12, 4),
  alter column target_effort_value type numeric(3, 1);

alter table public.template_set_prescriptions
  add constraint template_set_prescriptions_warmup_failure_check
  check (set_kind_code <> 'WARM_UP' or not is_to_failure);
