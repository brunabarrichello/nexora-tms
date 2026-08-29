export interface CargoMatchingRequirements {
  readonly totalWeightKg: number;
  readonly cubageM3: number | null;
  readonly maxLengthM: number | null;
  readonly maxWidthM: number | null;
  readonly maxHeightM: number | null;
  readonly trackingRequired: boolean;
  readonly vehicleType: string;
  readonly bodyType: string;
}

export interface CapacityCandidateState {
  readonly driverRegistrationStatus: string;
  readonly driverOperationalStatus: string;
  readonly vehicleStatus: string;
  readonly vehicleType: string;
  readonly bodyType: string;
  readonly capacityWeightKg: number;
  readonly capacityVolumeM3: number | null;
  readonly maxLengthM: number | null;
  readonly maxWidthM: number | null;
  readonly maxHeightM: number | null;
  readonly trackingAvailable: boolean;
}

export type CapacityMismatchCode =
  | 'driver_not_qualified'
  | 'driver_not_active'
  | 'vehicle_not_active'
  | 'vehicle_type_mismatch'
  | 'body_type_mismatch'
  | 'weight_capacity_insufficient'
  | 'volume_capacity_unknown'
  | 'volume_capacity_insufficient'
  | 'dimensions_capacity_unknown'
  | 'length_capacity_insufficient'
  | 'width_capacity_insufficient'
  | 'height_capacity_insufficient'
  | 'tracking_unavailable';

export interface CapacityMismatchReason {
  readonly code: CapacityMismatchCode;
  readonly message: string;
  readonly required?: string | number | boolean;
  readonly available?: string | number | boolean | null;
}

export interface CapacityCompatibilityEvaluation {
  readonly compatible: boolean;
  readonly reasons: readonly CapacityMismatchReason[];
}

export function evaluateCapacityCompatibility(
  cargo: CargoMatchingRequirements,
  candidate: CapacityCandidateState,
): CapacityCompatibilityEvaluation {
  const reasons: CapacityMismatchReason[] = [];

  if (candidate.driverRegistrationStatus !== 'qualified') {
    reasons.push({
      code: 'driver_not_qualified',
      message: 'Motorista não está qualificado.',
      required: 'qualified',
      available: candidate.driverRegistrationStatus,
    });
  }
  if (candidate.driverOperationalStatus !== 'active') {
    reasons.push({
      code: 'driver_not_active',
      message: 'Motorista não está operacionalmente ativo.',
      required: 'active',
      available: candidate.driverOperationalStatus,
    });
  }
  if (candidate.vehicleStatus !== 'active') {
    reasons.push({
      code: 'vehicle_not_active',
      message: 'Veículo não está ativo.',
      required: 'active',
      available: candidate.vehicleStatus,
    });
  }
  if (normalize(candidate.vehicleType) !== normalize(cargo.vehicleType)) {
    reasons.push({
      code: 'vehicle_type_mismatch',
      message: 'Tipo de veículo incompatível com a carga.',
      required: cargo.vehicleType,
      available: candidate.vehicleType,
    });
  }
  if (normalize(candidate.bodyType) !== normalize(cargo.bodyType)) {
    reasons.push({
      code: 'body_type_mismatch',
      message: 'Carroceria/implemento incompatível com a carga.',
      required: cargo.bodyType,
      available: candidate.bodyType,
    });
  }
  if (candidate.capacityWeightKg < cargo.totalWeightKg) {
    reasons.push({
      code: 'weight_capacity_insufficient',
      message: 'Capacidade de peso inferior ao peso total da carga.',
      required: cargo.totalWeightKg,
      available: candidate.capacityWeightKg,
    });
  }
  if (cargo.cubageM3 !== null) {
    if (candidate.capacityVolumeM3 === null) {
      reasons.push({
        code: 'volume_capacity_unknown',
        message: 'Capacidade volumétrica do veículo não está cadastrada.',
        required: cargo.cubageM3,
        available: null,
      });
    } else if (candidate.capacityVolumeM3 < cargo.cubageM3) {
      reasons.push({
        code: 'volume_capacity_insufficient',
        message: 'Capacidade volumétrica inferior à cubagem da carga.',
        required: cargo.cubageM3,
        available: candidate.capacityVolumeM3,
      });
    }
  }

  const cargoHasDimensions =
    cargo.maxLengthM !== null || cargo.maxWidthM !== null || cargo.maxHeightM !== null;
  const candidateHasDimensions =
    candidate.maxLengthM !== null &&
    candidate.maxWidthM !== null &&
    candidate.maxHeightM !== null;

  if (cargoHasDimensions && !candidateHasDimensions) {
    reasons.push({
      code: 'dimensions_capacity_unknown',
      message: 'Dimensões máximas do veículo não estão cadastradas.',
    });
  } else if (candidateHasDimensions) {
    compareDimension(
      reasons,
      'length_capacity_insufficient',
      'Comprimento útil inferior ao exigido pela carga.',
      cargo.maxLengthM,
      candidate.maxLengthM,
    );
    compareDimension(
      reasons,
      'width_capacity_insufficient',
      'Largura útil inferior à exigida pela carga.',
      cargo.maxWidthM,
      candidate.maxWidthM,
    );
    compareDimension(
      reasons,
      'height_capacity_insufficient',
      'Altura útil inferior à exigida pela carga.',
      cargo.maxHeightM,
      candidate.maxHeightM,
    );
  }

  if (cargo.trackingRequired && !candidate.trackingAvailable) {
    reasons.push({
      code: 'tracking_unavailable',
      message: 'Carga exige rastreamento e o veículo não possui rastreamento disponível.',
      required: true,
      available: false,
    });
  }

  return { compatible: reasons.length === 0, reasons };
}

function compareDimension(
  reasons: CapacityMismatchReason[],
  code: CapacityMismatchCode,
  message: string,
  required: number | null,
  available: number | null,
): void {
  if (required !== null && available !== null && available < required) {
    reasons.push({ code, message, required, available });
  }
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}
