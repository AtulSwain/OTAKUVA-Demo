/**
 * OTAKUVA MASTER ENGINE — Entry Point
 * Unifies all 12 core intelligence, data, and culture modules.
 */

// Configuration & Versions
export * from './config';

// 1. Event Engine & Behavioral Tracking
export * from './events/eventEngine';
export * from './events/eventTypes';
export * from './events/behavioralTrackingService';

// 2. Watch Engine
export * from './watch/watchEngine';

// 3. Rating Engine & Episode Rating
export * from './rating/episodeRating';
export * from '../rating/ratingEngine';
export * from '../rating/ratingService';

// 4. Review Intelligence Engine & Community Opinion
export * from './review/reviewIntelligence';

// 5. User Taste Engine
export * from './taste/tasteEngine';

// 6. Recommendation & Discovery Engine Suite (Phases 10.1 - 10.10)
export * from './recommendation/contentPreferenceEngine';
export * from './recommendation/candidateGenerationEngine';
export * from './recommendation/recommendationEngine';
export * from './discovery/discoveryCoreService';
export * from './discovery/homeFeedEngine';
export * from './discovery/similarAnimeEngine';
export * from './discovery/studioCreatorDiscoveryEngine';
export * from './discovery/communityDiscoveryEngine';
export * from './discovery/personalizedNewsEngine';

// 6.1 Advanced AI / ML Intelligence Suite (Phase 11.1 - 11.5)
export * from './ai/embeddingEngine';
export * from './ai/reviewIntelligenceService';
export * from './ai/hybridRecommendationModel';
export * from './ai/representationLearningEngine';
export * from './ai/predictivePersonalizationEngine';

// 7. Trend & Momentum Engine
export * from './trend/trendEngine';

// 8. Activity Engine
export * from './activity/activityEngine';

// 9. Community & Messaging Engine
export * from '../community/communityService';
export * from '../chat/chatService';

// 10. Content & Culture Engine
export * from './content/contentEngine';

// 11. Trust & Safety Engine
export * from './safety/trustSafetyEngine';

// 12. Studio Core Engine & Studio Intelligence Suite (Phases 9.1 - 9.10)
export * from './studio/studioTypes';
export * from './studio/studioService';
export * from './studio/studioAdminService';
export * from './studio/studioBackfill';
export * from './studio/studioHistoryTypes';
export * from './studio/studioHistoryService';
export * from './studio/studioHistoryAdminService';
export * from './studio/studioHistoryBackfill';
export * from './studio/studioProjectService';
export * from './studio/studioPeopleService';
export * from './studio/studioAnalyticsService';
export * from './studio/studioAffinityService';
export * from './studio/studioNewsService';
export * from './studio/studioCommunityService';
export * from './studio/studioDiscoveryService';
export * from './studio/studioDataIntelligenceService';
export * from './studio/studioCmsService';
export * from './studio/studioKnowledgeGraphService';
export * from './studio/studioDashboardService';
export * from './studio/studioAdvancedAnalyticsService';
export * from './studio/studioProductionHardeningService';
export * from './studio/studioDeduplicationService';

// 13. Anime Schedule Engine (Phase 4)
export * from './schedule/scheduleTimezone';
export * from './schedule/scheduleEngine';

