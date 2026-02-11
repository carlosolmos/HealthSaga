// Nutritional reference data extracted from design infographics

export const proteinPortions = {
  goal: 'At least 100 G / day',
  calculation: '0.8 - 1 gram x lb body weight / day',
  example: 'ex: 130 lbs = at least 100g / day',
  animal: [
    { food: 'Beef', amount: '3 oz', protein: '25g' },
    { food: 'Chicken / Turkey', amount: '3 oz', protein: '25g' },
    { food: 'Cottage Cheese', amount: '1 cup', protein: '24g' },
    { food: 'Pork / Lamb', amount: '3 oz', protein: '22g' },
    { food: 'Fish', amount: '3 oz', protein: '22g' },
    { food: 'Shrimp', amount: '3 oz', protein: '20g' },
    { food: 'Greek Yogurt', amount: '1 cup', protein: '16g' },
    { food: 'Goat Yogurt', amount: '1 cup', protein: '9g' },
    { food: 'Kefir', amount: '1 cup', protein: '9g' },
    { food: 'Egg', amount: '1', protein: '6g' },
    { food: 'Feta Cheese', amount: '1 oz', protein: '4g' },
  ],
  plant: [
    { food: 'Natto', amount: '1 cup', protein: '34g' },
    { food: 'Tofu', amount: '1 block', protein: '20g' },
    { food: 'Lentils / Adzuki', amount: '1 cup', protein: '18g' },
    { food: 'Edamame', amount: '1 cup', protein: '16g' },
    { food: 'Other Beans', amount: '1 cup', protein: '15g' },
    { food: 'Chia Seeds', amount: '2 tbsp', protein: '8g' },
    { food: 'Quinoa', amount: '1 cup', protein: '8g' },
    { food: 'Hemp Seeds', amount: '2 tbsp', protein: '6g' },
    { food: 'Steel Cut Oats', amount: '1 cup', protein: '6g' },
    { food: 'Pumpkin Seeds', amount: '2 tbsp', protein: '5g' },
    { food: 'Mushrooms', amount: '1 cup', protein: '3g' },
  ]
};

export const fiberGuide = {
  goal: '30 G / day',
  gradualIncrease: [
    'Add 5g per day',
    'Stay at this daily amount for 1 week',
    'Example: if your average is 10g/day, then increase to 15g/day, stay here for 1 week',
    'For that week, observe your bowel movements (BM)',
    'If BMs decrease: continue at that level for another week, then reassess',
    'If BMs increase = great: next week add 5g more/day, stay at this new level for 1 week',
    'Continue until you reach 30g/day average',
    'If you have more fiber, that\'s great',
    'Just be sure you have at least 1 BM/day'
  ],
  topFoods: [
    { food: 'Pinto / Lentils', amount: '1 cup', fiber: '15g' },
    { food: 'Garbanzos', amount: '1 cup', fiber: '13g' },
    { food: 'Avocado', amount: '1 med', fiber: '12g' },
    { food: 'Chia Seeds', amount: '2 tbsp', fiber: '8g' },
    { food: 'Edamame', amount: '1 cup', fiber: '8g' },
    { food: 'Rasp / Blackberries', amount: '1 cup', fiber: '8g' },
    { food: 'Artichoke', amount: '1 med', fiber: '6g' },
    { food: 'Quinoa', amount: '1 cup', fiber: '5g' },
    { food: 'Blueberries', amount: '1 cup', fiber: '4g' },
    { food: 'Most Fruits or Veggies', amount: '1 cup', fiber: '2-4g' },
    { food: 'Animal-Based Foods', amount: 'any', fiber: '0g' },
  ],
  gutHealthBenefits: [
    'Metabolism (weight)',
    'Mood (emotions + brain health)',
    'Cardiovascular system (heart health)',
    'Immune system (first line defenses)'
  ]
};

export const weeklyRotation = {
  protein: {
    dailyTip: 'For lunch: choose plant protein. For dinner: choose animal or plant protein.',
    weeklyDistribution: [
      '2-3 days = beef / pork / lamb',
      '2-3 days = chicken / turkey',
      '3+ days = fish (from low-mercury list)'
    ],
    plantWeekly: [
      '3+ days = tofu',
      '3+ days = beans'
    ]
  },
  starch: {
    dailyTip: 'For lunch: can exclude starch or depends on needs. For dinner: always include starch (for sleep, stress).',
    weeklyDistribution: [
      '3+ days = sweet potato / yam / squash',
      '2+ days = rice or regular potatoes',
      '2 days or less = pasta or bread'
    ]
  }
};

export const sugarGuide = {
  dailyLimit: '36 grams / day (for men)',
  equivalentTeaspoons: '9 teaspoons',
  howToCalculate: [
    '36 grams = "added sugar" grams or "total sugar" grams (liquids)',
    'All sugars are equal — no matter whether brown / cane / coconut',
    'On nutrition label for solid foods: grams of "added sugar"',
    'On nutrition label for liquids: grams of "total sugars"',
    'On ingredients list of processed foods: there are 50+ alternative names for sugar'
  ],
  healthierSugars: [
    'Raw local honey', 'Organic maple syrup', 'Organic cane sugar',
    'Organic brown sugar', 'Dates', 'Stevia', 'Monk fruit'
  ],
  sugarsToAvoid: [
    'Agave', 'Fake honey', 'Bleached sugar',
    'All artificial sweeteners',
    'Aspartame (NutraSweet, Equal, Benevia)',
    'Sucralose (Splenda)',
    'Saccharin (Sweet \'N Low)',
    'Sugar alcohols (erythritol, xylitol, sorbitol)'
  ],
  liquidSugarsToAvoid: [
    { drink: '1 can soda (12 oz)', sugar: '37g' },
    { drink: '1 cup pomegranate juice', sugar: '31g' },
    { drink: '1 cup apple juice', sugar: '24g' },
    { drink: '1 cup orange juice', sugar: '21g' },
    { drink: '1 cup gatorade', sugar: '13g' },
  ],
  liquidTip: 'Check the "total sugars" on any juice! Eat the fruit instead.'
};

export const hydrationGuide = {
  dailyNeeds: '½ body wt in lbs = oz / day (ex: 120 lbs = 60 oz = 8 cups). Includes ALL liquids.',
  timingSchedule: [
    { time: 'On waking', instruction: '1 big mug: hot water + touch of lemon + salt' },
    { time: 'After breakfast', instruction: '1 cup: hot drink after breakfast' },
    { time: 'Mid-morning', instruction: '1-2 cups: between breakfast + lunch' },
    { time: 'After lunch', instruction: '1 cup: hot herbal tea after lunch' },
    { time: 'Afternoon', instruction: '1-2 cups: between lunch + dinner' },
    { time: 'After dinner', instruction: '1 cup: hot herbal tea after dinner' },
  ],
  rules: [
    'Never drink large amounts of plain water',
    'Add a touch of salt (electrolytes) or cut / frozen fruit',
    'Avoid cold or large amounts or carbonated drinks with meals',
    'Hot drink helps with digestion post-meal',
    'Avoid all plastic liquid containers: water bottles, to-go cups and bottles',
    'Stop caffeinated drinks by 11am',
    'Stop all liquids 3 hours before sleep time'
  ]
};
