alter table public.template_set_prescriptions
  drop constraint if exists template_set_prescriptions_check1,
  drop constraint if exists template_set_prescriptions_check2,
  drop constraint if exists template_set_prescriptions_check3,
  drop constraint if exists template_set_prescriptions_warmup_failure_check;

alter table public.template_set_prescriptions
  add constraint template_set_prescriptions_weight_pair_check
  check (
    (target_weight_value is null and target_weight_unit is null and target_weight_kg is null)
    or (target_weight_value >= 0 and target_weight_unit is not null and target_weight_kg >= 0)
  ),
  add constraint template_set_prescriptions_effort_pair_check
  check (
    (target_effort_metric is null and target_effort_value is null)
    or (target_effort_metric = 'RPE' and target_effort_value between 1 and 10 and mod(target_effort_value * 2, 1) = 0)
    or (target_effort_metric = 'RIR' and target_effort_value between 0 and 10 and mod(target_effort_value, 1) = 0)
  ),
  add constraint template_set_prescriptions_warmup_failure_check
  check (set_kind_code <> 'WARM_UP' or not is_to_failure);
