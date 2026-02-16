import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Plus, Check, TrendingUp, Droplet, Pill, Utensils, Activity, ChevronRight, ChevronDown, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import meditationExercisesData from '../data/meditation_exercises.json';
import { proteinPortions, fiberGuide, weeklyRotation, sugarGuide, hydrationGuide } from '../data/nutrition_guide';

type MeditationExercise = {
  id: string;
  name: string;
  tradition: string;
  duration: number;
  difficulty: string;
  goals: string[];
  timeOfDay: string[];
  primaryBenefit: string;
  instructions: string[];
  physiologicalEffects: string;
};

type MindfulnessSlot = 'morning' | 'evening';

type MetricsEntry = {
  recordedAt: string;
  bloodPressure?: { systolic?: string; diastolic?: string };
  heartRate?: string;
  weight?: string;
  respiratoryRate?: string;
};

type SnapshotPayload = {
  today?: { date: string; data: typeof defaultTodayData };
  reminders?: { time: string; label: string; enabled: boolean }[];
  mindfulness?: { date: string; slot: MindfulnessSlot; remainingIds: string[]; currentId: string };
  metricsHistory?: MetricsEntry[];
};

type SyncMeta = {
  updatedAt: string;
  lastSyncedAt: string;
};

function useLocalStorage<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    } catch {}
    return defaultValue;
  });

  const setStoredValue: React.Dispatch<React.SetStateAction<T>> = useCallback((action) => {
    setValue(prev => {
      const next = action instanceof Function ? action(prev) : action;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);

  return [value, setStoredValue];
}

const defaultTodayData = {
  supplements: {
    breakfast: { multivitamin: false, vitaminD: false } as Record<string, boolean>,
    dinner: { omega3: false, magnesium: false } as Record<string, boolean>
  } as Record<string, Record<string, boolean>>,
  hydration: 0,
  meals: { breakfast: false, lunch: false, dinner: false },
  walks: [] as { time: string; duration: string }[],
  morningWater: false,
  meditationCount: 0
};

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMindfulnessSlot(date = new Date()): MindfulnessSlot {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  return 'evening';
}

function getMindfulnessPool(exercises: MeditationExercise[], slot: MindfulnessSlot): MeditationExercise[] {
  const slotMatches = exercises.filter(exercise => (
    exercise.timeOfDay.includes(slot) || exercise.timeOfDay.includes('anytime')
  ));
  return slotMatches.length > 0 ? slotMatches : exercises;
}

function buildMindfulnessQueue(pool: MeditationExercise[]): string[] {
  const ids = pool.map(exercise => exercise.id);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[swapIndex]] = [ids[swapIndex], ids[i]];
  }
  return ids;
}

function loadTodayData(): typeof defaultTodayData {
  try {
    const stored = localStorage.getItem('healthsaga-today');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === getToday()) return parsed.data;
    }
  } catch {}
  return defaultTodayData;
}

