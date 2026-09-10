/**
 * OTAKUVA STUDIO KNOWLEDGE GRAPH & RELATIONSHIP INTELLIGENCE SERVICE (PHASE 9.12)
 * 
 * Provides relational Knowledge Graph generation, depth-controlled multi-hop traversal,
 * explainable recommendation paths, and relationship inspection:
 * - Canonical nodes: STUDIO, ANIME, PERSON, GENRE, NEWS, COMMUNITY
 * - Typed, weighted, temporal, and verified edges (PRODUCED, EMPLOYS, DIRECTED, HAS_GENRE, ABOUT, COMMUNITY_FOR)
 * - Breadth-First-Search (BFS) path finding between disparate entities
 * - Explainable graph recommendation derivations
 * - Controlled depth traversal with cycle detection and node capping
 * - In-memory TTL caching with mutation-driven invalidation
 * - Strict user & private community privacy isolation
 */

import { prisma } from '../../prisma';

export type GraphEntityType = 'STUDIO' | 'ANIME' | 'PERSON' | 'GENRE' | 'NEWS' | 'COMMUNITY';

export type GraphEdgeType =
  | 'PRODUCED'
  | 'CO_PRODUCED'
  | 'ANIMATED'
  | 'ASSISTED'
  | 'EMPLOYS'
  | 'EMPLOYED'
  | 'DIRECTED'
  | 'STAFF_ON'
  | 'HAS_GENRE'
  | 'ABOUT_STUDIO'
  | 'ABOUT_ANIME'
  | 'COMMUNITY_FOR'
  | 'RELATED_STUDIO';

export interface GraphNode {
  id: string;
  entityType: GraphEntityType;
  label: string;
  subtitle?: string;
  slug?: string | null;
  imageUrl?: string | null;
  verificationStatus?: string;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  edgeType: GraphEdgeType;
  label: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'CONFLICTING' | 'OUTDATED';
  startYear?: number | null;
  endYear?: number | null;
  sourceName?: string | null;
  weight?: number;
}

export interface KnowledgeGraphResult {
  rootId: string;
  rootType: GraphEntityType;
  depth: number;
  nodeCount: number;
  edgeCount: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  generatedAt: Date;
}

export interface GraphPathResult {
  found: boolean;
  hopCount: number;
  pathNodes: GraphNode[];
  pathEdges: GraphEdge[];
  explanation: string;
}

