import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';

export interface AdvancedKpisQuery { from?: string; to?: string; comparisonFrom?: string; comparisonTo?: string; customerPartyId?: string; origin?: string; destination?: string; status?: string }
export interface AdvancedKpisResult {
  period: { from: string; to: string }; comparisonPeriod: { from: string; to: string };
  filters: { customerPartyId: string | null; origin: string | null; destination: string | null; status: string | null };
  kpis: { sla: Metric; productivity: Productivity; capacity: Metric };
  customers: Dimension[]; routes: Dimension[]; drillDown: DrillDown[]; definitions: Definition[]; generatedAt: string;
}
interface Metric { total: number; onTime?: number; adherencePercentage?: number | null; plannedTrips?: number; activeTrips?: number; utilizationPercentage?: number | null; deltaPercentagePoints: number | null }
interface Productivity { completedTrips: number; totalTrips: number; completionPercentage: number | null; avgCycleHours: number | null; deltaPercentagePoints: number | null }
interface Dimension { key: string; label: string; trips: number; completedTrips: number; slaPercentage: number | null; avgCycleHours: number | null }
interface DrillDown { tripId: string; tripCode: string; status: string; customerPartyId: string | null; customer: string | null; origin: string | null; destination: string | null; plannedStartAt: string; plannedEndAt: string | null; actualStartAt: string | null; actualEndAt: string | null; slaOnTime: boolean | null }
interface Definition { code: string; name: string; formula: string; source: string }
interface Summary { total_trips: string; completed_trips: string; on_time_trips: string; sla_eligible_trips: string; active_trips: string; avg_cycle_hours: string | null }
interface DimRow { key: string; label: string; trips: string; completed_trips: string; sla_percentage: string | null; avg_cycle_hours: string | null }
interface DrillRow { trip_id: string; trip_code: string; status: string; customer_party_id: string | null; customer: string | null; origin: string | null; destination: string | null; planned_start_at: Date; planned_end_at: Date | null; actual_start_at: Date | null; actual_end_at: Date | null }

const DAY = 86_400_000;
const DEFINITIONS: Definition[] = [
  { code: 'sla_adherence', name: 'Aderência ao SLA', formula: 'concluídas no prazo / concluídas com prazo planejado', source: 'trips.planned_end_at + trips.actual_end_at' },
  { code: 'trip_completion', name: 'Produtividade de conclusão', formula: 'viagens concluídas / viagens do período', source: 'trips.status' },
  { code: 'avg_cycle_hours', name: 'Ciclo médio', formula: 'média(actual_end_at - actual_start_at) em horas', source: 'trips.actual_start_at + trips.actual_end_at' },
  { code: 'active_utilization', name: 'Utilização operacional', formula: 'viagens em trânsito / viagens do período', source: 'trips.status' },
];

@Injectable()
export class AdvancedKpisService {
  constructor(private readonly tenantContext: TenantContext, private readonly database: TenantDatabaseService) {}
  async getAdvancedKpis(query: AdvancedKpisQuery): Promise<AdvancedKpisResult> {
    const q = parseAdvancedKpisQuery(query); const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const current = filters(q, q.from, q.to); const previous = filters(q, q.comparisonFrom, q.comparisonTo);
      const [a,b,customers,routes,drill] = await Promise.all([
        client.query<Summary>(summarySql(), current), client.query<Summary>(summarySql(), previous),
        client.query<DimRow>(dimensionSql('customer'), current), client.query<DimRow>(dimensionSql('route'), current), client.query<DrillRow>(drillSql(), current),
      ]);
      const now=a.rows[0]; const before=b.rows[0];
      return {
        period:{from:q.from.toISOString(),to:q.to.toISOString()}, comparisonPeriod:{from:q.comparisonFrom.toISOString(),to:q.comparisonTo.toISOString()},
        filters:{customerPartyId:q.customerPartyId,origin:q.origin,destination:q.destination,status:q.status},
        kpis:{
          sla:{total:num(now?.sla_eligible_trips),onTime:num(now?.on_time_trips),adherencePercentage:pct(now?.on_time_trips,now?.sla_eligible_trips),deltaPercentagePoints:delta(now,before,'sla')},
          productivity:{completedTrips:num(now?.completed_trips),totalTrips:num(now?.total_trips),completionPercentage:pct(now?.completed_trips,now?.total_trips),avgCycleHours:decimal(now?.avg_cycle_hours),deltaPercentagePoints:delta(now,before,'productivity')},
          capacity:{total:num(now?.total_trips),plannedTrips:num(now?.total_trips),activeTrips:num(now?.active_trips),utilizationPercentage:pct(now?.active_trips,now?.total_trips),deltaPercentagePoints:delta(now,before,'capacity')},
        },
        customers:customers.rows.map(mapDim), routes:routes.rows.map(mapDim), drillDown:drill.rows.map(mapDrill), definitions:DEFINITIONS, generatedAt:new Date().toISOString(),
      };
    });
  }
}

