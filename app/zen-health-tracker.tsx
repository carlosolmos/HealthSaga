import React, { useState, useEffect } from 'react';
import { Plus, Check, TrendingUp, Droplet, Pill, Utensils, Activity, Calendar, ChevronRight, ChevronDown } from 'lucide-react';

const ZenHealthTracker = () => {
  const [activeTab, setActiveTab] = useState('today');
  const [todayData, setTodayData] = useState({
    supplements: {
      breakfast: { multivitamin: false, vitaminD: false },
      dinner: { omega3: false, magnesium: false }
    },
    hydration: 0,
    meals: { breakfast: false, lunch: false, dinner: false },
    walks: [],
    morningWater: false
  });

  const [metrics, setMetrics] = useState({
    bloodPressure: { systolic: '', diastolic: '' },
    heartRate: '',
    weight: ''
  });

  const [walkReminders, setWalkReminders] = useState([
    { time: '10:00 AM', label: 'Morning walk', enabled: true },
    { time: '2:00 PM', label: 'Afternoon walk', enabled: true },
    { time: '4:30 PM', label: 'Evening walk', enabled: true }
  ]);

  const [showRecipes, setShowRecipes] = useState(false);

  const [expandedFoodCategory, setExpandedFoodCategory] = useState(null);

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

  const toggleSupplement = (time, id) => {
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

  const toggleWalkReminder = (index) => {
    setWalkReminders(prev => prev.map((reminder, i) => 
      i === index ? { ...reminder, enabled: !reminder.enabled } : reminder
    ));
  };

  const toggleFoodCategory = (category) => {
    setExpandedFoodCategory(expandedFoodCategory === category ? null : category);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(to bottom, #f5f3f0 0%, #e8e6e1 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{ 
        background: 'linear-gradient(135deg, #8b9d83 0%, #6b7c64 100%)',
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
          Your Wellness Journey
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
        {['today', 'meals', 'metrics', 'calendar'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '16px',
              border: 'none',
              background: activeTab === tab ? '#f5f3f0' : 'white',
              color: activeTab === tab ? '#6b7c64' : '#9b9b9b',
              fontSize: '14px',
              fontWeight: activeTab === tab ? '500' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid #8b9d83' : 'none',
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
                <Droplet size={20} color="#7da8a0" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Morning Ritual
                </h3>
              </div>
              <button
                onClick={toggleMorningWater}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: todayData.morningWater ? '2px solid #8b9d83' : '2px solid #e0ddd8',
                  borderRadius: '12px',
                  background: todayData.morningWater ? '#f0f4f0' : 'white',
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
                {todayData.morningWater && <Check size={18} color="#8b9d83" />}
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
                        border: todayData.supplements.breakfast[supp.id] ? '2px solid #8b9d83' : '2px solid #e0ddd8',
                        borderRadius: '12px',
                        background: todayData.supplements.breakfast[supp.id] ? '#f0f4f0' : 'white',
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
                      {todayData.supplements.breakfast[supp.id] && <Check size={18} color="#8b9d83" />}
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
                        border: todayData.supplements.dinner[supp.id] ? '2px solid #8b9d83' : '2px solid #e0ddd8',
                        borderRadius: '12px',
                        background: todayData.supplements.dinner[supp.id] ? '#f0f4f0' : 'white',
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
                      {todayData.supplements.dinner[supp.id] && <Check size={18} color="#8b9d83" />}
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
                <Droplet size={20} color="#7da8a0" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Hydration
                </h3>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#7a7a7a' }}>{todayData.hydration} oz / 60 oz</span>
                  <span style={{ fontSize: '14px', color: '#8b9d83', fontWeight: '500' }}>
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
                    background: 'linear-gradient(90deg, #7da8a0 0%, #8b9d83 100%)',
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
                  background: '#8b9d83',
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
                        background: reminder.enabled ? '#8b9d83' : '#e0ddd8',
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
                    background: '#8b9d83',
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
                            <div style={{ fontSize: '13px', color: '#6b7c64', fontWeight: '500', marginBottom: '6px' }}>Plant Protein</div>
                            <div style={{ fontSize: '13px', color: '#4a5550', lineHeight: '1.6' }}>
                              {foodLists.protein.plant.join(' • ')}
                            </div>
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '13px', color: '#6b7c64', fontWeight: '500', marginBottom: '6px' }}>Animal Protein</div>
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
                          <div style={{ padding: '8px 12px', background: '#e8f0ed', borderRadius: '8px', marginBottom: '12px' }}>
                            <div style={{ fontSize: '12px', color: '#6b7c64', fontStyle: 'italic' }}>
                              {foodLists.veggies.note}
                            </div>
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '13px', color: '#6b7c64', fontWeight: '500', marginBottom: '6px' }}>Try These More Often</div>
                            <div style={{ fontSize: '13px', color: '#4a5550', lineHeight: '1.6' }}>
                              {foodLists.veggies.preferred.join(' • ')}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', color: '#6b7c64', fontWeight: '500', marginBottom: '6px' }}>Good Accessory Veggies</div>
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
                            <div style={{ fontSize: '13px', color: '#6b7c64', fontWeight: '500', marginBottom: '6px' }}>Approved Starches</div>
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
                            <span style={{ fontSize: '12px', color: '#8b9d83', fontWeight: '500' }}>
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
                            <span style={{ fontSize: '12px', color: '#8b9d83', fontWeight: '500' }}>
                              {recipe.protein}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#7a7a7a', marginBottom: '8px' }}>
                            ⏱ {recipe.time}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7c64' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Utensils size={20} color="#a89d7f" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Daily Goals
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ padding: '16px', background: '#f5f3f0', borderRadius: '12px' }}>
                  <div style={{ fontSize: '14px', color: '#7a7a7a', marginBottom: '4px' }}>Protein</div>
                  <div style={{ fontSize: '20px', color: '#4a5550', fontWeight: '500' }}>100g / day</div>
                </div>
                <div style={{ padding: '16px', background: '#f5f3f0', borderRadius: '12px' }}>
                  <div style={{ fontSize: '14px', color: '#7a7a7a', marginBottom: '4px' }}>Fiber</div>
                  <div style={{ fontSize: '20px', color: '#4a5550', fontWeight: '500' }}>30g / day</div>
                </div>
                <div style={{ padding: '16px', background: '#f5f3f0', borderRadius: '12px' }}>
                  <div style={{ fontSize: '14px', color: '#7a7a7a', marginBottom: '4px' }}>Sugar Limit</div>
                  <div style={{ fontSize: '20px', color: '#4a5550', fontWeight: '500' }}>36g / day</div>
                </div>
              </div>
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

            <div style={{ 
              background: 'white', 
              borderRadius: '16px', 
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                Plate Proportions
              </h3>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, padding: '16px', background: '#e8f0ed', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '500', color: '#6b7c64' }}>¼</div>
                  <div style={{ fontSize: '13px', color: '#7a7a7a', marginTop: '4px' }}>Protein</div>
                </div>
                <div style={{ flex: 1, padding: '16px', background: '#e8f0ed', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '500', color: '#6b7c64' }}>½</div>
                  <div style={{ fontSize: '13px', color: '#7a7a7a', marginTop: '4px' }}>Veggies</div>
                </div>
                <div style={{ flex: 1, padding: '16px', background: '#e8f0ed', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '500', color: '#6b7c64' }}>¼</div>
                  <div style={{ fontSize: '13px', color: '#7a7a7a', marginTop: '4px' }}>Starch</div>
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
                <TrendingUp size={20} color="#7da8a0" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Health Metrics
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#7a7a7a', marginBottom: '8px' }}>
                    Blood Pressure
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                      type="number"
                      placeholder="Systolic"
                      value={metrics.bloodPressure.systolic}
                      onChange={(e) => setMetrics(prev => ({
                        ...prev,
                        bloodPressure: { ...prev.bloodPressure, systolic: e.target.value }
                      }))}
                      style={{
                        flex: 1,
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
                        flex: 1,
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
                  style={{
                    width: '100%',
                    padding: '14px',
                    border: 'none',
                    borderRadius: '12px',
                    background: '#8b9d83',
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

        {activeTab === 'calendar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ 
              background: 'white', 
              borderRadius: '16px', 
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Calendar size={20} color="#a89d7f" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#4a5550', fontWeight: '500' }}>
                  Upcoming Tests
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ 
                  padding: '16px', 
                  border: '2px solid #e0ddd8',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>
                      Metabolic Panel III
                    </div>
                    <div style={{ fontSize: '13px', color: '#7a7a7a', marginTop: '4px' }}>
                      DHA Lab - Labcorp
                    </div>
                  </div>
                  <ChevronRight size={18} color="#9b9b9b" />
                </div>

                <div style={{ 
                  padding: '16px', 
                  border: '2px solid #e0ddd8',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>
                      Sleep Apnea Test
                    </div>
                    <div style={{ fontSize: '13px', color: '#7a7a7a', marginTop: '4px' }}>
                      Pending schedule
                    </div>
                  </div>
                  <ChevronRight size={18} color="#9b9b9b" />
                </div>

                <div style={{ 
                  padding: '16px', 
                  border: '2px solid #e0ddd8',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#4a5550', fontWeight: '500' }}>
                      Lab Results Review
                    </div>
                    <div style={{ fontSize: '13px', color: '#7a7a7a', marginTop: '4px' }}>
                      Zoom with Mishan
                    </div>
                  </div>
                  <ChevronRight size={18} color="#9b9b9b" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZenHealthTracker;