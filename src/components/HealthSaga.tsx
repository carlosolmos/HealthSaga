import { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Check, TrendingUp, Droplet, Pill, Utensils, Activity, ChevronRight, ChevronDown } from 'lucide-react';
import meditationExercisesData from '../data/meditation_exercises.json';

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
  bloodPressure: { systolic: string; diastolic: string };
  heartRate: string;
  weight: string;
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
  morningWater: false
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
    weight: ''
  });

  const [metricsHistory, setMetricsHistory] = useLocalStorage<MetricsEntry[]>('healthsaga-metrics-history', []);

  const handleSaveMetrics = () => {
    const entry: MetricsEntry = {
      recordedAt: new Date().toISOString(),
      bloodPressure: {
        systolic: metrics.bloodPressure.systolic.trim(),
        diastolic: metrics.bloodPressure.diastolic.trim()
      },
      heartRate: metrics.heartRate.trim(),
      weight: metrics.weight.trim()
    };
    const hasValues = Boolean(
      entry.bloodPressure.systolic ||
      entry.bloodPressure.diastolic ||
      entry.heartRate ||
      entry.weight
    );
    if (hasValues) {
      setMetricsHistory(prev => [entry, ...prev].slice(0, 50));
    }
    setMetrics({
      bloodPressure: { systolic: '', diastolic: '' },
      heartRate: '',
      weight: ''
    });
  };

  const [walkReminders, setWalkReminders] = useLocalStorage('healthsaga-reminders', [
    { time: '10:00 AM', label: 'Morning walk', enabled: true },
    { time: '2:00 PM', label: 'Afternoon walk', enabled: true },
    { time: '4:30 PM', label: 'Evening walk', enabled: true }
  ]);

  const [showRecipes, setShowRecipes] = useState(false);

  const [expandedFoodCategory, setExpandedFoodCategory] = useState<string | null>(null);

  const foodLists = {
    protein: {
      plant: ['Beans (all types)', 'Lentils', 'Chickpeas', 'Split peas', 'Quinoa', 'Hemp hearts', 'Organic sprouted tofu', 'Organic tempeh', 'Organic natto'],
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
      approved: ['Avocado', 'Avocado oil', 'Olives', 'Olive oil', 'Nuts', 'Seeds']
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

  const suggestedExercise = mindfulnessPool.find(exercise => exercise.id === mindfulnessState.currentId)
    ?? mindfulnessPool[0];
  const mindfulnessLabel = mindfulnessSlot === 'morning' ? 'Morning' : 'Evening';
  const hasMoreSuggestions = mindfulnessState.remainingIds.length > 0;

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
            
            {/* Recipe Suggestions */}
            <div style={{ 
              background: 'white', 
              borderRadius: '16px', 
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
                  {/* Approved Foods Guide */}
                  <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #f0f0f0' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#7a7a7a', fontWeight: '500' }}>
                      Approved Foods Guide
                    </h4>

                    {/* Protein */}
                    <div style={{ marginBottom: '8px' }}>
                      <button
                        onClick={() => toggleFoodCategory('protein')}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e0ddd8',
                          borderRadius: '12px',
                          background: expandedFoodCategory === 'protein' ? '#f5f3f0' : 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <span style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>Protein Sources</span>
                        <ChevronDown 
                          size={18} 
                          color="#7a7a7a" 
                          style={{ 
                            transform: expandedFoodCategory === 'protein' ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease'
                          }} 
                        />
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
                    <div style={{ marginBottom: '8px' }}>
                      <button
                        onClick={() => toggleFoodCategory('veggies')}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e0ddd8',
                          borderRadius: '12px',
                          background: expandedFoodCategory === 'veggies' ? '#f5f3f0' : 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <span style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>Non-Starch Vegetables</span>
                        <ChevronDown 
                          size={18} 
                          color="#7a7a7a" 
                          style={{ 
                            transform: expandedFoodCategory === 'veggies' ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease'
                          }} 
                        />
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
                    <div style={{ marginBottom: '8px' }}>
                      <button
                        onClick={() => toggleFoodCategory('starch')}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e0ddd8',
                          borderRadius: '12px',
                          background: expandedFoodCategory === 'starch' ? '#f5f3f0' : 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <span style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>Healthy Starches & Grains</span>
                        <ChevronDown 
                          size={18} 
                          color="#7a7a7a" 
                          style={{ 
                            transform: expandedFoodCategory === 'starch' ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease'
                          }} 
                        />
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
                    <div style={{ marginBottom: '8px' }}>
                      <button
                        onClick={() => toggleFoodCategory('fats')}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e0ddd8',
                          borderRadius: '12px',
                          background: expandedFoodCategory === 'fats' ? '#f5f3f0' : 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <span style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>Healthy Fats</span>
                        <ChevronDown 
                          size={18} 
                          color="#7a7a7a" 
                          style={{ 
                            transform: expandedFoodCategory === 'fats' ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease'
                          }} 
                        />
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
                    placeholder="72"
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
                    placeholder="150"
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
                            BP {entry.bloodPressure.systolic || '--'}/{entry.bloodPressure.diastolic || '--'} • HR {entry.heartRate || '--'} • Wt {entry.weight || '--'}
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
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              textAlign: 'center'
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#7a7a7a' }}>
                Trend charts coming soon
              </p>
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