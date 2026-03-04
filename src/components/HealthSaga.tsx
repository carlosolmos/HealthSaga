import { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Check, TrendingUp, Droplet, Pill, Utensils, Activity, ChevronRight, ChevronDown, Info, Moon } from 'lucide-react';
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
    weight: '',
    respiratoryRate: ''
  });

  const [metricsHistory, setMetricsHistory] = useLocalStorage<MetricsEntry[]>('healthsaga-metrics-history', []);

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

  const [showRecipes, setShowRecipes] = useState(false);
  const [expandedMealsSection, setExpandedMealsSection] = useState<string | null>(null);
  const [showHydrationTips, setShowHydrationTips] = useState(false);

  const [expandedFoodCategory, setExpandedFoodCategory] = useState<string | null>(null);

  const [expandedDetoxSection, setExpandedDetoxSection] = useState<string | null>(null);
  const [expandedDetoxFood, setExpandedDetoxFood] = useState<string | null>(null);

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
        {['today', 'meals', 'metrics', 'mindfulness', 'detox'].map(tab => (
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

        {activeTab === 'detox' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #6b8f51 0%, #4a7a36 100%)',
              borderRadius: '16px',
              padding: '20px',
              color: 'white'
            }}>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '600', letterSpacing: '0.05em' }}>
                Liver Support Detox
              </h2>
              <p style={{ margin: 0, fontSize: '13px', opacity: 0.85, lineHeight: 1.5 }}>
                Mishan Zia Wellness — Informational reference guide
              </p>
            </div>

            {/* Daily Meal Schedule */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Utensils size={20} color="#6b8f51" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Daily Meal Schedule
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { time: 'Morning', label: 'First Drink', items: ['1 cup hot water', 'Tiny squeeze lemon', 'Tiny pinch salt'] },
                  { time: '8 am', label: 'Breakfast Shake', items: ['1 scoop Mediclear', '2 cups water', 'Berries'] },
                  { time: '11 am', label: 'Lunch', items: ['Follow food list', 'Follow plate guide'] },
                  { time: '3 pm', label: 'Shake (optional)', items: ['1 scoop Mediclear', '2 cups water', '½–1 cup berries optional'] },
                  { time: '6 pm', label: 'Dinner', items: ['Follow food list', 'Follow plate guide'] }
                ].map(meal => (
                  <div key={meal.time} style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '12px',
                    background: '#f5f3f0',
                    borderRadius: '12px',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{ minWidth: '60px' }}>
                      <div style={{ fontSize: '11px', color: '#6b8f51', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {meal.time}
                      </div>
                      <div style={{ fontSize: '13px', color: '#4a5550', fontWeight: '500', marginTop: '2px' }}>
                        {meal.label}
                      </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {meal.items.map(item => (
                        <span key={item} style={{
                          fontSize: '12px',
                          color: '#5a5a5a',
                          background: 'white',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          border: '1px solid #e0ddd8'
                        }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Details notes */}
              <div style={{
                marginTop: '16px',
                padding: '14px',
                background: '#f0f6ec',
                borderRadius: '12px',
                borderLeft: '3px solid #6b8f51'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#4a7a36', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    'Breakfast smoothie = berries + water or unsweetened almond/macadamia milk + 1 scoop Mediclear',
                    'Afternoon shake is optional — extra liver support + hydration',
                    'Protein: use plant protein for one meal + animal for the other (not both animal)',
                    'Starch at dinner is very important — helps lower stress hormone + deepen sleep',
                    'Starch at lunch is optional; include it if hungry between meals'
                  ].map(note => (
                    <div key={note} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ color: '#6b8f51', fontSize: '12px', marginTop: '1px', flexShrink: 0 }}>•</span>
                      <span style={{ fontSize: '12px', color: '#4a5550', lineHeight: 1.5 }}>{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Plate Proportions */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                Detox Plate Proportions
              </h3>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <svg width="160" height="120" viewBox="0 0 160 120" role="img" aria-label="Detox plate: half non-starch veggies, quarter protein, quarter starch">
                  <rect x="2" y="2" width="156" height="116" rx="14" fill="#ffffff" stroke="#e0ddd8" strokeWidth="4" />
                  <rect x="6" y="6" width="74" height="108" rx="10" fill="#3c9d6b" />
                  <rect x="82" y="6" width="72" height="52" rx="10" fill="#e07a5f" />
                  <rect x="82" y="62" width="72" height="52" rx="10" fill="#3d7a8a" />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '12px', height: '12px', background: '#3c9d6b', borderRadius: '50%', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: '#7a7a7a' }}>½ Non-Starch Veggies</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '12px', height: '12px', background: '#e07a5f', borderRadius: '50%', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: '#7a7a7a' }}>¼ Protein</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '12px', height: '12px', background: '#3d7a8a', borderRadius: '50%', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: '#7a7a7a' }}>¼ Healthy Starch</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Approved Detox Foods */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <button
                onClick={() => setExpandedDetoxSection(expandedDetoxSection === 'foods' ? null : 'foods')}
                style={{
                  width: '100%', padding: '0', border: 'none', background: 'transparent',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Utensils size={20} color="#6b8f51" />
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                    Approved Detox Foods
                  </h3>
                </div>
                <ChevronDown size={18} color="#7a7a7a" style={{
                  transform: expandedDetoxSection === 'foods' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }} />
              </button>

              {expandedDetoxSection === 'foods' && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    {
                      key: 'plantProtein',
                      label: 'Plant Protein',
                      color: '#3c9d6b',
                      items: ['Beans (all types)', 'Lentils', 'Chickpeas', 'Split peas', 'Quinoa', 'Hemp hearts', 'Pea, pumpkin, or hemp powder', 'Organic sprouted tofu', 'Organic tempeh', 'Organic natto'],
                      note: 'No canned baked beans'
                    },
                    {
                      key: 'animalProtein',
                      label: 'Animal Protein',
                      color: '#e07a5f',
                      items: ['Fish (from low mercury list)', 'Sardines', 'Anchovies', 'Shrimp', 'Scallops', 'Chicken', 'Turkey', 'Duck', 'Cornish hen', 'Beef'],
                      note: 'All beef = 100% grass-fed · Chicken/pork/lamb = pasture-raised'
                    },
                    {
                      key: 'starch',
                      label: 'Healthy Starch (¼ plate)',
                      color: '#3d7a8a',
                      items: ['Sweet potatoes / yams', 'Squashes', 'Regular potatoes', 'Carrots', 'Beets', 'Plantains', 'Turnips, parsnips, yucca'],
                      note: null
                    },
                    {
                      key: 'veggies',
                      label: 'Non-Starch Veggies (½ plate)',
                      color: '#3c9d6b',
                      items: ['Broccoli', 'Brussels sprouts', 'Lettuce', 'Arugula / baby greens', 'Mustard / collard greens', 'Bok choy', 'Kale, chard', 'Cabbage', 'Asparagus', 'Cauliflower', 'Bell peppers', 'Sprouts', 'Green beans', 'Green peas'],
                      note: 'Accessory veggies: artichoke, tomatoes, cucumber, celery, zucchini · No eggplant'
                    },
                    {
                      key: 'fats',
                      label: 'Fats',
                      color: '#a89d7f',
                      items: ['Avocado', 'Avocado oil', 'Olives', 'Olive oil', 'Chia seeds', 'Flax seeds'],
                      note: null
                    },
                    {
                      key: 'fruits',
                      label: 'Fruits (smoothies only)',
                      color: '#7b5ea7',
                      items: ['Blueberries', 'Raspberries', 'Blackberries', 'Cherries'],
                      note: 'Frozen is ok · Use in breakfast shake and optional afternoon shake'
                    }
                  ].map(category => (
                    <div key={category.key}>
                      <button
                        onClick={() => setExpandedDetoxFood(expandedDetoxFood === category.key ? null : category.key)}
                        style={{
                          width: '100%', padding: '12px', border: '2px solid #e0ddd8', borderRadius: '12px',
                          background: expandedDetoxFood === category.key ? '#f5f3f0' : 'white',
                          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '10px', height: '10px', background: category.color, borderRadius: '50%', flexShrink: 0 }} />
                          <span style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>{category.label}</span>
                        </div>
                        <ChevronDown size={18} color="#7a7a7a" style={{
                          transform: expandedDetoxFood === category.key ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.3s ease'
                        }} />
                      </button>
                      {expandedDetoxFood === category.key && (
                        <div style={{
                          padding: '12px 14px',
                          background: '#fafaf8',
                          border: '1px solid #e0ddd8',
                          borderTop: 'none',
                          borderRadius: '0 0 12px 12px'
                        }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: category.note ? '10px' : '0' }}>
                            {category.items.map(item => (
                              <span key={item} style={{
                                fontSize: '12px',
                                color: '#4a5550',
                                background: 'white',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                border: `1px solid ${category.color}40`
                              }}>
                                {item}
                              </span>
                            ))}
                          </div>
                          {category.note && (
                            <div style={{
                              fontSize: '11px',
                              color: '#8a7a6a',
                              fontStyle: 'italic',
                              paddingTop: category.items.length > 0 ? '6px' : '0',
                              borderTop: '1px solid #e8e6e1'
                            }}>
                              {category.note}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Healthy Mindset */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <button
                onClick={() => setExpandedDetoxSection(expandedDetoxSection === 'mindset' ? null : 'mindset')}
                style={{
                  width: '100%', padding: '0', border: 'none', background: 'transparent',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Info size={20} color="#6b8f51" />
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                    Healthy Mindset
                  </h3>
                </div>
                <ChevronDown size={18} color="#7a7a7a" style={{
                  transform: expandedDetoxSection === 'mindset' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }} />
              </button>
              {expandedDetoxSection === 'mindset' && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ padding: '12px', background: '#f5f3f0', borderRadius: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#4a7a36', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Basic food principles
                    </div>
                    {[
                      'Do not eat fruit (berries) 30 min before or 1 hour after meals (excludes smoothie)',
                      'Do not drink large amounts, cold, or carbonated liquids 30 min before or 1 hour after meals',
                      'Chew slowly and thoroughly',
                      'Lunch can be raw veggies (easier digestion mid-day) or cooked',
                      'Dinner should be more cooked veggies'
                    ].map(rule => (
                      <div key={rule} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span style={{ color: '#6b8f51', fontSize: '12px', marginTop: '1px', flexShrink: 0 }}>•</span>
                        <span style={{ fontSize: '13px', color: '#4a5550', lineHeight: 1.5 }}>{rule}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '12px', background: '#f5f3f0', borderRadius: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#4a7a36', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Half your plate must be non-starch veggies
                    </div>
                    {[
                      'Do not limit your plate — eat until you feel satiated',
                      'Always add more veggies if you feel hungry at that meal',
                      'Do not measure calories'
                    ].map(rule => (
                      <div key={rule} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span style={{ color: '#6b8f51', fontSize: '12px', marginTop: '1px', flexShrink: 0 }}>•</span>
                        <span style={{ fontSize: '13px', color: '#4a5550', lineHeight: 1.5 }}>{rule}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Important Notes — 4 expandable sub-sections */}
            {[
              {
                key: 'hydration',
                icon: <Droplet size={20} color="#6b8f51" />,
                title: 'Help Your Body Detox',
                groups: [
                  {
                    label: 'Hydration',
                    items: [
                      'Aim for 8–10 cups fluids daily',
                      'Includes smoothie and herbal teas',
                      'Good herbal teas: mint, ginger, chamomile'
                    ]
                  },
                  {
                    label: 'Sweating',
                    items: [
                      'Try to do very light exercise to sweat a little daily',
                      'Dry or infrared sauna is a great idea if available'
                    ]
                  }
                ]
              },
              {
                key: 'rest',
                icon: <Moon size={20} color="#6b8f51" />,
                title: 'Rest + Exercise',
                groups: [
                  {
                    label: 'Rest',
                    items: [
                      'Try to sleep by 10pm to give liver more detox time',
                      'If you feel tired in the first couple days, listen to your body and rest',
                      'If you feel more energy during detox — still rest; do not use that energy for more activities'
                    ]
                  },
                  {
                    label: 'Exercise',
                    items: [
                      'Walking or very light exercise only',
                      'Do not do high intensity workouts during detox'
                    ]
                  }
                ]
              },
              {
                key: 'supplements',
                icon: <Pill size={20} color="#6b8f51" />,
                title: 'Medications + Supplements',
                groups: [
                  {
                    label: 'Medications',
                    items: [
                      'Stay on all your prescription medications',
                      'May need to check with your doctor for contraindications'
                    ]
                  },
                  {
                    label: 'Supplements',
                    items: [
                      'Mediclear powder = multivitamin + protein',
                      'During detox: pause your regular multivitamin',
                      'If you dislike the taste: add 1 tsp raw cacao powder'
                    ]
                  }
                ]
              },
              {
                key: 'foodDrink',
                icon: <Info size={20} color="#6b8f51" />,
                title: 'Food + Drink Rules',
                groups: [
                  {
                    label: 'What to use',
                    items: [
                      'Use any spices you love',
                      'Use clean salt'
                    ]
                  },
                  {
                    label: 'Avoid',
                    items: [
                      'Sugar or sweeteners',
                      'Vinegar (try to avoid)',
                      'Caffeinated drinks (try to avoid)',
                      'Carbonated drinks',
                      'Alcohol',
                      'Gum with sugar'
                    ]
                  }
                ]
              }
            ].map(section => (
              <div key={section.key} style={{
                background: 'white',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}>
                <button
                  onClick={() => setExpandedDetoxSection(expandedDetoxSection === section.key ? null : section.key)}
                  style={{
                    width: '100%', padding: '0', border: 'none', background: 'transparent',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {section.icon}
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                      {section.title}
                    </h3>
                  </div>
                  <ChevronDown size={18} color="#7a7a7a" style={{
                    transform: expandedDetoxSection === section.key ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease'
                  }} />
                </button>
                {expandedDetoxSection === section.key && (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {section.groups.map(group => (
                      <div key={group.label} style={{ padding: '12px', background: '#f5f3f0', borderRadius: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#4a7a36', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {group.label}
                        </div>
                        {group.items.map(item => (
                          <div key={item} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <span style={{ color: '#6b8f51', fontSize: '12px', marginTop: '1px', flexShrink: 0 }}>•</span>
                            <span style={{ fontSize: '13px', color: '#4a5550', lineHeight: 1.5 }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Possible Symptoms */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <button
                onClick={() => setExpandedDetoxSection(expandedDetoxSection === 'symptoms' ? null : 'symptoms')}
                style={{
                  width: '100%', padding: '0', border: 'none', background: 'transparent',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Activity size={20} color="#6b8f51" />
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                    Possible Symptoms During Detox
                  </h3>
                </div>
                <ChevronDown size={18} color="#7a7a7a" style={{
                  transform: expandedDetoxSection === 'symptoms' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }} />
              </button>
              {expandedDetoxSection === 'symptoms' && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px', padding: '12px', background: '#f5f3f0', borderRadius: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#4a7a36', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Possible symptoms
                      </div>
                      {['Low energy', 'Low mood', 'Headache', 'Nausea', 'Skin breakouts', 'Irregular bowel movements'].map(s => (
                        <div key={s} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ color: '#6b8f51', fontSize: '12px', flexShrink: 0 }}>•</span>
                          <span style={{ fontSize: '13px', color: '#4a5550' }}>{s}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1, minWidth: '200px', padding: '12px', background: '#f5f3f0', borderRadius: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#4a7a36', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Toxins leave through
                      </div>
                      {['Stool', 'Urine', 'Skin', 'Lungs'].map(s => (
                        <div key={s} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ color: '#6b8f51', fontSize: '12px', flexShrink: 0 }}>•</span>
                          <span style={{ fontSize: '13px', color: '#4a5550' }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#f0f6ec', borderRadius: '12px', borderLeft: '3px solid #6b8f51' }}>
                    <div style={{ fontSize: '13px', color: '#4a5550', lineHeight: 1.6 }}>
                      These are called <strong>Herxheimer reactions</strong> — signs that your body is eliminating stored toxins through all available pathways. Most common in days 1–2 and should resolve by day 3. Do not take medications to relieve them; instead follow the hydration and rest guidelines.
                    </div>
                    <div style={{ fontSize: '12px', color: '#c0392b', marginTop: '8px', fontStyle: 'italic' }}>
                      If symptoms are severe or last past day 3, discontinue the detox and contact your practitioner.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Responsible Use */}
            <div style={{
              padding: '16px 20px',
              background: '#f5f3f0',
              borderRadius: '14px',
              borderLeft: '3px solid #a89d7f'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#7a6a5a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Be responsible with your health
              </div>
              {[
                'This detox is not a gut or intestinal cleanse and does not replace any protocol to address underlying imbalances.',
                'This detox must never replace your regular healthy nutrition plan.',
                'Can be done for 3 weeks initially, then only 1 week every 3–4 months — not more often than that.'
              ].map((note, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <span style={{ color: '#a89d7f', fontSize: '12px', flexShrink: 0, marginTop: '1px' }}>{i + 1}.</span>
                  <span style={{ fontSize: '12px', color: '#6b5d4f', lineHeight: 1.5 }}>{note}</span>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default HealthSaga;