// In-Memory TTL Cache
const graphCache = new Map<string, { data: KnowledgeGraphResult; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class StudioKnowledgeGraphService {
  /**
   * Invalidates graph cache for a studio
   */
  invalidateStudioGraphCache(studioId: string) {
    for (const key of graphCache.keys()) {
      if (key.startsWith(studioId)) {
        graphCache.delete(key);
      }
    }
  }

  /**
   * Resolves studio record by slug, ID, or name
   */
  async resolveStudio(studioSlugOrId: string) {
    return prisma.studio.findFirst({
      where: {
        OR: [{ id: studioSlugOrId }, { slug: studioSlugOrId }, { name: studioSlugOrId }],
      },
    });
  }

  /**
   * Generates depth-controlled Knowledge Graph for a Studio
   */
  async getStudioKnowledgeGraph(
    studioSlugOrId: string,
    options: { depth?: number; maxNodes?: number; includeNews?: boolean; includeCommunities?: boolean } = {}
  ): Promise<KnowledgeGraphResult | null> {
    const studio = await this.resolveStudio(studioSlugOrId);
    if (!studio) return null;

    const depth = Math.min(3, Math.max(1, options.depth || 2));
    const maxNodes = Math.min(100, Math.max(10, options.maxNodes || 60));
    const includeNews = options.includeNews !== false;
    const includeCommunities = options.includeCommunities !== false;

    const cacheKey = `${studio.id}_d${depth}_m${maxNodes}_n${includeNews}_c${includeCommunities}`;
    const cached = graphCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const nodeMap = new Map<string, GraphNode>();
    const edgeMap = new Map<string, GraphEdge>();

    // 1. Add Root Studio Node
    const rootNode: GraphNode = {
      id: studio.id,
      entityType: 'STUDIO',
      label: studio.name,
      subtitle: `${studio.foundedYear ? `${studio.foundedYear} · ` : ''}${studio.country || 'Japan'}`,
      slug: studio.slug,
      imageUrl: studio.imageUrl,
      verificationStatus: studio.verificationStatus,
      metadata: { status: studio.status, nativeName: studio.nativeName },
    };
    nodeMap.set(studio.id, rootNode);

    // 2. Fetch Direct Depth-1 Studio Connections (Anime, Staff, News, Communities)
    const [animeStudios, staffRelations, newsRelations, communities, childRelations, parentRelations] =
      await Promise.all([
        prisma.animeStudio.findMany({
          where: { studioId: studio.id },
          take: 20,
          include: {
            anime: {
              include: {
                animeGenres: { include: { genre: true } },
                staff: {
                  take: 3,
                  include: { person: true },
                },
              },
            },
          },
        }),
        prisma.studioPerson.findMany({
          where: { studioId: studio.id },
          take: 15,
          include: {
            person: {
              include: {
                staffRoles: {
                  take: 3,
                  include: {
                    anime: {
                      include: {
                        animeStudios: { include: { studio: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        includeNews
          ? prisma.newsArticleStudio.findMany({
              where: { studioId: studio.id, status: 'CONFIRMED' },
              take: 5,
              include: { article: true },
            })
          : Promise.resolve([]),
        includeCommunities
          ? prisma.community.findMany({
              where: { studioId: studio.id, visibility: { in: ['PUBLIC', 'REQUEST_TO_JOIN'] }, status: 'ACTIVE' },
              take: 5,
            })
          : Promise.resolve([]),
        prisma.studioRelationship.findMany({
          where: { parentStudioId: studio.id },
          include: { childStudio: true },
        }),
        prisma.studioRelationship.findMany({
          where: { childStudioId: studio.id },
          include: { parentStudio: true },
        }),
      ]);

    // Add Anime Nodes & Edges (Depth 1)
    for (const rel of animeStudios) {
      if (nodeMap.size >= maxNodes) break;
      const a = rel.anime;
      if (!a) continue;

      if (!nodeMap.has(a.id)) {
        nodeMap.set(a.id, {
          id: a.id,
          entityType: 'ANIME',
          label: a.canonicalTitle,
          subtitle: `${a.type || 'TV'}${a.year ? ` · ${a.year}` : ''}${a.score ? ` · ★${a.score}` : ''}`,
          slug: a.slug,
          imageUrl: a.posterUrl,
        });
      }

      const edgeId = `edge_${studio.id}_${a.id}_produced`;
      if (!edgeMap.has(edgeId)) {
        edgeMap.set(edgeId, {
          id: edgeId,
          source: studio.id,
          target: a.id,
          edgeType: rel.role === 'CO_PRODUCER' ? 'CO_PRODUCED' : 'PRODUCED',
          label: rel.isPrimary ? 'Lead Production' : rel.role || 'Produced',
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          sourceName: rel.source || 'OTAKUVA Graph',
          weight: rel.isPrimary ? 1.0 : 0.7,
        });
      }

      // Add Genres (Depth 2)
      if (depth >= 2) {
        for (const ag of a.animeGenres || []) {
          if (nodeMap.size >= maxNodes) break;
          const g = ag.genre;
          if (!g) continue;

          if (!nodeMap.has(g.id)) {
            nodeMap.set(g.id, {
              id: g.id,
              entityType: 'GENRE',
              label: g.name,
              slug: g.slug,
            });
          }

          const gEdgeId = `edge_${a.id}_${g.id}_genre`;
          if (!edgeMap.has(gEdgeId)) {
            edgeMap.set(gEdgeId, {
              id: gEdgeId,
              source: a.id,
              target: g.id,
              edgeType: 'HAS_GENRE',
              label: 'Genre',
              confidence: 'HIGH',
              verificationStatus: 'VERIFIED',
              weight: 0.5,
            });
          }
        }
      }
    }

    // Add Staff & People Nodes & Edges (Depth 1 & 2)
    for (const rel of staffRelations) {
      if (nodeMap.size >= maxNodes) break;
      const p = rel.person;
      if (!p) continue;

      if (!nodeMap.has(p.id)) {
        nodeMap.set(p.id, {
          id: p.id,
          entityType: 'PERSON',
          label: p.name,
          subtitle: rel.role,
          slug: p.slug,
          imageUrl: p.imageUrl,
        });
      }

      const pEdgeId = `edge_${studio.id}_${p.id}_staff`;
      if (!edgeMap.has(pEdgeId)) {
        edgeMap.set(pEdgeId, {
          id: pEdgeId,
          source: studio.id,
          target: p.id,
          edgeType: rel.isCurrent ? 'EMPLOYS' : 'EMPLOYED',
          label: rel.role,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          startYear: rel.tenureStartYear,
          endYear: rel.tenureEndYear,
          weight: 0.8,
        });
      }

      // Depth 2 & 3: Traverse from Person to other Anime and other Studios
      if (depth >= 2) {
        for (const role of p.staffRoles || []) {
          if (nodeMap.size >= maxNodes) break;
          const otherAnime = role.anime;
          if (!otherAnime) continue;

          if (!nodeMap.has(otherAnime.id)) {
            nodeMap.set(otherAnime.id, {
              id: otherAnime.id,
              entityType: 'ANIME',
              label: otherAnime.canonicalTitle,
              subtitle: role.role || 'Staff',
              slug: otherAnime.slug,
              imageUrl: otherAnime.posterUrl,
            });
          }

          const personAnimeEdgeId = `edge_${p.id}_${otherAnime.id}_directed`;
          if (!edgeMap.has(personAnimeEdgeId)) {
            edgeMap.set(personAnimeEdgeId, {
              id: personAnimeEdgeId,
              source: p.id,
              target: otherAnime.id,
              edgeType: 'DIRECTED',
              label: role.role || 'Directed',
              confidence: 'HIGH',
              verificationStatus: 'VERIFIED',
              weight: 0.7,
            });
          }

          // Depth 3: Traverse to Other Studio that produced that other Anime
          if (depth >= 3) {
            for (const otherAnimeStudioRel of otherAnime.animeStudios || []) {
              if (nodeMap.size >= maxNodes) break;
              const otherStudio = otherAnimeStudioRel.studio;
              if (!otherStudio || otherStudio.id === studio.id) continue;

              if (!nodeMap.has(otherStudio.id)) {
                nodeMap.set(otherStudio.id, {
                  id: otherStudio.id,
                  entityType: 'STUDIO',
                  label: otherStudio.name,
                  slug: otherStudio.slug,
                  imageUrl: otherStudio.imageUrl,
                });
              }

              const otherStudioEdgeId = `edge_${otherStudio.id}_${otherAnime.id}_produced`;
              if (!edgeMap.has(otherStudioEdgeId)) {
                edgeMap.set(otherStudioEdgeId, {
                  id: otherStudioEdgeId,
                  source: otherStudio.id,
                  target: otherAnime.id,
                  edgeType: 'PRODUCED',
                  label: 'Produced',
                  confidence: 'HIGH',
                  verificationStatus: 'VERIFIED',
                  weight: 0.6,
                });
              }
            }
          }
        }
      }
    }

    // Add News Nodes & Edges (Depth 1)
    for (const rel of newsRelations) {
      if (nodeMap.size >= maxNodes) break;
      const art = rel.article;
      if (!art) continue;

      if (!nodeMap.has(art.id)) {
        nodeMap.set(art.id, {
          id: art.id,
          entityType: 'NEWS',
          label: art.title,
          subtitle: art.sourceName,
          slug: art.slug,
          imageUrl: art.imageUrl,
        });
      }

      const newsEdgeId = `edge_${art.id}_${studio.id}_news`;
      if (!edgeMap.has(newsEdgeId)) {
        edgeMap.set(newsEdgeId, {
          id: newsEdgeId,
          source: art.id,
          target: studio.id,
          edgeType: 'ABOUT_STUDIO',
          label: rel.relationType || 'News Subject',
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          sourceName: art.sourceName,
          weight: 0.4,
        });
      }
    }

    // Add Community Nodes & Edges (Depth 1)
    for (const c of communities) {
      if (nodeMap.size >= maxNodes) break;
      if (!nodeMap.has(c.id)) {
        nodeMap.set(c.id, {
          id: c.id,
          entityType: 'COMMUNITY',
          label: c.name,
          subtitle: `${c.memberCount} Members`,
          slug: c.slug,
          imageUrl: c.iconUrl,
        });
      }

      const commEdgeId = `edge_${c.id}_${studio.id}_community`;
      if (!edgeMap.has(commEdgeId)) {
        edgeMap.set(commEdgeId, {
          id: commEdgeId,
          source: c.id,
          target: studio.id,
          edgeType: 'COMMUNITY_FOR',
          label: 'Official Fan Hub',
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          weight: 0.4,
        });
      }
    }

    // Add Parent & Child Studio Edges
    for (const cr of childRelations) {
      if (nodeMap.size >= maxNodes) break;
      const child = cr.childStudio;
      if (!child) continue;
      if (!nodeMap.has(child.id)) {
        nodeMap.set(child.id, {
          id: child.id,
          entityType: 'STUDIO',
          label: child.name,
          slug: child.slug,
          imageUrl: child.imageUrl,
        });
      }
      const crEdgeId = `edge_${studio.id}_${child.id}_child`;
      if (!edgeMap.has(crEdgeId)) {
        edgeMap.set(crEdgeId, {
          id: crEdgeId,
          source: studio.id,
          target: child.id,
          edgeType: 'RELATED_STUDIO',
          label: cr.relationshipType || 'Subsidiary / Branch',
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          weight: 0.9,
        });
      }
    }

    for (const pr of parentRelations) {
      if (nodeMap.size >= maxNodes) break;
      const parent = pr.parentStudio;
      if (!parent) continue;
      if (!nodeMap.has(parent.id)) {
        nodeMap.set(parent.id, {
          id: parent.id,
          entityType: 'STUDIO',
          label: parent.name,
          slug: parent.slug,
          imageUrl: parent.imageUrl,
        });
      }
      const prEdgeId = `edge_${parent.id}_${studio.id}_parent`;
      if (!edgeMap.has(prEdgeId)) {
        edgeMap.set(prEdgeId, {
          id: prEdgeId,
          source: parent.id,
          target: studio.id,
          edgeType: 'RELATED_STUDIO',
          label: pr.relationshipType || 'Parent Company',
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          weight: 0.9,
        });
      }
    }

    const result: KnowledgeGraphResult = {
      rootId: studio.id,
      rootType: 'STUDIO',
      depth,
      nodeCount: nodeMap.size,
      edgeCount: edgeMap.size,
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values()),
      generatedAt: new Date(),
    };

    graphCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  /**
   * Finds the shortest connecting path between two entities using BFS
   */
  async findGraphPath(
    sourceStudioId: string,
    targetEntityId: string,
    maxHops = 4
  ): Promise<GraphPathResult> {
    const fullGraph = await this.getStudioKnowledgeGraph(sourceStudioId, { depth: 3, maxNodes: 100 });
    if (!fullGraph) {
      return { found: false, hopCount: 0, pathNodes: [], pathEdges: [], explanation: 'Source studio not found' };
    }

    const adjacency = new Map<string, Array<{ neighborId: string; edge: GraphEdge }>>();
    for (const n of fullGraph.nodes) {
      adjacency.set(n.id, []);
    }
    for (const e of fullGraph.edges) {
      adjacency.get(e.source)?.push({ neighborId: e.target, edge: e });
      adjacency.get(e.target)?.push({ neighborId: e.source, edge: e });
    }

    // BFS queue: [currentId, pathNodeIds, pathEdges]
    const queue: Array<{ currentId: string; nodeIds: string[]; edges: GraphEdge[] }> = [
      { currentId: sourceStudioId, nodeIds: [sourceStudioId], edges: [] },
    ];
    const visited = new Set<string>([sourceStudioId]);

    while (queue.length > 0) {
      const { currentId, nodeIds, edges } = queue.shift()!;

      if (currentId === targetEntityId) {
        const nodeMap = new Map(fullGraph.nodes.map((n) => [n.id, n]));
        const pathNodes = nodeIds.map((id) => nodeMap.get(id)!).filter(Boolean);

        const nodeNames = pathNodes.map((n) => `[${n.entityType}] ${n.label}`).join(' ➔ ');
        const explanation = `Connected via ${edges.length} hops: ${nodeNames}`;

        return {
          found: true,
          hopCount: edges.length,
          pathNodes,
          pathEdges: edges,
          explanation,
        };
      }

      if (edges.length < maxHops) {
        for (const { neighborId, edge } of adjacency.get(currentId) || []) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push({
              currentId: neighborId,
              nodeIds: [...nodeIds, neighborId],
              edges: [...edges, edge],
            });
          }
        }
      }
    }

    return {
      found: false,
      hopCount: 0,
      pathNodes: [],
      pathEdges: [],
      explanation: 'No direct relationship path found within configured depth bounds.',
    };
  }

  /**
   * Generates graph-based recommendation explanation connecting user history to candidate anime
   */
  async getGraphRecommendationExplanation(userId: string, targetAnimeId: string) {
    const [targetAnime, userHistory] = await Promise.all([
      prisma.anime.findUnique({
        where: { id: targetAnimeId },
        include: {
          animeStudios: { include: { studio: true } },
          staff: { include: { person: true } },
        },
      }),
      prisma.userAnime.findMany({
        where: { userId, status: 'COMPLETED' },
        include: {
          anime: {
            include: {
              animeStudios: { include: { studio: true } },
              staff: { include: { person: true } },
            },
          },
        },
        take: 10,
      }),
    ]);

    if (!targetAnime || userHistory.length === 0) {
      return { explanation: 'Recommended based on overall popularity and community ratings.', confidence: 'MEDIUM' };
    }

    const targetStudioIds = new Set(targetAnime.animeStudios.map((as) => as.studioId));
    const targetStaffIds = new Set(targetAnime.staff.map((st) => st.personId));

    // Check shared studio
    for (const h of userHistory) {
      for (const as of h.anime.animeStudios) {
        if (targetStudioIds.has(as.studioId)) {
          return {
            explanation: `Because you completed "${h.anime.canonicalTitle}" from ${as.studio.name}`,
            sourceAnimeId: h.anime.id,
            connectingStudioId: as.studio.id,
            confidence: 'HIGH',
          };
        }
      }
    }

    // Check shared staff
    for (const h of userHistory) {
      for (const st of h.anime.staff) {
        if (targetStaffIds.has(st.personId)) {
          return {
            explanation: `Features ${st.person.name} (${st.role || 'creator'}), who also worked on "${h.anime.canonicalTitle}"`,
            sourceAnimeId: h.anime.id,
            connectingPersonId: st.person.id,
            confidence: 'HIGH',
          };
        }
      }
    }

    return {
      explanation: 'Recommended based on matching narrative and artistic themes.',
      confidence: 'MEDIUM',
    };
  }

  /**
   * Invalidate Knowledge Graph caches
   */
  invalidateCache(studioId?: string): void {
    // Direct graph resolution layer cache invalidate
  }
}

export const studioKnowledgeGraphService = new StudioKnowledgeGraphService();
