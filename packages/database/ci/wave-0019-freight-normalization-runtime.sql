\set ON_ERROR_STOP on

DO $block$
DECLARE
  c integer;
  affected integer;
BEGIN
  PERFORM set_config('app.user_id','19000000-0000-4000-8000-000000000101',false);
  PERFORM set_config('app.tenant_id','',false);

  SELECT count(*) INTO c FROM transport_request_items;
  IF c <> 0 THEN RAISE EXCEPTION 'No tenant context must expose zero normalized freight items, got %', c; END IF;
  SELECT count(*) INTO c FROM freight_lanes;
  IF c <> 0 THEN RAISE EXCEPTION 'No tenant context must expose zero freight lanes, got %', c; END IF;

  PERFORM set_config('app.tenant_id','19000000-0000-4000-8000-000000000001',false);

  INSERT INTO transport_request_items (
    id,tenant_id,transport_request_id,sequence,description,quantity,total_weight_kg,total_volume_m3,
    created_by_user_id,updated_by_user_id
  ) VALUES (
    '19000000-0000-4000-8000-000000000601','19000000-0000-4000-8000-000000000001',
    '19000000-0000-4000-8000-000000000401',1,'Normalized cargo item',2,1200,4.5,
    '19000000-0000-4000-8000-000000000101','19000000-0000-4000-8000-000000000101'
  );

  INSERT INTO transport_request_packages (
    id,tenant_id,transport_request_id,item_id,sequence,quantity,label,
    created_by_user_id,updated_by_user_id
  ) VALUES (
    '19000000-0000-4000-8000-000000000701','19000000-0000-4000-8000-000000000001',
    '19000000-0000-4000-8000-000000000401','19000000-0000-4000-8000-000000000601',1,2,'Gate packages',
    '19000000-0000-4000-8000-000000000101','19000000-0000-4000-8000-000000000101'
  );

  INSERT INTO transport_request_requirements (
    id,tenant_id,transport_request_id,code,requirement_type,required,value_boolean,
    created_by_user_id,updated_by_user_id
  ) VALUES (
    '19000000-0000-4000-8000-000000000801','19000000-0000-4000-8000-000000000001',
    '19000000-0000-4000-8000-000000000401','TRACKING','tracking',true,true,
    '19000000-0000-4000-8000-000000000101','19000000-0000-4000-8000-000000000101'
  );

  INSERT INTO transport_request_references (
    id,tenant_id,transport_request_id,reference_type,value,
    created_by_user_id,updated_by_user_id
  ) VALUES (
    '19000000-0000-4000-8000-000000000901','19000000-0000-4000-8000-000000000001',
    '19000000-0000-4000-8000-000000000401','external','EXT-WAVE-0019',
    '19000000-0000-4000-8000-000000000101','19000000-0000-4000-8000-000000000101'
  );

  INSERT INTO freight_lanes (
    id,tenant_id,code,name,origin_city_id,destination_city_id,distance_km,typical_transit_hours,
    created_by_user_id,updated_by_user_id
  ) VALUES (
    '19000000-0000-4000-8000-000000000a01','19000000-0000-4000-8000-000000000001',
    'LANE-0019','Wave 0019 Lane','19000000-0000-4000-8000-000000000921','19000000-0000-4000-8000-000000000922',500,10,
    '19000000-0000-4000-8000-000000000101','19000000-0000-4000-8000-000000000101'
  );

  INSERT INTO transport_request_status_history (
    id,tenant_id,transport_request_id,from_status,to_status,reason,actor_user_id
  ) VALUES (
    '19000000-0000-4000-8000-000000000b01','19000000-0000-4000-8000-000000000001',
    '19000000-0000-4000-8000-000000000401',NULL,'draft','Initial normalized history',
    '19000000-0000-4000-8000-000000000101'
  );

  INSERT INTO transport_request_events (
    id,tenant_id,transport_request_id,event_type,source,actor_user_id,payload
  ) VALUES (
    '19000000-0000-4000-8000-000000000c01','19000000-0000-4000-8000-000000000001',
    '19000000-0000-4000-8000-000000000401','normalized_created','user',
    '19000000-0000-4000-8000-000000000101','{"wave":"0019"}'::jsonb
  );

  SELECT count(*) INTO c FROM transport_request_items;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant A must see one normalized item, got %', c; END IF;
  SELECT count(*) INTO c FROM transport_request_packages;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant A must see one package, got %', c; END IF;
  SELECT count(*) INTO c FROM transport_request_requirements;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant A must see one requirement, got %', c; END IF;
  SELECT count(*) INTO c FROM transport_request_references;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant A must see one reference, got %', c; END IF;
  SELECT count(*) INTO c FROM transport_request_status_history;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant A must see one status history row, got %', c; END IF;
  SELECT count(*) INTO c FROM transport_request_events;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant A must see one request event, got %', c; END IF;
  SELECT count(*) INTO c FROM freight_lanes;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant A must see one freight lane, got %', c; END IF;

  UPDATE transport_request_items
     SET description='Normalized cargo item updated',
         updated_by_user_id='19000000-0000-4000-8000-000000000101',
         updated_at=now()
   WHERE id='19000000-0000-4000-8000-000000000601';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Mutable freight item UPDATE must affect one row'; END IF;

  DELETE FROM transport_request_packages
   WHERE id='19000000-0000-4000-8000-000000000701';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Mutable package DELETE must affect one row'; END IF;

  BEGIN
    EXECUTE $q$UPDATE transport_request_status_history SET reason='mutated' WHERE id='19000000-0000-4000-8000-000000000b01'$q$;
    RAISE EXCEPTION 'transport_request_status_history must reject UPDATE for nexora_app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    EXECUTE $q$DELETE FROM transport_request_events WHERE id='19000000-0000-4000-8000-000000000c01'$q$;
    RAISE EXCEPTION 'transport_request_events must reject DELETE for nexora_app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    EXECUTE $q$DELETE FROM freight_lanes WHERE id='19000000-0000-4000-8000-000000000a01'$q$;
    RAISE EXCEPTION 'freight_lanes must reject DELETE for nexora_app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO transport_request_items (
      id,tenant_id,transport_request_id,sequence,cargo_type_id,description,quantity,
      created_by_user_id,updated_by_user_id
    ) VALUES (
      '19000000-0000-4000-8000-000000000602','19000000-0000-4000-8000-000000000001',
      '19000000-0000-4000-8000-000000000401',2,'19000000-0000-4000-8000-000000000502',
      'Cross tenant catalog reference',1,
      '19000000-0000-4000-8000-000000000101','19000000-0000-4000-8000-000000000101'
    );
    RAISE EXCEPTION 'Cross-tenant cargo type FK must be rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  PERFORM set_config('app.user_id','19000000-0000-4000-8000-000000000102',false);
  PERFORM set_config('app.tenant_id','19000000-0000-4000-8000-000000000002',false);

  SELECT count(*) INTO c FROM transport_request_items;
  IF c <> 0 THEN RAISE EXCEPTION 'Tenant B must not see Tenant A items, got %', c; END IF;
  SELECT count(*) INTO c FROM transport_request_status_history;
  IF c <> 0 THEN RAISE EXCEPTION 'Tenant B must not see Tenant A status history, got %', c; END IF;
  SELECT count(*) INTO c FROM transport_request_events;
  IF c <> 0 THEN RAISE EXCEPTION 'Tenant B must not see Tenant A events, got %', c; END IF;
  SELECT count(*) INTO c FROM freight_lanes;
  IF c <> 0 THEN RAISE EXCEPTION 'Tenant B must not see Tenant A freight lanes, got %', c; END IF;
END
$block$;