function exportLocalData(): void {
  const keys = [
    'healthsaga-today',
    'healthsaga-metrics',
    'healthsaga-metrics-history',
    'healthsaga-reminders',
    'healthsaga-mindfulness'
  ];
  const payload = {
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(
      keys.map((key) => [key, localStorage.getItem(key)])
    )
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `healthsaga-local-export-${getToday()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const HealthSaga = () => {
  const [activeTab, setActiveTab] = useState('today');
  const [todayData, setTodayDataRaw] = useState(loadTodayData);

  const setTodayData: React.Dispatch<React.SetStateAction<typeof defaultTodayData>> = useCallback((action) => {
    setTodayDataRaw(prev => {
      const next = action instanceof Function ? action(prev) : action;
      try {
        localStorage.setItem('healthsaga-today', JSON.stringify({ date: getToday(), data: next }));
      } catch {}
      return next;
    });
  }, []);

  const [metrics, setMetrics] = useLocalStorage('healthsaga-metrics', {
    bloodPressure: { systolic: '', diastolic: '' },
    heartRate: '',
    weight: '',
    respiratoryRate: ''
  });

  const [metricsHistory, setMetricsHistory] = useLocalStorage<MetricsEntry[]>('healthsaga-metrics-history', []);

  const [syncMeta, setSyncMeta] = useLocalStorage<SyncMeta>('healthsaga-sync-meta', {
    updatedAt: '',
    lastSyncedAt: ''
  });
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
  const [syncError, setSyncError] = useState('');
  const hasInitialized = useRef(false);
  const isApplyingSnapshot = useRef(false);

  const pushMetricEntry = useCallback(async (entry: MetricsEntry) => {
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch {
      // Best-effort; local history is the source of truth until a sync succeeds.
    }
  }, []);

  const handleSaveMetrics = () => {
    const entry: MetricsEntry = {
      recordedAt: new Date().toISOString(),
      bloodPressure: {
        systolic: metrics.bloodPressure.systolic.trim() || undefined,
        diastolic: metrics.bloodPressure.diastolic.trim() || undefined
      },
      heartRate: metrics.heartRate.trim() || undefined,
      weight: metrics.weight.trim() || undefined,
      respiratoryRate: metrics.respiratoryRate.trim() || undefined
    };
    const hasValues = Boolean(
      entry.bloodPressure?.systolic ||
      entry.bloodPressure?.diastolic ||
      entry.heartRate ||
      entry.weight ||
      entry.respiratoryRate
    );
    if (hasValues) {
      setMetricsHistory(prev => [entry, ...prev].slice(0, 50));
      void pushMetricEntry(entry);
    }
    setMetrics({
      bloodPressure: { systolic: '', diastolic: '' },
      heartRate: '',
      weight: '',
      respiratoryRate: ''
    });
  };

  const [walkReminders, setWalkReminders] = useLocalStorage('healthsaga-reminders', [
    { time: '10:00 AM', label: 'Morning walk', enabled: true },
    { time: '2:00 PM', label: 'Afternoon walk', enabled: true },
    { time: '4:30 PM', label: 'Evening walk', enabled: true }
  ]);

  const [trendDateRange, setTrendDateRange] = useState<'week' | 'month' | 'all'>('week');
  const [trendView, setTrendView] = useState<'summary' | 'charts'>('summary');

  const getTrendStats = useCallback((metric: 'systolic' | 'diastolic' | 'heartRate' | 'weight' | 'respiratoryRate') => {
    const now = new Date();
    let startDate = new Date();
    if (trendDateRange === 'week') startDate.setDate(now.getDate() - 7);
    else if (trendDateRange === 'month') startDate.setDate(now.getDate() - 30);
    else startDate = new Date(0);

    const filtered = metricsHistory.filter(entry => new Date(entry.recordedAt) >= startDate);
    if (filtered.length === 0) return { latest: '--', avg: '--', trend: '→', count: 0, min: '--', max: '--' };

    const values = filtered
      .map(entry => {
        let val: string | undefined;
        if (metric === 'systolic') val = entry.bloodPressure?.systolic;
        else if (metric === 'diastolic') val = entry.bloodPressure?.diastolic;
        else if (metric === 'heartRate') val = entry.heartRate;
        else if (metric === 'weight') val = entry.weight;
        else if (metric === 'respiratoryRate') val = entry.respiratoryRate;
        return val ? Number(val) : null;
      })
      .filter((v): v is number => v !== null);

    if (values.length === 0) return { latest: '--', avg: '--', trend: '→', count: 0, min: '--', max: '--' };

    const latest = values[0];
    const oldest = values[values.length - 1];
    const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const trend = latest > oldest ? '↑' : latest < oldest ? '↓' : '→';

    return { latest, avg, trend, count: values.length, min, max };
  }, [metricsHistory, trendDateRange]);

  const getMeditationStats = useCallback(() => {
    const now = new Date();
    let startDate = new Date();
    if (trendDateRange === 'week') startDate.setDate(now.getDate() - 7);
    else if (trendDateRange === 'month') startDate.setDate(now.getDate() - 30);
    else startDate = new Date(0);

    const daysInRange = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const todayCount = todayData.meditationCount || 0;
    const total = todayCount;
    const avg = daysInRange > 0 ? Math.round((total / daysInRange) * 10) / 10 : 0;
    const trend = todayCount > 0 ? '↑' : '→';

    return { total, avg, trend, daysInRange };
  }, [todayData.meditationCount, trendDateRange]);

  const getChartData = useCallback(() => {
    const now = new Date();
    let startDate = new Date();
    if (trendDateRange === 'week') startDate.setDate(now.getDate() - 7);
    else if (trendDateRange === 'month') startDate.setDate(now.getDate() - 30);
    else startDate = new Date(0);

    const filtered = metricsHistory.filter(entry => new Date(entry.recordedAt) >= startDate).reverse();
    return filtered.map(entry => ({
      timestamp: new Date(entry.recordedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      systolic: entry.bloodPressure?.systolic ? Number(entry.bloodPressure.systolic) : null,
      diastolic: entry.bloodPressure?.diastolic ? Number(entry.bloodPressure.diastolic) : null,
      heartRate: entry.heartRate ? Number(entry.heartRate) : null,
      respiratoryRate: entry.respiratoryRate ? Number(entry.respiratoryRate) : null,
      weight: entry.weight ? Number(entry.weight) : null
    }));
  }, [metricsHistory, trendDateRange]);

  const [showRecipes, setShowRecipes] = useState(false);
  const [expandedMealsSection, setExpandedMealsSection] = useState<string | null>(null);
  const [showHydrationTips, setShowHydrationTips] = useState(false);

  const [expandedFoodCategory, setExpandedFoodCategory] = useState<string | null>(null);

  const foodLists = {
    protein: {
      plant: ['Beans (all types)', 'Lentils', 'Chickpeas', 'Split peas', 'Quinoa', 'Hemp hearts', 'Chia seeds', 'Pumpkin seeds', 'Walnuts', 'Organic sprouted tofu', 'Organic tempeh', 'Organic natto'],
      animal: ['Fish (low mercury)', 'Sardines', 'Anchovies', 'Shrimp', 'Chicken (pasture-raised)', 'Turkey', 'Duck', 'Beef (100% grass-fed)', 'Lamb (pasture-raised)', 'Pork (pasture-raised)', 'Buffalo', 'Game meat', 'Organ meat', 'Eggs (pasture-raised)'],
      avoid: ['Canned baked beans', 'Processed deli meats', 'Factory-farmed meat']
    },
    veggies: {
      preferred: ['Broccoli', 'Brussels sprouts', 'Lettuce', 'Arugula/baby greens', 'Mustard/collard greens', 'Bok choy', 'Kale', 'Cabbage', 'Asparagus', 'Cauliflower', 'Chard', 'Sprouts', 'Green beans', 'Green peas'],
      accessory: ['Artichoke', 'Tomatoes', 'Cucumber', 'Celery'],
      note: 'All veggies are good!'
    },
    starch: {
      approved: ['Sweet potatoes/yams', 'Squashes', 'Regular potatoes', 'Carrots', 'Beets', 'Plantains', 'Turnips, parsnips, yucca', 'Steel cut oats', 'Rice (any kind)', 'Buckwheat', 'Amaranth', 'Millet', 'Corn', 'Sorghum'],
      limit: ['Pasta (2 days/week or less)', 'Bread (2 days/week or less)']
    },
    fats: {
      approved: ['Avocado', 'Avocado oil', 'Olives', 'Olive oil', 'Coconut oil', 'Nut butter', 'Nuts', 'Seeds']
    }
  };

  const breakfastRecipes = [
    {
      name: 'Protein Power Smoothie',
      protein: '32g',
      time: '5 min',
      ingredients: ['2 tbsp protein powder', '1 cup berries', '1 banana', 'nut milk', 'chia seeds']
    },
    {
      name: 'Veggie Egg Scramble',
      protein: '28g',
      time: '10 min',
      ingredients: ['3 eggs', 'spinach', 'tomatoes', 'avocado', 'sourdough toast']
    },
    {
      name: 'Greek Yogurt Bowl',
      protein: '25g',
      time: '3 min',
      ingredients: ['full-fat greek yogurt', 'berries', 'chia seeds', 'nuts', 'cinnamon']
    }
  ];

  const lunchDinnerRecipes = [
    {
      name: 'Grilled Salmon Bowl',
      protein: '35g',
      time: '20 min',
      plate: { protein: 'salmon 4oz', veggies: 'broccoli, asparagus', starch: 'sweet potato' }
    },
    {
      name: 'Chicken & Quinoa Salad',
      protein: '38g',
      time: '25 min',
      plate: { protein: 'chicken breast', veggies: 'mixed greens, cucumber, tomato', starch: 'quinoa' }
    },
    {
      name: 'Bean & Rice Buddha Bowl',
      protein: '22g',
      time: '15 min',
      plate: { protein: 'black beans', veggies: 'kale, peppers, avocado', starch: 'brown rice' }
    },
    {
      name: 'Turkey & Veggie Stir-fry',
      protein: '32g',
      time: '18 min',
      plate: { protein: 'ground turkey', veggies: 'bok choy, carrots, snap peas', starch: 'rice noodles' }
    }
  ];

  const supplements = [
    { id: 'multivitamin', name: 'Multivitamin', count: '2 caps', time: 'breakfast' },
    { id: 'vitaminD', name: 'Vitamin D3 + K2', count: '1 cap', time: 'breakfast' },
    { id: 'omega3', name: 'Omega-3', count: '2 caps', time: 'dinner' },
    { id: 'magnesium', name: 'Magnesium CitraMate', count: '2 caps', time: 'dinner' }
  ];

  const toggleSupplement = (time: 'breakfast' | 'dinner', id: string) => {
    setTodayData(prev => ({
      ...prev,
      supplements: {
        ...prev.supplements,
        [time]: {
          ...prev.supplements[time],
          [id]: !prev.supplements[time][id]
        }
      }
    }));
  };

  const addHydration = () => {
    setTodayData(prev => ({
      ...prev,
      hydration: Math.min(prev.hydration + 8, 60)
    }));
  };

  const toggleMorningWater = () => {
    setTodayData(prev => ({ ...prev, morningWater: !prev.morningWater }));
  };

  const addWalk = () => {
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setTodayData(prev => ({
      ...prev,
      walks: [...prev.walks, { time: now, duration: '10 min' }]
    }));
  };

  const toggleWalkReminder = (index: number) => {
    setWalkReminders(prev => prev.map((reminder, i) => 
      i === index ? { ...reminder, enabled: !reminder.enabled } : reminder
    ));
  };

  const toggleFoodCategory = (category: string) => {
    setExpandedFoodCategory(expandedFoodCategory === category ? null : category);
  };

  const meditationExercises = (meditationExercisesData as { exercises: MeditationExercise[] }).exercises;
  const mindfulnessSlot = getMindfulnessSlot();
  const todayKey = getToday();
  const mindfulnessPool = useMemo(
    () => getMindfulnessPool(meditationExercises, mindfulnessSlot),
    [meditationExercises, mindfulnessSlot]
  );

  const [mindfulnessState, setMindfulnessState] = useLocalStorage('healthsaga-mindfulness', {
    date: todayKey,
    slot: mindfulnessSlot,
    remainingIds: [] as string[],
    currentId: ''
  });

  useEffect(() => {
    const currentValid = mindfulnessState.currentId
      ? mindfulnessPool.some(exercise => exercise.id === mindfulnessState.currentId)
      : false;

    if (mindfulnessState.date !== todayKey || mindfulnessState.slot !== mindfulnessSlot || !currentValid) {
      const queue = buildMindfulnessQueue(mindfulnessPool);
      const [firstId, ...rest] = queue;
      setMindfulnessState({
        date: todayKey,
        slot: mindfulnessSlot,
        remainingIds: rest,
        currentId: firstId ?? ''
      });
    }
  }, [
    mindfulnessState.date,
    mindfulnessState.slot,
    mindfulnessState.currentId,
    mindfulnessPool,
    mindfulnessSlot,
    todayKey,
    setMindfulnessState
  ]);

  const touchSnapshot = useCallback(() => {
    setSyncMeta(prev => ({ ...prev, updatedAt: new Date().toISOString() }));
  }, [setSyncMeta]);

  const buildSnapshot = useCallback((): SnapshotPayload => {
    let storedToday: { date: string; data: typeof defaultTodayData } | undefined;
    try {
      const raw = localStorage.getItem('healthsaga-today');
      if (raw) storedToday = JSON.parse(raw);
    } catch {}

    return {
      today: storedToday ?? { date: getToday(), data: todayData },
      reminders: walkReminders,
      mindfulness: mindfulnessState,
      metricsHistory
    };
  }, [todayData, walkReminders, mindfulnessState, metricsHistory]);

  const applySnapshot = useCallback((snapshot: SnapshotPayload, updatedAt: string) => {
    isApplyingSnapshot.current = true;
    if (snapshot.today?.date === getToday() && snapshot.today.data) {
      setTodayData(snapshot.today.data);
    }
    if (snapshot.reminders) setWalkReminders(snapshot.reminders);
    if (snapshot.metricsHistory) setMetricsHistory(snapshot.metricsHistory);
    if (snapshot.mindfulness) setMindfulnessState(snapshot.mindfulness);
    setSyncMeta(prev => ({ ...prev, updatedAt, lastSyncedAt: new Date().toISOString() }));
    queueMicrotask(() => {
      isApplyingSnapshot.current = false;
    });
  }, [setMetricsHistory, setMindfulnessState, setSyncMeta, setTodayData, setWalkReminders]);

  const pushSnapshot = useCallback(async () => {
    const updatedAt = syncMeta.updatedAt || new Date().toISOString();
    const snapshot = buildSnapshot();
    await fetch('/api/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updatedAt, data: snapshot })
    });
    setSyncMeta(prev => ({ ...prev, updatedAt, lastSyncedAt: new Date().toISOString() }));
  }, [buildSnapshot, setSyncMeta, syncMeta.updatedAt]);

  const syncWithServer = useCallback(async () => {
    setSyncStatus('syncing');
    setSyncError('');
    try {
      const response = await fetch('/api/snapshot');
      if (!response.ok) {
        if (response.status === 404) {
          await pushSnapshot();
          setSyncStatus('success');
          return;
        }
        throw new Error(`Snapshot fetch failed (${response.status})`);
      }

      const payload = await response.json() as { updatedAt?: string; data?: SnapshotPayload | null };
      const serverUpdatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt : '';
      const localUpdatedAt = syncMeta.updatedAt || '';

      if (!payload.data) {
        await pushSnapshot();
        setSyncStatus('success');
        return;
      }

      if (!localUpdatedAt && serverUpdatedAt) {
        applySnapshot(payload.data, serverUpdatedAt);
        setSyncStatus('success');
        return;
      }

      if (!serverUpdatedAt || (!localUpdatedAt || serverUpdatedAt > localUpdatedAt)) {
        applySnapshot(payload.data, serverUpdatedAt || new Date().toISOString());
      } else {
        await pushSnapshot();
      }
      setSyncStatus('success');
    } catch (error) {
      setSyncStatus('error');
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    }
  }, [applySnapshot, pushSnapshot, syncMeta.updatedAt]);

  useEffect(() => {
    void syncWithServer();
  }, []);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      return;
    }
    if (isApplyingSnapshot.current) return;
    touchSnapshot();
  }, [todayData, metricsHistory, walkReminders, mindfulnessState, touchSnapshot]);

  const handleSyncNow = useCallback(() => {
    void syncWithServer();
  }, [syncWithServer]);

  const suggestedExercise = mindfulnessPool.find(exercise => exercise.id === mindfulnessState.currentId)
    ?? mindfulnessPool[0];
  const mindfulnessLabel = mindfulnessSlot === 'morning' ? 'Morning' : 'Evening';
  const hasMoreSuggestions = mindfulnessState.remainingIds.length > 0;
  const meditationCount = Number.isFinite(todayData.meditationCount) ? todayData.meditationCount : 0;
  const lastSyncedLabel = syncMeta.lastSyncedAt
    ? new Date(syncMeta.lastSyncedAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
    : '';
  const syncBadge = (() => {
    if (syncStatus === 'syncing') return { label: 'Syncing', bg: 'rgba(255,255,255,0.18)', color: '#ffffff' };
    if (syncStatus === 'error') return { label: 'Sync issue', bg: 'rgba(255,215,215,0.25)', color: '#ffffff' };
    if (syncStatus === 'success') return { label: 'Synced', bg: 'rgba(210,255,242,0.22)', color: '#ffffff' };
    return { label: 'Local', bg: 'rgba(255,255,255,0.18)', color: '#ffffff' };
  })();

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(to bottom, #f5f3f0 0%, #e8e6e1 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{ 
        background: 'linear-gradient(135deg, #5492a3 0%, #3d7a8a 100%)',
        padding: '32px 24px',
        color: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '28px', 
          fontWeight: '300',
          letterSpacing: '1px'
        }}>
          Health Saga
        </h1>
        <p style={{ 
          margin: '8px 0 0 0', 
          opacity: 0.9,
          fontSize: '14px',
          fontWeight: '300'
        }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncStatus === 'syncing'}
          style={{
            marginTop: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '999px',
            border: 'none',
            background: syncBadge.bg,
            color: syncBadge.color,
            fontSize: '11px',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            cursor: syncStatus === 'syncing' ? 'default' : 'pointer',
            opacity: syncStatus === 'syncing' ? 0.8 : 1
          }}
        >
          <span>{syncBadge.label}</span>
          {lastSyncedLabel && syncStatus === 'success' ? (
            <span style={{ opacity: 0.85, textTransform: 'none', letterSpacing: 0 }}>
              {lastSyncedLabel}
            </span>
          ) : null}
        </button>
      </div>

      <div style={{ 
        display: 'flex', 
        background: 'white',
        borderBottom: '1px solid #e0ddd8',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        {['today', 'meals', 'metrics', 'mindfulness'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '16px',
              border: 'none',
              background: activeTab === tab ? '#f5f3f0' : 'white',
              color: activeTab === tab ? '#3d7a8a' : '#9b9b9b',
              fontSize: '14px',
              fontWeight: activeTab === tab ? '500' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid #5492a3' : 'none',
              transition: 'all 0.3s ease',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        
        {activeTab === 'today' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ 
              background: 'white', 
              borderRadius: '16px', 
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Droplet size={20} color="#bcd4da" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Morning Ritual
                </h3>
              </div>
              <button
                onClick={toggleMorningWater}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: todayData.morningWater ? '2px solid #5492a3' : '2px solid #e0ddd8',
                  borderRadius: '12px',
                  background: todayData.morningWater ? '#edf4f6' : 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.3s ease'
                }}
              >
                <span style={{ color: '#4a5550', fontSize: '14px' }}>
                  Hot water + lemon + salt
                </span>
                {todayData.morningWater && <Check size={18} color="#5492a3" />}
              </button>
            </div>

            <div style={{ 
              background: 'white', 
              borderRadius: '16px', 
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Pill size={20} color="#a89d7f" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Supplements
                </h3>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#7a7a7a', fontWeight: '500' }}>
                  With Breakfast
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {supplements.filter(s => s.time === 'breakfast').map(supp => (
                    <button
                      key={supp.id}
                      onClick={() => toggleSupplement('breakfast', supp.id)}
                      style={{
                        padding: '12px',
                        border: todayData.supplements.breakfast[supp.id] ? '2px solid #5492a3' : '2px solid #e0ddd8',
                        borderRadius: '12px',
                        background: todayData.supplements.breakfast[supp.id] ? '#edf4f6' : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ color: '#4a5550', fontSize: '14px' }}>{supp.name}</div>
                        <div style={{ color: '#9b9b9b', fontSize: '12px' }}>{supp.count}</div>
                      </div>
                      {todayData.supplements.breakfast[supp.id] && <Check size={18} color="#5492a3" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#7a7a7a', fontWeight: '500' }}>
                  With Dinner
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {supplements.filter(s => s.time === 'dinner').map(supp => (
                    <button
                      key={supp.id}
                      onClick={() => toggleSupplement('dinner', supp.id)}
                      style={{
                        padding: '12px',
                        border: todayData.supplements.dinner[supp.id] ? '2px solid #5492a3' : '2px solid #e0ddd8',
                        borderRadius: '12px',
                        background: todayData.supplements.dinner[supp.id] ? '#edf4f6' : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ color: '#4a5550', fontSize: '14px' }}>{supp.name}</div>
                        <div style={{ color: '#9b9b9b', fontSize: '12px' }}>{supp.count}</div>
                      </div>
                      {todayData.supplements.dinner[supp.id] && <Check size={18} color="#5492a3" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ 
              background: 'white', 
              borderRadius: '16px', 
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Droplet size={20} color="#bcd4da" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Hydration
                </h3>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#7a7a7a' }}>{todayData.hydration} oz / 60 oz</span>
                  <span style={{ fontSize: '14px', color: '#5492a3', fontWeight: '500' }}>
                    {Math.round((todayData.hydration / 60) * 100)}%
                  </span>
                </div>
                <div style={{ 
                  height: '8px', 
                  background: '#e8e6e1', 
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${(todayData.hydration / 60) * 100}%`,
                    background: 'linear-gradient(90deg, #bcd4da 0%, #5492a3 100%)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
              <button
                onClick={addHydration}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  borderRadius: '12px',
                  background: '#5492a3',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Plus size={18} />
                Add 8 oz
              </button>

              {/* Hydration Tips Toggle */}
              <button
                onClick={() => setShowHydrationTips(!showHydrationTips)}
                style={{
                  width: '100%', marginTop: '12px', padding: '10px',
                  border: 'none', background: 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '6px'
                }}
              >
                <span style={{ fontSize: '13px', color: '#5492a3', fontWeight: '500' }}>
                  Hydration Schedule & Tips
                </span>
                <ChevronDown size={16} color="#5492a3" style={{
                  transform: showHydrationTips ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }} />
              </button>

              {showHydrationTips && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ padding: '8px 12px', background: '#e4eff3', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#3d7a8a', fontStyle: 'italic' }}>
                      {hydrationGuide.dailyNeeds}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '8px' }}>Best Hydration Times</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {hydrationGuide.timingSchedule.map((entry, idx) => (
                        <div key={idx} style={{
                          display: 'flex', gap: '12px', padding: '8px 12px',
                          background: idx % 2 === 0 ? '#f5f3f0' : 'white',
                          borderRadius: '8px'
                        }}>
                          <span style={{ fontSize: '12px', color: '#5492a3', fontWeight: '500', minWidth: '90px' }}>
                            {entry.time}
                          </span>
                          <span style={{ fontSize: '12px', color: '#4a5550' }}>
                            {entry.instruction}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '8px' }}>How to Hydrate</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#4a5550', fontSize: '12px', lineHeight: 1.7 }}>
                      {hydrationGuide.rules.map((rule, idx) => (
                        <li key={idx}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Activity size={20} color="#a89d7f" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Walking
                </h3>
              </div>
              {todayData.walks.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  {todayData.walks.map((walk, idx) => (
                    <div key={idx} style={{ 
                      padding: '10px',
                      background: '#f5f3f0',
                      borderRadius: '8px',
                      marginBottom: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '14px', color: '#4a5550' }}>{walk.time}</span>
                      <span style={{ fontSize: '13px', color: '#7a7a7a' }}>{walk.duration}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={addWalk}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  borderRadius: '12px',
                  background: '#a89d7f',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Plus size={18} />
                Log Walk
              </button>
            </div>

            {/* Walking Reminders */}
            <div style={{ 
              background: 'white', 
              borderRadius: '16px', 
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Activity size={20} color="#a89d7f" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Walk Reminders
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {walkReminders.map((reminder, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px',
                      border: '2px solid #e0ddd8',
                      borderRadius: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', color: '#4a5550' }}>{reminder.time}</div>
                      <div style={{ fontSize: '12px', color: '#7a7a7a' }}>{reminder.label}</div>
                    </div>
                    <button
                      onClick={() => toggleWalkReminder(idx)}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '8px',
                        background: reminder.enabled ? '#5492a3' : '#e0ddd8',
                        color: reminder.enabled ? 'white' : '#7a7a7a',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {reminder.enabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'meals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Plate Proportions + Daily Goals */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                flex: 1,
                minWidth: '280px'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Plate Proportions
                </h3>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <svg
                    width="160"
                    height="120"
                    viewBox="0 0 160 120"
                    role="img"
                    aria-label="Plate proportions: half veggies, quarter protein, quarter starch"
                  >
                    <rect x="2" y="2" width="156" height="116" rx="14" fill="#ffffff" stroke="#e0ddd8" strokeWidth="4" />
                    <rect x="6" y="6" width="74" height="108" rx="10" fill="#3c9d6b" />
                    <rect x="82" y="6" width="72" height="52" rx="10" fill="#e07a5f" />
                    <rect x="82" y="62" width="72" height="52" rx="10" fill="#3d7a8a" />
                  </svg>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '12px', height: '12px', background: '#3c9d6b', borderRadius: '50%' }} />
                      <span style={{ fontSize: '13px', color: '#7a7a7a' }}>½ Veggies</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '12px', height: '12px', background: '#e07a5f', borderRadius: '50%' }} />
                      <span style={{ fontSize: '13px', color: '#7a7a7a' }}>¼ Protein</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '12px', height: '12px', background: '#3d7a8a', borderRadius: '50%' }} />
                      <span style={{ fontSize: '13px', color: '#7a7a7a' }}>¼ Starch</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                flex: 1,
                minWidth: '280px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <Utensils size={18} color="#a89d7f" />
                  <h3 style={{ margin: 0, fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>
                    Daily Goals
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ padding: '12px', background: '#f5f3f0', borderRadius: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#7a7a7a', marginBottom: '4px' }}>Protein</div>
                    <div style={{ fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>100g / day</div>
                  </div>
                  <div style={{ padding: '12px', background: '#f5f3f0', borderRadius: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#7a7a7a', marginBottom: '4px' }}>Fiber</div>
                    <div style={{ fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>30g / day</div>
                  </div>
                  <div style={{ padding: '12px', background: '#f5f3f0', borderRadius: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#7a7a7a', marginBottom: '4px' }}>Sugar Limit</div>
                    <div style={{ fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>36g / day</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Approved Foods Guide */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <button
                onClick={() => setExpandedMealsSection(expandedMealsSection === 'foods' ? null : 'foods')}
                style={{
                  width: '100%', padding: '0', border: 'none', background: 'transparent',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Utensils size={20} color="#a89d7f" />
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                    Approved Foods Guide
                  </h3>
                </div>
                <ChevronDown size={18} color="#7a7a7a" style={{
                  transform: expandedMealsSection === 'foods' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }} />
              </button>
              {expandedMealsSection === 'foods' && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Protein */}
                  <div>
                    <button
                      onClick={() => toggleFoodCategory('protein')}
                      style={{
                        width: '100%', padding: '12px', border: '2px solid #e0ddd8', borderRadius: '12px',
                        background: expandedFoodCategory === 'protein' ? '#f5f3f0' : 'white',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <span style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>Protein Sources</span>
                      <ChevronDown size={18} color="#7a7a7a" style={{
                        transform: expandedFoodCategory === 'protein' ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                      }} />
                    </button>
                    {expandedFoodCategory === 'protein' && (
                      <div style={{ padding: '16px', background: '#f5f3f0', borderRadius: '0 0 12px 12px', marginTop: '-8px' }}>
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '6px' }}>Plant Protein</div>
                          <div style={{ fontSize: '13px', color: '#4a5550', lineHeight: '1.6' }}>
                            {foodLists.protein.plant.join(' • ')}
                          </div>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '6px' }}>Animal Protein</div>
                          <div style={{ fontSize: '13px', color: '#4a5550', lineHeight: '1.6' }}>
                            {foodLists.protein.animal.join(' • ')}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', color: '#a86d5f', fontWeight: '500', marginBottom: '6px' }}>Avoid</div>
                          <div style={{ fontSize: '13px', color: '#7a7a7a', lineHeight: '1.6' }}>
                            {foodLists.protein.avoid.join(' • ')}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Veggies */}
                  <div>
                    <button
                      onClick={() => toggleFoodCategory('veggies')}
                      style={{
                        width: '100%', padding: '12px', border: '2px solid #e0ddd8', borderRadius: '12px',
                        background: expandedFoodCategory === 'veggies' ? '#f5f3f0' : 'white',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <span style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>Non-Starch Vegetables</span>
                      <ChevronDown size={18} color="#7a7a7a" style={{
                        transform: expandedFoodCategory === 'veggies' ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                      }} />
                    </button>
                    {expandedFoodCategory === 'veggies' && (
                      <div style={{ padding: '16px', background: '#f5f3f0', borderRadius: '0 0 12px 12px', marginTop: '-8px' }}>
                        <div style={{ padding: '8px 12px', background: '#e4eff3', borderRadius: '8px', marginBottom: '12px' }}>
                          <div style={{ fontSize: '12px', color: '#3d7a8a', fontStyle: 'italic' }}>
                            {foodLists.veggies.note}
                          </div>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '6px' }}>Try These More Often</div>
                          <div style={{ fontSize: '13px', color: '#4a5550', lineHeight: '1.6' }}>
                            {foodLists.veggies.preferred.join(' • ')}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '6px' }}>Good Accessory Veggies</div>
                          <div style={{ fontSize: '13px', color: '#4a5550', lineHeight: '1.6' }}>
                            {foodLists.veggies.accessory.join(' • ')}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Starches */}
                  <div>
                    <button
                      onClick={() => toggleFoodCategory('starch')}
                      style={{
                        width: '100%', padding: '12px', border: '2px solid #e0ddd8', borderRadius: '12px',
                        background: expandedFoodCategory === 'starch' ? '#f5f3f0' : 'white',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <span style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>Healthy Starches & Grains</span>
                      <ChevronDown size={18} color="#7a7a7a" style={{
                        transform: expandedFoodCategory === 'starch' ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                      }} />
                    </button>
                    {expandedFoodCategory === 'starch' && (
                      <div style={{ padding: '16px', background: '#f5f3f0', borderRadius: '0 0 12px 12px', marginTop: '-8px' }}>
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '6px' }}>Approved Starches</div>
                          <div style={{ fontSize: '13px', color: '#4a5550', lineHeight: '1.6' }}>
                            {foodLists.starch.approved.join(' • ')}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', color: '#a89d7f', fontWeight: '500', marginBottom: '6px' }}>Limit These</div>
                          <div style={{ fontSize: '13px', color: '#7a7a7a', lineHeight: '1.6' }}>
                            {foodLists.starch.limit.join(' • ')}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Healthy Fats */}
                  <div>
                    <button
                      onClick={() => toggleFoodCategory('fats')}
                      style={{
                        width: '100%', padding: '12px', border: '2px solid #e0ddd8', borderRadius: '12px',
                        background: expandedFoodCategory === 'fats' ? '#f5f3f0' : 'white',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <span style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>Healthy Fats</span>
                      <ChevronDown size={18} color="#7a7a7a" style={{
                        transform: expandedFoodCategory === 'fats' ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                      }} />
                    </button>
                    {expandedFoodCategory === 'fats' && (
                      <div style={{ padding: '16px', background: '#f5f3f0', borderRadius: '0 0 12px 12px', marginTop: '-8px' }}>
                        <div style={{ fontSize: '13px', color: '#4a5550', lineHeight: '1.6' }}>
                          {foodLists.fats.approved.join(' • ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Protein Reference */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <button
                onClick={() => setExpandedMealsSection(expandedMealsSection === 'protein' ? null : 'protein')}
                style={{
                  width: '100%', padding: '0', border: 'none', background: 'transparent',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <TrendingUp size={20} color="#a89d7f" />
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                    Protein Reference
                  </h3>
                </div>
                <ChevronDown size={18} color="#7a7a7a" style={{
                  transform: expandedMealsSection === 'protein' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }} />
              </button>
              {expandedMealsSection === 'protein' && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ padding: '10px 12px', background: '#e4eff3', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '600' }}>Goal: {proteinPortions.goal}</div>
                    <div style={{ fontSize: '12px', color: '#3d7a8a', marginTop: '4px' }}>
                      {proteinPortions.calculation}
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '8px' }}>Animal Protein</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', padding: '8px 12px', background: '#e4eff3', borderRadius: '8px 8px 0 0' }}>
                      <span style={{ flex: 2, fontSize: '12px', color: '#3d7a8a', fontWeight: '600' }}>Food</span>
                      <span style={{ flex: 1, fontSize: '12px', color: '#3d7a8a', fontWeight: '600', textAlign: 'center' }}>Amount</span>
                      <span style={{ flex: 1, fontSize: '12px', color: '#3d7a8a', fontWeight: '600', textAlign: 'right' }}>Protein</span>
                    </div>
                    {proteinPortions.animal.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex', padding: '8px 12px',
                        background: idx % 2 === 0 ? '#f5f3f0' : 'white',
                        borderRadius: idx === proteinPortions.animal.length - 1 ? '0 0 8px 8px' : '0'
                      }}>
                        <span style={{ flex: 2, fontSize: '13px', color: '#4a5550' }}>{item.food}</span>
                        <span style={{ flex: 1, fontSize: '13px', color: '#7a7a7a', textAlign: 'center' }}>{item.amount}</span>
                        <span style={{ flex: 1, fontSize: '13px', color: '#5492a3', fontWeight: '500', textAlign: 'right' }}>{item.protein}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '8px' }}>Plant Protein</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', padding: '8px 12px', background: '#e4eff3', borderRadius: '8px 8px 0 0' }}>
                      <span style={{ flex: 2, fontSize: '12px', color: '#3d7a8a', fontWeight: '600' }}>Food</span>
                      <span style={{ flex: 1, fontSize: '12px', color: '#3d7a8a', fontWeight: '600', textAlign: 'center' }}>Amount</span>
                      <span style={{ flex: 1, fontSize: '12px', color: '#3d7a8a', fontWeight: '600', textAlign: 'right' }}>Protein</span>
                    </div>
                    {proteinPortions.plant.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex', padding: '8px 12px',
                        background: idx % 2 === 0 ? '#f5f3f0' : 'white',
                        borderRadius: idx === proteinPortions.plant.length - 1 ? '0 0 8px 8px' : '0'
                      }}>
                        <span style={{ flex: 2, fontSize: '13px', color: '#4a5550' }}>{item.food}</span>
                        <span style={{ flex: 1, fontSize: '13px', color: '#7a7a7a', textAlign: 'center' }}>{item.amount}</span>
                        <span style={{ flex: 1, fontSize: '13px', color: '#5492a3', fontWeight: '500', textAlign: 'right' }}>{item.protein}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Fiber Guide */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <button
                onClick={() => setExpandedMealsSection(expandedMealsSection === 'fiber' ? null : 'fiber')}
                style={{
                  width: '100%', padding: '0', border: 'none', background: 'transparent',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Activity size={20} color="#a89d7f" />
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                    Fiber Guide
                  </h3>
                </div>
                <ChevronDown size={18} color="#7a7a7a" style={{
                  transform: expandedMealsSection === 'fiber' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }} />
              </button>
              {expandedMealsSection === 'fiber' && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ padding: '10px 12px', background: '#e4eff3', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '600' }}>Goal: {fiberGuide.goal}</div>
                  </div>

                  <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '8px' }}>Top Fiber Foods</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', padding: '8px 12px', background: '#e4eff3', borderRadius: '8px 8px 0 0' }}>
                      <span style={{ flex: 2, fontSize: '12px', color: '#3d7a8a', fontWeight: '600' }}>Food</span>
                      <span style={{ flex: 1, fontSize: '12px', color: '#3d7a8a', fontWeight: '600', textAlign: 'center' }}>Amount</span>
                      <span style={{ flex: 1, fontSize: '12px', color: '#3d7a8a', fontWeight: '600', textAlign: 'right' }}>Fiber</span>
                    </div>
                    {fiberGuide.topFoods.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex', padding: '8px 12px',
                        background: idx % 2 === 0 ? '#f5f3f0' : 'white',
                        borderRadius: idx === fiberGuide.topFoods.length - 1 ? '0 0 8px 8px' : '0'
                      }}>
                        <span style={{ flex: 2, fontSize: '13px', color: '#4a5550' }}>{item.food}</span>
                        <span style={{ flex: 1, fontSize: '13px', color: '#7a7a7a', textAlign: 'center' }}>{item.amount}</span>
                        <span style={{ flex: 1, fontSize: '13px', color: '#5492a3', fontWeight: '500', textAlign: 'right' }}>{item.fiber}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '8px' }}>How to Increase Gradually</div>
                  <ol style={{ margin: '0 0 16px 0', paddingLeft: '18px', color: '#4a5550', fontSize: '13px', lineHeight: 1.7 }}>
                    {fiberGuide.gradualIncrease.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>

                  <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '8px' }}>Why Gut Health Matters</div>
                  <div style={{ padding: '12px', background: '#f8f7f4', borderRadius: '10px' }}>
                    <div style={{ fontSize: '12px', color: '#7a7a7a', marginBottom: '8px' }}>
                      You need a healthy gut microbiome for:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {fiberGuide.gutHealthBenefits.map(benefit => (
                        <span key={benefit} style={{
                          padding: '4px 10px', borderRadius: '999px',
                          background: '#e8f5e9', color: '#2e7d32',
                          fontSize: '12px', fontWeight: '500'
                        }}>
                          {benefit}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Weekly Rotation */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <button
                onClick={() => setExpandedMealsSection(expandedMealsSection === 'rotation' ? null : 'rotation')}
                style={{
                  width: '100%', padding: '0', border: 'none', background: 'transparent',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Info size={20} color="#a89d7f" />
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                    Weekly Rotation
                  </h3>
                </div>
                <ChevronDown size={18} color="#7a7a7a" style={{
                  transform: expandedMealsSection === 'rotation' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }} />
              </button>
              {expandedMealsSection === 'rotation' && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Protein Rotation */}
                  <div style={{ padding: '16px', background: '#f5f3f0', borderRadius: '12px' }}>
                    <div style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500', marginBottom: '8px' }}>Protein Variety</div>
                    <div style={{ padding: '8px 12px', background: '#e4eff3', borderRadius: '8px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#3d7a8a', fontStyle: 'italic' }}>
                        {weeklyRotation.protein.dailyTip}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#7a7a7a', fontWeight: '500', marginBottom: '6px' }}>Animal protein for the week:</div>
                    <ul style={{ margin: '0 0 10px 0', paddingLeft: '18px', color: '#4a5550', fontSize: '13px', lineHeight: 1.7 }}>
                      {weeklyRotation.protein.weeklyDistribution.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                    <div style={{ fontSize: '12px', color: '#7a7a7a', fontWeight: '500', marginBottom: '6px' }}>Plant protein for the week:</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#4a5550', fontSize: '13px', lineHeight: 1.7 }}>
                      {weeklyRotation.protein.plantWeekly.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Starch Rotation */}
                  <div style={{ padding: '16px', background: '#f5f3f0', borderRadius: '12px' }}>
                    <div style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500', marginBottom: '8px' }}>Starch Variety</div>
                    <div style={{ padding: '8px 12px', background: '#e4eff3', borderRadius: '8px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#3d7a8a', fontStyle: 'italic' }}>
                        {weeklyRotation.starch.dailyTip}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#7a7a7a', fontWeight: '500', marginBottom: '6px' }}>Healthy starch distribution:</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#4a5550', fontSize: '13px', lineHeight: 1.7 }}>
                      {weeklyRotation.starch.weeklyDistribution.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Sugar Guide */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <button
                onClick={() => setExpandedMealsSection(expandedMealsSection === 'sugar' ? null : 'sugar')}
                style={{
                  width: '100%', padding: '0', border: 'none', background: 'transparent',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Info size={20} color="#a89d7f" />
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                    Sugar Guide
                  </h3>
                </div>
                <ChevronDown size={18} color="#7a7a7a" style={{
                  transform: expandedMealsSection === 'sugar' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }} />
              </button>
              {expandedMealsSection === 'sugar' && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ padding: '10px 12px', background: '#e4eff3', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '600' }}>
                      Daily limit: {sugarGuide.dailyLimit}
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '8px' }}>How to Calculate</div>
                  <ul style={{ margin: '0 0 16px 0', paddingLeft: '18px', color: '#4a5550', fontSize: '13px', lineHeight: 1.7 }}>
                    {sugarGuide.howToCalculate.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>

                  <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '8px' }}>Healthier Sugars</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {sugarGuide.healthierSugars.map(item => (
                      <span key={item} style={{
                        padding: '4px 10px', borderRadius: '999px',
                        background: '#e8f5e9', color: '#2e7d32',
                        fontSize: '12px', fontWeight: '500'
                      }}>
                        {item}
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '8px' }}>Sugars to Avoid</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {sugarGuide.sugarsToAvoid.map(item => (
                      <span key={item} style={{
                        padding: '4px 10px', borderRadius: '999px',
                        background: '#fce4ec', color: '#a86d5f',
                        fontSize: '12px', fontWeight: '500'
                      }}>
                        {item}
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: '13px', color: '#3d7a8a', fontWeight: '500', marginBottom: '8px' }}>Liquid Sugars to Avoid</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', padding: '8px 12px', background: '#fce4ec', borderRadius: '8px 8px 0 0' }}>
                      <span style={{ flex: 2, fontSize: '12px', color: '#a86d5f', fontWeight: '600' }}>Drink</span>
                      <span style={{ flex: 1, fontSize: '12px', color: '#a86d5f', fontWeight: '600', textAlign: 'right' }}>Sugar</span>
                    </div>
                    {sugarGuide.liquidSugarsToAvoid.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex', padding: '8px 12px',
                        background: idx % 2 === 0 ? '#f5f3f0' : 'white',
                        borderRadius: idx === sugarGuide.liquidSugarsToAvoid.length - 1 ? '0 0 8px 8px' : '0'
                      }}>
                        <span style={{ flex: 2, fontSize: '13px', color: '#4a5550' }}>{item.drink}</span>
                        <span style={{ flex: 1, fontSize: '13px', color: '#a86d5f', fontWeight: '500', textAlign: 'right' }}>{item.sugar}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '8px 12px', background: '#e4eff3', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#3d7a8a', fontStyle: 'italic' }}>
                      {sugarGuide.liquidTip}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Recipe Ideas */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showRecipes ? '16px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Utensils size={20} color="#a89d7f" />
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                    Recipe Ideas
                  </h3>
                </div>
                <button
                  onClick={() => setShowRecipes(!showRecipes)}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    background: '#5492a3',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                >
                  {showRecipes ? 'Hide' : 'Show'}
                </button>
              </div>

              {showRecipes && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#7a7a7a', fontWeight: '500' }}>
                      Breakfast Ideas
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {breakfastRecipes.map((recipe, idx) => (
                        <div key={idx} style={{
                          padding: '14px',
                          background: '#f5f3f0',
                          borderRadius: '12px',
                          border: '2px solid #e8e6e1'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>
                              {recipe.name}
                            </span>
                            <span style={{ fontSize: '12px', color: '#5492a3', fontWeight: '500' }}>
                              {recipe.protein}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#7a7a7a', marginBottom: '6px' }}>
                            ⏱ {recipe.time}
                          </div>
                          <div style={{ fontSize: '12px', color: '#7a7a7a' }}>
                            {recipe.ingredients.join(' • ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#7a7a7a', fontWeight: '500' }}>
                      Lunch & Dinner Ideas
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {lunchDinnerRecipes.map((recipe, idx) => (
                        <div key={idx} style={{
                          padding: '14px',
                          background: '#f5f3f0',
                          borderRadius: '12px',
                          border: '2px solid #e8e6e1'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>
                              {recipe.name}
                            </span>
                            <span style={{ fontSize: '12px', color: '#5492a3', fontWeight: '500' }}>
                              {recipe.protein}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#7a7a7a', marginBottom: '8px' }}>
                            ⏱ {recipe.time}
                          </div>
                          <div style={{ fontSize: '12px', color: '#3d7a8a' }}>
                            <div>¼ Protein: {recipe.plate.protein}</div>
                            <div>½ Veggies: {recipe.plate.veggies}</div>
                            <div>¼ Starch: {recipe.plate.starch}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Meal Timing */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                Meal Timing
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: '14px', color: '#4a5550' }}>Breakfast</span>
                  <span style={{ fontSize: '14px', color: '#7a7a7a' }}>Within 1hr of waking</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: '14px', color: '#4a5550' }}>Lunch</span>
                  <span style={{ fontSize: '14px', color: '#7a7a7a' }}>12 - 2pm</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                  <span style={{ fontSize: '14px', color: '#4a5550' }}>Dinner</span>
                  <span style={{ fontSize: '14px', color: '#7a7a7a' }}>5 - 7pm</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ 
              background: 'white', 
              borderRadius: '16px', 
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <TrendingUp size={20} color="#bcd4da" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Health Metrics
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#7a7a7a', marginBottom: '8px' }}>
                    Blood Pressure
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input
                      type="number"
                      placeholder="Systolic"
                      value={metrics.bloodPressure.systolic}
                      onChange={(e) => setMetrics(prev => ({
                        ...prev,
                        bloodPressure: { ...prev.bloodPressure, systolic: e.target.value }
                      }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e0ddd8',
                        borderRadius: '12px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Diastolic"
                      value={metrics.bloodPressure.diastolic}
                      onChange={(e) => setMetrics(prev => ({
                        ...prev,
                        bloodPressure: { ...prev.bloodPressure, diastolic: e.target.value }
                      }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e0ddd8',
                        borderRadius: '12px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#7a7a7a', marginBottom: '8px' }}>
                    Heart Rate (bpm)
                  </label>
                  <input
                    type="number"
                    value={metrics.heartRate}
                    onChange={(e) => setMetrics(prev => ({ ...prev, heartRate: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e0ddd8',
                      borderRadius: '12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#7a7a7a', marginBottom: '8px' }}>
                    Weight (lbs)
                  </label>
                  <input
                    type="number"
                    value={metrics.weight}
                    onChange={(e) => setMetrics(prev => ({ ...prev, weight: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e0ddd8',
                      borderRadius: '12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#7a7a7a', marginBottom: '8px' }}>
                    Respiratory Rate (breaths/min)
                  </label>
                  <input
                    type="number"
                    value={metrics.respiratoryRate}
                    onChange={(e) => setMetrics(prev => ({ ...prev, respiratoryRate: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e0ddd8',
                      borderRadius: '12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveMetrics}
                  style={{
                    width: '100%',
                    padding: '14px',
                    border: 'none',
                    borderRadius: '12px',
                    background: '#5492a3',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.3s ease',
                    marginTop: '8px'
                  }}
                >
                  Save Metrics
                </button>
                <button
                  type="button"
                  onClick={exportLocalData}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0ddd8',
                    borderRadius: '12px',
                    background: 'white',
                    color: '#4a5550',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Export Local Data
                </button>
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={syncStatus === 'syncing'}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0ddd8',
                    borderRadius: '12px',
                    background: syncStatus === 'syncing' ? '#f0ede7' : 'white',
                    color: '#4a5550',
                    cursor: syncStatus === 'syncing' ? 'default' : 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'all 0.3s ease',
                    marginTop: '8px'
                  }}
                >
                  {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
                </button>
                {syncStatus !== 'idle' && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: syncStatus === 'error' ? '#b85c5c' : '#7a7a7a'
                  }}>
                    {syncStatus === 'success' && lastSyncedLabel ? `Last synced ${lastSyncedLabel}.` : null}
                    {syncStatus === 'success' && !lastSyncedLabel ? 'Sync complete.' : null}
                    {syncStatus === 'error' ? `Sync failed: ${syncError || 'check connection'}.` : null}
                  </div>
                )}
                <div style={{ paddingTop: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#7a7a7a', fontWeight: '500', marginBottom: '8px' }}>
                    Recent readings
                  </div>
                  {metricsHistory.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#9b9b9b' }}>No saved readings yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {metricsHistory.slice(0, 3).map((entry) => (
                        <div
                          key={entry.recordedAt}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: '#f5f3f0',
                            color: '#4a5550',
                            fontSize: '12px'
                          }}
                        >
                          <div style={{ color: '#7a7a7a', marginBottom: '4px' }}>
                            {new Date(entry.recordedAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </div>
                          <div>
                            BP {entry.bloodPressure?.systolic || '--'}/{entry.bloodPressure?.diastolic || '--'} • HR {entry.heartRate || '--'} • Wt {entry.weight || '--'}{entry.respiratoryRate ? ` • RR ${entry.respiratoryRate}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ 
              background: 'white', 
              borderRadius: '16px', 
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#7a7a7a', fontWeight: '500', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Trends</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['summary', 'charts'] as const).map(view => (
                      <button
                        key={view}
                        onClick={() => setTrendView(view)}
                        style={{
                          padding: '4px 10px',
                          border: trendView === view ? 'none' : '1px solid #e0ddd8',
                          borderRadius: '6px',
                          background: trendView === view ? '#5492a3' : 'white',
                          color: trendView === view ? 'white' : '#4a5550',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '500',
                          transition: 'all 0.2s ease',
                          textTransform: 'capitalize'
                        }}
                      >
                        {view}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['week', 'month', 'all'] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setTrendDateRange(range)}
                      style={{
                        padding: '8px 12px',
                        border: trendDateRange === range ? 'none' : '2px solid #e0ddd8',
                        borderRadius: '8px',
                        background: trendDateRange === range ? '#5492a3' : 'white',
                        color: trendDateRange === range ? 'white' : '#4a5550',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500',
                        transition: 'all 0.2s ease',
                        textTransform: 'capitalize'
                      }}
                    >
                      {range === 'week' ? '7 days' : range === 'month' ? '30 days' : 'All'}
                    </button>
                  ))}
                </div>
              </div>

              {trendView === 'summary' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  {(() => {
                    const systolic = getTrendStats('systolic');
                    const diastolic = getTrendStats('diastolic');
                    const heartRate = getTrendStats('heartRate');
                    const respiratoryRate = getTrendStats('respiratoryRate');
                    const meditation = getMeditationStats();

                    return [
                      { label: 'Systolic BP', unit: 'mmHg', stats: systolic },
                      { label: 'Diastolic BP', unit: 'mmHg', stats: diastolic },
                      { label: 'Heart Rate', unit: 'bpm', stats: heartRate },
                      { label: 'Respiratory Rate', unit: 'br/min', stats: respiratoryRate },
                      { label: 'Meditations', unit: 'total', stats: { latest: meditation.total, trend: meditation.trend, count: meditation.daysInRange } }
                    ].map((card, idx) => (
                      <div
                        key={card.label}
                        style={{
                          padding: '12px',
                          borderRadius: '12px',
                          background: '#f8f7f4',
                          gridColumn: idx === 4 ? '1 / -1' : 'span 1'
                        }}
                      >
                        <div style={{ fontSize: '11px', color: '#7a7a7a', fontWeight: '500', marginBottom: '6px' }}>
                          {card.label} {card.unit ? `(${card.unit})` : ''}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '600', color: '#4a5550' }}>
                            {card.stats.latest}
                          </span>
                          <span style={{ fontSize: '14px', color: '#7a7a7a' }}>
                            {card.stats.trend}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#9b9b9b' }}>
                          {card.stats.count} {card.stats.count === 1 ? 'reading' : 'readings'}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {trendView === 'charts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
                  {getChartData().length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', fontSize: '14px', color: '#9b9b9b' }}>
                      No data available for this date range.
                    </div>
                  ) : (
                    <>
                      {getTrendStats('systolic').count > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#7a7a7a', fontWeight: '500' }}>Blood Pressure</div>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={getChartData()}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e0ddd8" />
                              <XAxis dataKey="timestamp" tick={{ fontSize: 11 }} />
                              <YAxis label={{ value: 'mmHg', angle: -90, position: 'insideLeft' }} />
                              <Tooltip />
                              <Line type="monotone" dataKey="systolic" stroke="#d97a5d" name="Systolic" dot={false} />
                              <Line type="monotone" dataKey="diastolic" stroke="#7da8a0" name="Diastolic" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {getTrendStats('heartRate').count > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#7a7a7a', fontWeight: '500' }}>Heart Rate</div>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={getChartData()}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e0ddd8" />
                              <XAxis dataKey="timestamp" tick={{ fontSize: 11 }} />
                              <YAxis label={{ value: 'bpm', angle: -90, position: 'insideLeft' }} />
                              <Tooltip />
                              <Line type="monotone" dataKey="heartRate" stroke="#5492a3" name="HR" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {getTrendStats('respiratoryRate').count > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#7a7a7a', fontWeight: '500' }}>Respiratory Rate</div>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={getChartData()}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e0ddd8" />
                              <XAxis dataKey="timestamp" tick={{ fontSize: 11 }} />
                              <YAxis label={{ value: 'br/min', angle: -90, position: 'insideLeft' }} />
                              <Tooltip />
                              <Line type="monotone" dataKey="respiratoryRate" stroke="#a89d7f" name="RR" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {getTrendStats('weight').count > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#7a7a7a', fontWeight: '500' }}>Weight</div>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={getChartData()}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e0ddd8" />
                              <XAxis dataKey="timestamp" tick={{ fontSize: 11 }} />
                              <YAxis label={{ value: 'lbs', angle: -90, position: 'insideLeft' }} />
                              <Tooltip />
                              <Line type="monotone" dataKey="weight" stroke="#8b9d83" name="Weight" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'mindfulness' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ 
              background: 'white', 
              borderRadius: '16px', 
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Activity size={20} color="#a89d7f" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Mindfulness Moment
                </h3>
              </div>
              
              <div style={{
                padding: '16px',
                border: '2px solid #e0ddd8',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: '#f8f7f4'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '12px', color: '#7a7a7a', fontWeight: '500' }}>Today check-ins</span>
                    <span style={{ fontSize: '18px', color: '#4a5550', fontWeight: '600' }}>{meditationCount}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setTodayData(prev => ({
                        ...prev,
                        meditationCount: Math.max(0, (prev.meditationCount ?? 0) - 1)
                      }))}
                      aria-label="Decrease meditation check-ins"
                      style={{
                        border: 'none',
                        background: '#f0ede7',
                        color: '#6b6b6b',
                        borderRadius: '8px',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        lineHeight: 1
                      }}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setTodayData(prev => ({
                        ...prev,
                        meditationCount: (prev.meditationCount ?? 0) + 1
                      }))}
                      aria-label="Increase meditation check-ins"
                      style={{
                        border: 'none',
                        background: '#e4eff3',
                        color: '#3d7a8a',
                        borderRadius: '8px',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        lineHeight: 1,
                        fontWeight: '600'
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#7a7a7a', marginBottom: '4px', fontWeight: '500' }}>
                      {mindfulnessLabel} suggestion
                    </div>
                    <div style={{ fontSize: '16px', color: '#4a5550', fontWeight: '600' }}>
                      {suggestedExercise.name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#7a7a7a', marginTop: '4px' }}>
                      {suggestedExercise.tradition} • {suggestedExercise.duration} min • {suggestedExercise.difficulty}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMindfulnessState(prev => {
                      if (prev.remainingIds.length === 0) return prev;
                      const [nextId, ...rest] = prev.remainingIds;
                      return { ...prev, remainingIds: rest, currentId: nextId };
                    })}
                    aria-label="Show another exercise"
                    disabled={!hasMoreSuggestions}
                    style={{
                      border: 'none',
                      background: '#f5f3f0',
                      color: '#6b6b6b',
                      borderRadius: '999px',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: hasMoreSuggestions ? 'pointer' : 'not-allowed',
                      opacity: hasMoreSuggestions ? 1 : 0.5
                    }}
                  >
                    <ChevronRight size={18} color="#9b9b9b" />
                  </button>
                </div>

                <div style={{ fontSize: '13px', color: '#6b6b6b' }}>
                  {suggestedExercise.primaryBenefit}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {suggestedExercise.goals.map(goal => (
                    <span
                      key={goal}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '999px',
                        background: '#f5f3f0',
                        color: '#6b6b6b',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}
                    >
                      {goal.replace('_', ' ')}
                    </span>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#7a7a7a', fontWeight: '500', marginBottom: '6px' }}>
                    Instructions
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '18px', color: '#4a5550', fontSize: '13px', lineHeight: 1.5 }}>
                    {suggestedExercise.instructions.map((step, index) => (
                      <li key={`${suggestedExercise.id}-step-${index}`}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: '#f8f7f4',
                  color: '#6b6b6b',
                  fontSize: '12px',
                  lineHeight: 1.5
                }}>
                  Physiological effects: {suggestedExercise.physiologicalEffects}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthSaga;