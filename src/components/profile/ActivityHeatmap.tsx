'use client';

import React, { useMemo, useState } from 'react';
import styles from './ActivityHeatmap.module.css';

interface ActivityItem {
  id?: string;
  type?: string;
  createdAt: string;
}

interface ActivityHeatmapProps {
  activities?: ActivityItem[];
  /** Pre-aggregated per-day counts (YYYY-MM-DD, UTC), e.g. from /api/users/:username/activity. */
  days?: Array<{ date: string; count: number }>;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ activities = [], days = [] }) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Compute 52 weeks of day cells aligned to day of week (Sunday to Saturday)
  const { weeks, monthLabels, totalContributions, currentStreak } = useMemo(() => {
    const activityMap = new Map<string, number>();

    activities.forEach((act) => {
      const dateKey = new Date(act.createdAt).toISOString().split('T')[0];
      activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + 1);
    });
    days.forEach((d) => {
      activityMap.set(d.date, (activityMap.get(d.date) || 0) + d.count);
    });

    const today = new Date();
    const dayList = [];
    let streak = 0;
    let countedStreak = false;

    // 52 weeks = 364 days + current week padding
    const daysToGenerate = 371; // 53 weeks * 7
    const endDate = new Date(today);
    // Align end date to upcoming Saturday
    const dayOfWeek = endDate.getDay();
    endDate.setDate(endDate.getDate() + (6 - dayOfWeek));

    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const isFuture = d > today;

      // Only recorded activity. This used to invent a pattern of "mock" days
      // for every empty date, so every profile showed the same fake history.
      const count = isFuture ? 0 : (activityMap.get(dateKey) ?? 0);

      let level = 'level0';
      if (count === 1) level = 'level1';
      else if (count === 2) level = 'level2';
      else if (count === 3) level = 'level3';
      else if (count >= 4) level = 'level4';

      dayList.push({
        date: dateKey,
        dayOfWeek: d.getDay(),
        month: d.getMonth(),
        count,
        level: isFuture ? 'future' : level,
        isFuture,
        formattedDate: d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      });

      if (!isFuture && !countedStreak) {
        if (count > 0) streak++;
        else if (dateKey !== today.toISOString().split('T')[0]) countedStreak = true;
      }
    }

    // Group into 53 weeks of 7 days
    const weekGroups: (typeof dayList)[] = [];
    for (let i = 0; i < dayList.length; i += 7) {
      weekGroups.push(dayList.slice(i, i + 7));
    }

    // Calculate month labels with column offsets
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthOffsets: { month: string; colIndex: number }[] = [];
    let lastMonth = -1;

    weekGroups.forEach((week, colIdx) => {
      const firstDayOfMonth = week.find((d) => d && !d.isFuture);
      if (firstDayOfMonth && firstDayOfMonth.month !== lastMonth) {
        monthOffsets.push({
          month: months[firstDayOfMonth.month],
          colIndex: colIdx,
        });
        lastMonth = firstDayOfMonth.month;
      }
    });

    const total = dayList.reduce((acc, curr) => acc + (curr.isFuture ? 0 : curr.count), 0);

    // Consecutive active days ending today (or yesterday, if nothing is logged
    // yet today). This used to be floored at 4 for everyone.
    let realStreak = 0;
    const cursor = new Date(today);
    if (!activityMap.get(cursor.toISOString().split('T')[0])) cursor.setDate(cursor.getDate() - 1);
    while ((activityMap.get(cursor.toISOString().split('T')[0]) ?? 0) > 0) {
      realStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return {
      weeks: weekGroups,
      monthLabels: monthOffsets,
      totalContributions: total,
      currentStreak: realStreak,
    };
  }, [activities, days]);

  const handleCellHover = (e: React.MouseEvent<HTMLDivElement>, text: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      text,
    });
  };

  const handleCellLeave = () => {
    setTooltip(null);
  };

  return (
    <div className={styles.heatmapCard}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h3 className={styles.title}>Anime Activity &amp; Watch History</h3>
          <span className={styles.subtitle}>
            <strong>{totalContributions}</strong> logged {totalContributions === 1 ? 'activity' : 'activities'} in the last year • <strong>{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</strong> current streak
          </span>
        </div>

        <div className={styles.yearSelector}>
          {[2026, 2025, 2024].map((year) => (
            <button
              key={year}
              type="button"
              className={`${styles.yearBtn} ${selectedYear === year ? styles.yearBtnActive : ''}`}
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* GitHub Graph Container */}
      <div className={styles.graphContainer}>
        {/* Day of Week Axis */}
        <div className={styles.daysAxis}>
          <span style={{ gridRow: 2 }}>Mon</span>
          <span style={{ gridRow: 4 }}>Wed</span>
          <span style={{ gridRow: 6 }}>Fri</span>
        </div>

        <div className={styles.graphScrollWrap}>
          {/* Month Labels Bar */}
          <div className={styles.monthsBar}>
            {monthLabels.map((m, idx) => (
              <span
                key={idx}
                className={styles.monthLabel}
                style={{ left: `${m.colIndex * 13}px` }}
              >
                {m.month}
              </span>
            ))}
          </div>

          {/* Grid of Weeks (53 columns x 7 rows) */}
          <div className={styles.grid}>
            {weeks.map((week, colIdx) => (
              <div key={colIdx} className={styles.weekColumn}>
                {week.map((day, rowIdx) => {
                  if (day.isFuture) {
                    return <div key={rowIdx} className={`${styles.cell} ${styles.cellDisabled}`} />;
                  }

                  const tooltipText = `${day.count} ${day.count === 1 ? 'activity' : 'activities'} on ${day.formattedDate}`;

                  return (
                    <div
                      key={rowIdx}
                      className={`${styles.cell} ${styles[day.level]}`}
                      onMouseEnter={(e) => handleCellHover(e, tooltipText)}
                      onMouseLeave={handleCellLeave}
                      tabIndex={0}
                      role="gridcell"
                      aria-label={tooltipText}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.footerRow}>
        <span className={styles.footerNote}>Learn how we calculate activity logs</span>
        <div className={styles.legend}>
          <span className={styles.legendLabel}>Less</span>
          <span className={`${styles.legendCell} ${styles.level0}`} />
          <span className={`${styles.legendCell} ${styles.level1}`} />
          <span className={`${styles.legendCell} ${styles.level2}`} />
          <span className={`${styles.legendCell} ${styles.level3}`} />
          <span className={`${styles.legendCell} ${styles.level4}`} />
          <span className={styles.legendLabel}>More</span>
        </div>
      </div>

      {/* Floating Tooltip */}
      {tooltip && (
        <div
          className={styles.floatingTooltip}
          style={{
            position: 'fixed',
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
};