export function parseAdvancedKpisQuery(query: AdvancedKpisQuery) {
  const to=parseDate(query.to,'to')??new Date(); const from=parseDate(query.from,'from')??new Date(to.getTime()-30*DAY);
  if(from>=to) throw new BadRequestException('from must be earlier than to'); if(to.getTime()-from.getTime()>366*DAY) throw new BadRequestException('analytics period cannot exceed 366 days');
  const duration=to.getTime()-from.getTime(); const comparisonTo=parseDate(query.comparisonTo,'comparisonTo')??from; const comparisonFrom=parseDate(query.comparisonFrom,'comparisonFrom')??new Date(from.getTime()-duration);
  if(comparisonFrom>=comparisonTo) throw new BadRequestException('comparisonFrom must be earlier than comparisonTo'); if(comparisonTo>from) throw new BadRequestException('comparison period must end on or before the current period');
  return {from,to,comparisonFrom,comparisonTo,customerPartyId:parseUuid(query.customerPartyId),origin:text(query.origin),destination:text(query.destination),status:text(query.status)};
}
function filters(q: ReturnType<typeof parseAdvancedKpisQuery>,from:Date,to:Date) { return [from.toISOString(),to.toISOString(),q.customerPartyId,q.status,q.origin?`%${q.origin}%`:null,q.destination?`%${q.destination}%`:null]; }
function where() { return `t.planned_start_at >= $1::timestamptz AND t.planned_start_at < $2::timestamptz AND ($3::uuid IS NULL OR r.customer_party_id=$3::uuid) AND ($4::text IS NULL OR t.status::text=$4) AND ($5::text IS NULL OR oa.city ILIKE $5 OR oa.state ILIKE $5) AND ($6::text IS NULL OR da.city ILIKE $6 OR da.state ILIKE $6)`; }
function base() { return `WITH scope AS (SELECT DISTINCT t.id,t.code,t.status,t.planned_start_at,t.planned_end_at,t.actual_start_at,t.actual_end_at,r.customer_party_id,coalesce(customer.trade_name,customer.legal_name) customer,concat_ws(' / ',oa.city,oa.state) origin,concat_ws(' / ',da.city,da.state) destination FROM trips t LEFT JOIN trip_transport_requests ttr ON ttr.trip_id=t.id AND ttr.removed_at IS NULL LEFT JOIN transport_requests r ON r.id=ttr.transport_request_id LEFT JOIN business_parties customer ON customer.id=r.customer_party_id LEFT JOIN business_party_addresses oa ON oa.id=r.origin_address_id LEFT JOIN business_party_addresses da ON da.id=r.destination_address_id WHERE ${where()})`; }
function summarySql() { return `${base()} SELECT count(*)::text total_trips,count(*) FILTER(WHERE status='completed')::text completed_trips,count(*) FILTER(WHERE status='completed' AND planned_end_at IS NOT NULL AND actual_end_at IS NOT NULL AND actual_end_at<=planned_end_at)::text on_time_trips,count(*) FILTER(WHERE status='completed' AND planned_end_at IS NOT NULL AND actual_end_at IS NOT NULL)::text sla_eligible_trips,count(*) FILTER(WHERE status='in_transit')::text active_trips,avg(EXTRACT(EPOCH FROM(actual_end_at-actual_start_at))/3600.0) FILTER(WHERE actual_start_at IS NOT NULL AND actual_end_at IS NOT NULL)::text avg_cycle_hours FROM scope`; }
function dimensionSql(kind:'customer'|'route') { const key=kind==='customer'?`coalesce(customer_party_id::text,'unknown')`:`coalesce(origin||' → '||destination,'unknown')`; const label=kind==='customer'?`coalesce(max(customer),'Sem cliente')`:`coalesce(origin||' → '||destination,'Rota não informada')`; return `${base()} SELECT ${key} key,${label} label,count(*)::text trips,count(*) FILTER(WHERE status='completed')::text completed_trips,CASE WHEN count(*) FILTER(WHERE status='completed' AND planned_end_at IS NOT NULL AND actual_end_at IS NOT NULL)=0 THEN NULL ELSE round(100.0*count(*) FILTER(WHERE status='completed' AND planned_end_at IS NOT NULL AND actual_end_at IS NOT NULL AND actual_end_at<=planned_end_at)/count(*) FILTER(WHERE status='completed' AND planned_end_at IS NOT NULL AND actual_end_at IS NOT NULL),2)::text END sla_percentage,avg(EXTRACT(EPOCH FROM(actual_end_at-actual_start_at))/3600.0) FILTER(WHERE actual_start_at IS NOT NULL AND actual_end_at IS NOT NULL)::text avg_cycle_hours FROM scope GROUP BY ${key}${kind==='route'?', origin, destination':''} ORDER BY trips DESC,key LIMIT 100`; }
function drillSql() { return `${base()} SELECT id trip_id,code trip_code,status,customer_party_id,customer,origin,destination,planned_start_at,planned_end_at,actual_start_at,actual_end_at FROM scope ORDER BY planned_start_at DESC,id DESC LIMIT 200`; }
function mapDim(r:DimRow):Dimension { return {key:r.key,label:r.label,trips:num(r.trips),completedTrips:num(r.completed_trips),slaPercentage:decimal(r.sla_percentage),avgCycleHours:decimal(r.avg_cycle_hours)}; }
function mapDrill(r:DrillRow):DrillDown { return {tripId:r.trip_id,tripCode:r.trip_code,status:r.status,customerPartyId:r.customer_party_id,customer:r.customer,origin:r.origin,destination:r.destination,plannedStartAt:r.planned_start_at.toISOString(),plannedEndAt:r.planned_end_at?.toISOString()??null,actualStartAt:r.actual_start_at?.toISOString()??null,actualEndAt:r.actual_end_at?.toISOString()??null,slaOnTime:r.planned_end_at&&r.actual_end_at?r.actual_end_at<=r.planned_end_at:null}; }
function parseDate(v:string|undefined,f:string):Date|null { if(!v?.trim()) return null; const d=new Date(v); if(Number.isNaN(d.getTime())) throw new BadRequestException(`${f} must be a valid ISO date or timestamp`); return d; }
function parseUuid(v?:string):string|null { if(!v?.trim()) return null; const x=v.trim().toLowerCase(); if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x)) throw new BadRequestException('customerPartyId must be a valid UUID'); return x; }
function text(v?:string):string|null { const x=v?.trim()??''; if(!x)return null; if(x.length>120)throw new BadRequestException('text filters cannot exceed 120 characters'); return x; }
function num(v?:string):number { const x=Number(v??0); return Number.isFinite(x)?x:0; } function decimal(v?:string|null):number|null { if(v==null)return null; const x=Number(v); return Number.isFinite(x)?Math.round(x*100)/100:null; }
function pct(a?:string,b?:string):number|null { const d=num(b); return d?Math.round(num(a)/d*10000)/100:null; }
function delta(a?:Summary,b?:Summary,k?:'sla'|'productivity'|'capacity'):number|null { if(!a||!b)return null; const x=k==='sla'?pct(a.on_time_trips,a.sla_eligible_trips):k==='productivity'?pct(a.completed_trips,a.total_trips):pct(a.active_trips,a.total_trips); const y=k==='sla'?pct(b.on_time_trips,b.sla_eligible_trips):k==='productivity'?pct(b.completed_trips,b.total_trips):pct(b.active_trips,b.total_trips); return x==null||y==null?null:Math.round((x-y)*100)/100; }
