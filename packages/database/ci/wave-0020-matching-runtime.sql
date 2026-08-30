\set ON_ERROR_STOP on

DO $$
DECLARE
  c integer;
BEGIN
  PERFORM set_config('app.user_id','20000000-0000-4000-8000-000000000101',false);
  PERFORM set_config('app.tenant_id','',false);

  SELECT count(*) INTO c FROM matching_rules;
  IF c <> 0 THEN RAISE EXCEPTION 'No tenant context must expose zero matching rules, got %', c; END IF;
  SELECT count(*) INTO c FROM matching_runs;
  IF c <> 0 THEN RAISE EXCEPTION 'No tenant context must expose zero matching runs, got %', c; END IF;

  PERFORM set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',false);

  INSERT INTO matching_rules (
    id, tenant_id, code, name, description, category, version, is_blocking, weight, configuration
  ) VALUES (
    '20000000-0000-4000-8000-000000000701','20000000-0000-4000-8000-000000000001',
    'tracking_unavailable','Tracking unavailable','Candidate must provide tracking when required',
    'equipment',1,true,1,'{}'::jsonb
  );

  INSERT INTO matching_preferences (
    id, tenant_id, name, minimum_score, max_candidates, include_rejected, is_default
  ) VALUES (
    '20000000-0000-4000-8000-000000000702','20000000-0000-4000-8000-000000000001',
    'Default Gate',0,100,true,true
  );

  UPDATE matching_rules
     SET description='Candidate must provide tracking when required by the request', updated_at=now()
   WHERE id='20000000-0000-4000-8000-000000000701';

  UPDATE matching_preferences
     SET max_candidates=50, updated_at=now()
   WHERE id='20000000-0000-4000-8000-000000000702';

  INSERT INTO matching_runs (
    id, tenant_id, transport_request_id, preference_id, status, algorithm_version,
    parameters_snapshot, rules_snapshot, requested_by_user_id, started_at
  ) VALUES (
    '20000000-0000-4000-8000-000000000703','20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000301','20000000-0000-4000-8000-000000000702',
    'running','capacity-v1','{"requestId":"20000000-0000-4000-8000-000000000301"}'::jsonb,
    '[{"code":"tracking_unavailable","version":1}]'::jsonb,
    '20000000-0000-4000-8000-000000000101',now()
  );

  INSERT INTO matching_candidates (
    id, tenant_id, matching_run_id, capacity_assignment_id, driver_id, capacity_asset_id,
    carrier_party_id, status, total_score, blocking_reason_count, explanation_summary, candidate_snapshot
  ) VALUES (
    '20000000-0000-4000-8000-000000000704','20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000703','20000000-0000-4000-8000-000000000601',
    '20000000-0000-4000-8000-000000000401','20000000-0000-4000-8000-000000000501',
    '20000000-0000-4000-8000-000000000201','rejected',0,1,
    '{"summary":"Rejected by tracking requirement"}'::jsonb,
    '{"driver":"Driver Gate A","asset":"MATCH-ASSET-A"}'::jsonb
  );

  INSERT INTO matching_candidate_scores (
    id, tenant_id, matching_candidate_id, dimension_code, raw_score, weight, weighted_score, rationale, input_snapshot
  ) VALUES (
    '20000000-0000-4000-8000-000000000705','20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000704','compatibility',0,1,0,
    'Blocking equipment requirement failed','{"trackingAvailable":false}'::jsonb
  );

  INSERT INTO matching_rule_results (
    id, tenant_id, matching_candidate_id, matching_rule_id, rule_code, rule_version,
    result, impact, score_delta, message, required_value, actual_value
  ) VALUES (
    '20000000-0000-4000-8000-000000000706','20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000704','20000000-0000-4000-8000-000000000701',
    'tracking_unavailable',1,'failed','blocker',0,'Tracking is required',
    '{"tracking":true}'::jsonb,'{"tracking":false}'::jsonb
  );

  INSERT INTO matching_rejections (
    id, tenant_id, matching_candidate_id, matching_rule_result_id, code, reason, context
  ) VALUES (
    '20000000-0000-4000-8000-000000000707','20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000704','20000000-0000-4000-8000-000000000706',
    'tracking_unavailable','Tracking is required','{"source":"wave-0020-gate"}'::jsonb
  );

  UPDATE matching_runs
     SET status='completed', evaluated_count=1, eligible_count=0, rejected_count=1,
         completed_at=now(), updated_at=now()
   WHERE id='20000000-0000-4000-8000-000000000703';

  SELECT count(*) INTO c FROM matching_runs;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant A must see one matching run, got %', c; END IF;
  SELECT count(*) INTO c FROM matching_candidates;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant A must see one candidate, got %', c; END IF;
  SELECT count(*) INTO c FROM matching_candidate_scores;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant A must see one candidate score, got %', c; END IF;
  SELECT count(*) INTO c FROM matching_rule_results;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant A must see one rule result, got %', c; END IF;
  SELECT count(*) INTO c FROM matching_rejections;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant A must see one rejection, got %', c; END IF;

  BEGIN
    EXECUTE $q$UPDATE matching_candidates SET total_score=100 WHERE id='20000000-0000-4000-8000-000000000704'$q$;
    RAISE EXCEPTION 'matching_candidates must reject UPDATE for nexora_app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    EXECUTE $q$UPDATE matching_candidate_scores SET weighted_score=100 WHERE id='20000000-0000-4000-8000-000000000705'$q$;
    RAISE EXCEPTION 'matching_candidate_scores must reject UPDATE for nexora_app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    EXECUTE $q$UPDATE matching_rule_results SET message='mutated' WHERE id='20000000-0000-4000-8000-000000000706'$q$;
    RAISE EXCEPTION 'matching_rule_results must reject UPDATE for nexora_app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    EXECUTE $q$UPDATE matching_rejections SET reason='mutated' WHERE id='20000000-0000-4000-8000-000000000707'$q$;
    RAISE EXCEPTION 'matching_rejections must reject UPDATE for nexora_app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO matching_runs (
      id, tenant_id, transport_request_id, status, algorithm_version, requested_by_user_id
    ) VALUES (
      '20000000-0000-4000-8000-000000000708','20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000302','queued','capacity-v1',
      '20000000-0000-4000-8000-000000000101'
    );
    RAISE EXCEPTION 'Cross-tenant transport request FK must be rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO matching_candidates (
      id, tenant_id, matching_run_id, capacity_assignment_id, driver_id, capacity_asset_id,
      carrier_party_id, status, total_score, blocking_reason_count
    ) VALUES (
      '20000000-0000-4000-8000-000000000709','20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000703','20000000-0000-4000-8000-000000000602',
      '20000000-0000-4000-8000-000000000401','20000000-0000-4000-8000-000000000501',
      '20000000-0000-4000-8000-000000000201','eligible',100,0
    );
    RAISE EXCEPTION 'Cross-tenant capacity assignment FK must be rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  PERFORM set_config('app.user_id','20000000-0000-4000-8000-000000000102',false);
  PERFORM set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',false);

  SELECT count(*) INTO c FROM matching_rules;
  IF c <> 0 THEN RAISE EXCEPTION 'Tenant B must not see Tenant A matching rules, got %', c; END IF;
  SELECT count(*) INTO c FROM matching_runs;
  IF c <> 0 THEN RAISE EXCEPTION 'Tenant B must not see Tenant A matching runs, got %', c; END IF;
  SELECT count(*) INTO c FROM matching_candidates;
  IF c <> 0 THEN RAISE EXCEPTION 'Tenant B must not see Tenant A candidates, got %', c; END IF;
  SELECT count(*) INTO c FROM matching_rejections;
  IF c <> 0 THEN RAISE EXCEPTION 'Tenant B must not see Tenant A rejections, got %', c; END IF;
END $$;
