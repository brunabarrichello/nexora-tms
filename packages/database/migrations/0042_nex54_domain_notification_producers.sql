CREATE OR REPLACE FUNCTION "nexora_has_notification_runtime_context"()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '') IS NOT NULL
     AND nullif(current_setting('app.user_id', true), '') IS NOT NULL
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_notify_transport_request_created"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT nexora_has_notification_runtime_context() THEN
    RETURN NEW;
  END IF;

  PERFORM * FROM nexora_emit_in_app_notification(
    'freight.transport_request.created:' || NEW.id::text,
    'freight.transport_request.created',
    1,
    'freight',
    'transport_request',
    NEW.id::text,
    'Nova carga criada',
    'Uma nova solicitação de transporte foi criada e está disponível para acompanhamento.',
    '/cargas',
    'info',
    ARRAY['tenant_admin','operations_manager','dispatcher']::text[],
    jsonb_build_object('transportRequestId',NEW.id,'status',NEW.status)
  );

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "transport_requests_emit_in_app_notification"
AFTER INSERT ON "transport_requests"
FOR EACH ROW EXECUTE FUNCTION "nexora_notify_transport_request_created"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_notify_transport_contract_confirmed"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT nexora_has_notification_runtime_context() OR NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  PERFORM * FROM nexora_emit_in_app_notification(
    'negotiation.transport_contract.confirmed:' || NEW.id::text,
    'negotiation.transport_contract.confirmed',
    1,
    'negotiation',
    'transport_contract',
    NEW.id::text,
    'Contratação confirmada',
    'Uma contratação de transporte foi confirmada e a operação pode avançar para execução.',
    '/negociacoes',
    'info',
    ARRAY['tenant_admin','operations_manager','dispatcher','finance_manager']::text[],
    jsonb_build_object(
      'transportContractId',NEW.id,
      'transportRequestId',NEW.transport_request_id,
      'carrierPartyId',NEW.carrier_party_id,
      'status',NEW.status
    )
  );

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "transport_contracts_emit_in_app_notification"
AFTER INSERT ON "transport_contracts"
FOR EACH ROW EXECUTE FUNCTION "nexora_notify_transport_contract_confirmed"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_notify_trip_status_changed"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_title text;
  v_body text;
  v_severity text;
BEGIN
  IF NOT nexora_has_notification_runtime_context() THEN
    RETURN NEW;
  END IF;

  v_title := CASE NEW.to_status::text
    WHEN 'planned' THEN 'Viagem planejada'
    WHEN 'ready' THEN 'Viagem pronta para iniciar'
    WHEN 'in_transit' THEN 'Viagem em trânsito'
    WHEN 'completed' THEN 'Viagem concluída'
    WHEN 'cancelled' THEN 'Viagem cancelada'
    ELSE 'Status da viagem atualizado'
  END;
  v_body := 'A viagem teve o status atualizado para ' || NEW.to_status::text || '.';
  v_severity := CASE NEW.to_status::text WHEN 'cancelled' THEN 'critical' ELSE 'info' END;

  PERFORM * FROM nexora_emit_in_app_notification(
    'trips.status:' || NEW.id::text,
    'trips.status.changed',
    1,
    'trips',
    'trip',
    NEW.trip_id::text,
    v_title,
    v_body,
    '/viagens',
    v_severity,
    ARRAY['tenant_admin','operations_manager','dispatcher']::text[],
    jsonb_build_object(
      'tripId',NEW.trip_id,
      'fromStatus',NEW.from_status,
      'toStatus',NEW.to_status,
      'reason',NEW.reason
    )
  );

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "trip_status_history_emit_in_app_notification"
AFTER INSERT ON "trip_status_history"
FOR EACH ROW EXECUTE FUNCTION "nexora_notify_trip_status_changed"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_notify_document_validation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_title text;
  v_body text;
  v_severity text;
BEGIN
  IF NOT nexora_has_notification_runtime_context() THEN
    RETURN NEW;
  END IF;

  v_title := CASE NEW.result::text
    WHEN 'valid' THEN 'Documento validado'
    WHEN 'invalid' THEN 'Documento rejeitado'
    ELSE 'Documento pendente de validação'
  END;
  v_body := 'O documento recebeu resultado de validação: ' || NEW.result::text || '.';
  v_severity := CASE NEW.result::text
    WHEN 'invalid' THEN 'critical'
    WHEN 'pending' THEN 'warning'
    ELSE 'info'
  END;

  PERFORM * FROM nexora_emit_in_app_notification(
    'documents.validation:' || NEW.id::text,
    'documents.validation.recorded',
    1,
    'documents',
    'document',
    NEW.document_id::text,
    v_title,
    v_body,
    '/documentos',
    v_severity,
    ARRAY['tenant_admin','operations_manager','dispatcher']::text[],
    jsonb_build_object(
      'documentId',NEW.document_id,
      'documentVersionId',NEW.document_version_id,
      'validationType',NEW.validation_type,
      'result',NEW.result
    )
  );

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "document_validations_emit_in_app_notification"
AFTER INSERT ON "document_validations"
FOR EACH ROW EXECUTE FUNCTION "nexora_notify_document_validation"();--> statement-breakpoint

REVOKE ALL ON FUNCTION "nexora_has_notification_runtime_context"() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_has_notification_runtime_context"() TO nexora_app;--> statement-breakpoint
