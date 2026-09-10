'use client';

import React, { useState, useEffect } from 'react';
import {
  Network,
  X,
  Share2,
  Layers,
  Sparkles,
  Search,
  CheckCircle,
  Building2,
  Film,
  Users,
  Tag,
  Newspaper,
  MessageSquare,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import styles from '../adminStudios.module.css';

interface Props {
  studioId: string | null;
  studioName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function StudioGraphExplorerModal({ studioId, studioName, isOpen, onClose }: Props) {
  const [depth, setDepth] = useState<number>(2);
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>('ALL');

  // Path finder state
  const [targetEntityId, setTargetEntityId] = useState('');
  const [pathResult, setPathResult] = useState<any>(null);
  const [isSearchingPath, setIsSearchingPath] = useState(false);

  useEffect(() => {
    if (!isOpen || !studioId) return;

    async function loadGraph() {
      setLoading(true);
      setError(null);
      setSelectedNode(null);
      setPathResult(null);
      try {
        const res = await fetch(`/api/admin/studios/${studioId}/graph?depth=${depth}&maxNodes=75`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to load knowledge graph');
        }
        const data = await res.json();
        setGraphData(data.graph);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadGraph();
  }, [isOpen, studioId, depth]);

  const handleFindPath = async () => {
    if (!studioId || !targetEntityId.trim()) return;
    setIsSearchingPath(true);
    try {
      const res = await fetch(
        `/api/admin/studios/graph/path?sourceId=${studioId}&targetId=${encodeURIComponent(targetEntityId.trim())}&maxHops=4`
      );
      const data = await res.json();
      setPathResult(data);
    } catch (e: any) {
      alert(e.message || 'Path search failed');
    } finally {
      setIsSearchingPath(false);
    }
  };

  if (!isOpen) return null;

  const filteredNodes = (graphData?.nodes || []).filter((n: any) =>
    filterType === 'ALL' ? true : n.entityType === filterType
  );

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'STUDIO':
        return <Building2 size={14} color="#8b5cf6" />;
      case 'ANIME':
        return <Film size={14} color="#60a5fa" />;
      case 'PERSON':
        return <Users size={14} color="#34d399" />;
      case 'GENRE':
        return <Tag size={14} color="#f472b6" />;
      case 'NEWS':
        return <Newspaper size={14} color="#facc15" />;
      case 'COMMUNITY':
        return <MessageSquare size={14} color="#38bdf8" />;
      default:
        return <Layers size={14} color="#94a3b8" />;
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalCard}
        style={{ maxWidth: '960px', width: '95%', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Network size={20} color="#8b5cf6" />
            <div>
              <h3 className={styles.modalTitle}>
                Knowledge Graph Explorer: {studioName || 'Studio'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Multi-hop relational entity graph across Studios, Anime, Creators, Genres, News, and Communities
              </p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Controls Toolbar */}
        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Depth selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Graph Depth:</span>
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDepth(d)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: depth === d ? '#8b5cf6' : 'rgba(255, 255, 255, 0.05)',
                  color: depth === d ? '#ffffff' : '#94a3b8',
                  border: depth === d ? '1px solid #8b5cf6' : '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {d} {d === 1 ? 'Hop (Direct)' : 'Hops'}
              </button>
            ))}
          </div>

          {/* Filter Entity Type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Filter Nodes:</span>
            {['ALL', 'ANIME', 'PERSON', 'GENRE', 'NEWS', 'COMMUNITY'].map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => setFilterType(ft)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filterType === ft ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  color: filterType === ft ? '#c4b5fd' : '#94a3b8',
                  border: filterType === ft ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {ft}
              </button>
            ))}
          </div>
        </div>

        {/* Path Explorer Input */}
        <div
          style={{
            padding: '10px 18px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <Search size={14} color="#8b5cf6" />
          <input
            type="text"
            placeholder="Find shortest graph path to Target Entity ID (e.g. animeId, personId, other studioId)..."
            value={targetEntityId}
            onChange={(e) => setTargetEntityId(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '12.5px',
              outline: 'none',
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleFindPath()}
          />
          <button
            type="button"
            onClick={handleFindPath}
            disabled={isSearchingPath || !targetEntityId.trim()}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              background: '#8b5cf6',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isSearchingPath ? 'Traversing...' : 'Trace Path'}
          </button>
        </div>

        {/* Path Search Result Banner */}
        {pathResult && (
          <div
            style={{
              margin: '12px 18px 0 18px',
              padding: '10px 14px',
              background: pathResult.found ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: pathResult.found ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              fontSize: '12.5px',
              color: pathResult.found ? '#4ade80' : '#f87171',
            }}
          >
            <strong>{pathResult.found ? '✓ Path Discovered:' : '✗ Path Not Found:'}</strong> {pathResult.explanation}
          </div>
        )}

        {/* Graph Body */}
        <div style={{ padding: '18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              Traversing knowledge graph relations...
            </div>
          ) : error ? (
            <div style={{ color: '#f87171', padding: '20px' }}>{error}</div>
          ) : graphData ? (
            <>
              {/* Summary Stats */}
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '12.5px', color: '#cbd5e1' }}>
                <span>
                  <strong>{graphData.nodeCount}</strong> Connected Nodes
                </span>
                <span>•</span>
                <span>
                  <strong>{graphData.edgeCount}</strong> Verified Relationships
                </span>
                <span>•</span>
                <span>
                  Depth: <strong>{graphData.depth} Hops</strong>
                </span>
              </div>

              {/* Node Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '10px',
                  maxHeight: '340px',
                  overflowY: 'auto',
                  padding: '4px',
                }}
              >
                {filteredNodes.map((node: any) => (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    style={{
                      padding: '10px 12px',
                      background: selectedNode?.id === node.id ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      border: selectedNode?.id === node.id ? '1px solid #8b5cf6' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {getEntityIcon(node.entityType)}
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.label}
                      </div>
                      {node.subtitle && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {node.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Node Details Drawer */}
              {selectedNode && (
                <div
                  style={{
                    padding: '14px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getEntityIcon(selectedNode.entityType)}
                      <h4 style={{ margin: 0, fontSize: '13.5px', color: '#ffffff' }}>
                        [{selectedNode.entityType}] {selectedNode.label}
                      </h4>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>ID: {selectedNode.id}</span>
                  </div>

                  {/* Connected Edges */}
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#c4b5fd' }}>Relationships:</span>
                    {graphData.edges
                      .filter((e: any) => e.source === selectedNode.id || e.target === selectedNode.id)
                      .map((edge: any) => (
                        <div
                          key={edge.id}
                          style={{
                            fontSize: '12px',
                            color: '#cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 8px',
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '4px',
                          }}
                        >
                          <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{edge.label}</span>
                          <span style={{ color: '#64748b' }}>({edge.edgeType})</span>
                          <span style={{ marginLeft: 'auto', fontSize: '10.5px', color: '#4ade80' }}>
                            {edge.confidence} Confidence
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
