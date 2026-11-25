import * as domain from "./vocabulary/index";
import { BASELINE_ALGORITHM } from "./metrics/baseline";
import { LIMITS } from "./rules/content";
/**
 * The full product vocabulary as data, so a client can render every label, description, scale anchor and lens
 * explanation from the same source the server validates against.
 */
export function productVocabulary() {
  return {
    stages: domain.IDEA_STAGES.map((key) => ({ key, ...domain.IDEA_STAGE_INFO[key] })),
    sections: domain.IDEA_SECTIONS.map((key) => ({ key, ...domain.IDEA_SECTION_INFO[key] })),
    claimRoles: domain.CLAIM_ROLES.map((key) => ({ key, ...domain.CLAIM_ROLE_INFO[key] })),
    consequenceDepths: domain.CONSEQUENCE_DEPTHS.map((key) => ({
      key,
      ...domain.CONSEQUENCE_DEPTH_INFO[key],
    })),
    claimStatuses: domain.CLAIM_STATUSES.map((key) => ({ key, ...domain.CLAIM_STATUS_INFO[key] })),
    evidenceStances: domain.EVIDENCE_STANCES.map((key) => ({ key, ...domain.EVIDENCE_STANCE_INFO[key] })),
    sourceKinds: domain.SOURCE_KINDS.map((key) => ({ key, ...domain.SOURCE_KIND_INFO[key] })),
    argumentStances: domain.ARGUMENT_STANCES.map((key) => ({ key, ...domain.ARGUMENT_STANCE_INFO[key] })),
    commentKinds: domain.COMMENT_KINDS,
    dimensions: domain.DIMENSION_KEYS.map((key) => ({ key, ...domain.DIMENSIONS[key] })),
    confidenceLevels: domain.CONFIDENCE_LEVELS,
    stanceKinds: domain.STANCE_KINDS.map((key) => ({ key, ...domain.STANCE_KIND_INFO[key] })),
    capacities: domain.CAPACITIES.map((key) => ({ key, ...domain.CAPACITY_INFO[key] })),
    involvementStatuses: domain.INVOLVEMENT_STATUSES.map((key) => ({
      key,
      ...domain.INVOLVEMENT_STATUS_INFO[key],
    })),
    relationTypes: domain.RELATION_TYPES.map((key) => ({ key, ...domain.RELATION_TYPE_INFO[key] })),
    initiativeKinds: domain.INITIATIVE_KINDS.map((key) => ({ key, ...domain.INITIATIVE_KIND_INFO[key] })),
    initiativeStatuses: domain.INITIATIVE_STATUSES.map((key) => ({
      key,
      ...domain.INITIATIVE_STATUS_INFO[key],
    })),
    outcomeResults: domain.OUTCOME_RESULTS.map((key) => ({ key, ...domain.OUTCOME_RESULT_INFO[key] })),
    revisionStatuses: domain.REVISION_STATUSES.map((key) => ({ key, ...domain.REVISION_STATUS_INFO[key] })),
    lenses: domain.LENS_KEYS.map((key) => ({ key, ...domain.LENS_INFO[key] })),
    minRatingsForConfidence: domain.MIN_RATINGS_FOR_CONFIDENCE,
    metricsAlgorithm: BASELINE_ALGORITHM,
    limits: LIMITS,
  };
}
