# 🍳 Recipe Progression Logic & Assembly Rules

## Overview
Ito yung proper order ng steps para sa bawat dish. Dapat sundin yung sequence para gumana ng tama.

---

## 🍔 1. BURGER (30 pts)
**Ingredients:** Bread, Meat, Lettuce, Tomato

### Proper Assembly Sequence:
1. **Get Plate** from Plates Station
2. **Meat Processing:**
   - Get Meat from Crate
   - Chop Meat at Chopping Board (4.5s)
   - Cook Chopped Meat at Stove (5s)
   - Add to Plate
3. **Lettuce Processing:**
   - Get Lettuce from Crate
   - Chop Lettuce at Chopping Board (2.5s)
   - Add to Plate (no cooking needed)
4. **Tomato Processing:**
   - Get Tomato from Crate
   - Chop Tomato at Chopping Board (2.5s)
   - Add to Plate (no cooking needed)
5. **Bread:**
   - Get Bread from Crate
   - Add to Plate (no processing needed)
6. **Serve** at Serving Station

### Current Issues to Fix:
- ❌ Can cook meat without chopping first
- ❌ Can add ingredients to plate without proper processing
- ❌ No validation if meat is cooked before serving

### Required Validation Rules:
```
✅ Meat MUST be chopped before cooking
✅ Meat MUST be cooked after chopping
✅ Lettuce MUST be chopped before adding to plate
✅ Tomato MUST be chopped before adding to plate
✅ Bread needs no processing
✅ ALL ingredients must be on plate before serving
```

---

## 🥗 2. SALAD (20 pts)
**Ingredients:** Lettuce, Tomato, Onion

### Proper Assembly Sequence:
1. **Get Plate** from Plates Station
2. **Lettuce Processing:**
   - Get Lettuce from Crate
   - Chop Lettuce at Chopping Board (2.5s)
   - Add to Plate
3. **Tomato Processing:**
   - Get Tomato from Crate
   - Chop Tomato at Chopping Board (2.5s)
   - Add to Plate
4. **Onion Processing:**
   - Get Onion from Crate
   - Chop Onion at Chopping Board (2.5s)
   - Add to Plate
5. **Serve** at Serving Station

### Current Issues to Fix:
- ❌ Can add unchopped vegetables to plate

### Required Validation Rules:
```
✅ Lettuce MUST be chopped before adding to plate
✅ Tomato MUST be chopped before adding to plate
✅ Onion MUST be chopped before adding to plate
✅ NO cooking required (raw salad)
✅ ALL ingredients must be on plate before serving
```

---

## 🍣 3. SUSHI (35 pts)
**Ingredients:** Rice, Fish

### Proper Assembly Sequence:
1. **Get Plate** from Plates Station
2. **Rice Processing:**
   - Get Rice from Crate
   - Wash Rice at Sink (2s)
   - Cook Washed Rice at Stove (4s)
   - Add to Plate
3. **Fish Processing:**
   - Get Fish from Crate
   - Chop Fish at Chopping Board (2.5s)
   - Add to Plate (no cooking needed - raw fish)
4. **Serve** at Serving Station

### Current Issues to Fix:
- ❌ Can cook rice without washing first
- ❌ Can add unwashed rice to plate
- ❌ Can add unchopped fish to plate

### Required Validation Rules:
```
✅ Rice MUST be washed at Sink before cooking
✅ Rice MUST be cooked after washing
✅ Fish MUST be chopped before adding to plate
✅ Fish should NOT be cooked (raw fish for sushi)
✅ ALL ingredients must be on plate before serving
```

---

## 🍕 4. PIZZA (50 pts) - MOST COMPLEX
**Ingredients:** Dough, Tomato, Cheese

### Proper Assembly Sequence:
1. **Get Plate** from Plates Station
2. **Dough Processing:**
   - Get Dough from Crate
   - Roll Dough at Roller Station (3s)
   - Add Rolled Dough to Plate
3. **Tomato Processing:**
   - Get Tomato from Crate
   - Chop Tomato at Chopping Board (2.5s)
   - Add to Plate (on top of dough)
4. **Cheese:**
   - Get Cheese from Crate
   - Chop Cheese at Chopping Board (1.5s)
   - Add to Plate
5. **Cook Complete Pizza:**
   - Take Plate with all ingredients
   - Cook in Oven (8s) - cooks the dough base
6. **Serve** at Serving Station

### Current Issues to Fix:
- ❌ Can cook dough without rolling first
- ❌ Can add unrolled dough to plate
- ❌ Can cook individual ingredients instead of complete pizza
- ❌ Dough should only go to OVEN, not STOVE

### Required Validation Rules:
```
✅ Dough MUST be rolled at Roller before adding to plate
✅ Tomato MUST be chopped before adding to plate
✅ Cheese MUST be chopped before adding to plate
✅ ALL ingredients must be on plate BEFORE cooking
✅ Complete plate MUST be cooked in OVEN (not stove)
✅ Dough is cooked via the oven (cooking the whole pizza)
✅ Cannot cook dough alone - must be assembled pizza
```

---

## 🍲 5. SOUP (35 pts)
**Ingredients:** Tomato, Onion, Mushroom

### Proper Assembly Sequence:
1. **Get Plate** from Plates Station
2. **Tomato Processing:**
   - Get Tomato from Crate
   - Chop Tomato at Chopping Board (2.5s)
   - Add to Plate
3. **Onion Processing:**
   - Get Onion from Crate
   - Chop Onion at Chopping Board (2.5s)
   - Add to Plate
4. **Mushroom Processing:**
   - Get Mushroom from Crate
   - Chop Mushroom at Chopping Board (2.5s)
   - Add to Plate
5. **Cook Complete Soup:**
   - Take Plate with all chopped ingredients
   - Cook at Stove (7s) - cooks all together
6. **Serve** at Serving Station

### Current Issues to Fix:
- ❌ Can cook ingredients individually instead of together
- ❌ Can add unchopped vegetables to plate

### Required Validation Rules:
```
✅ Tomato MUST be chopped before adding to plate
✅ Onion MUST be chopped before adding to plate
✅ Mushroom MUST be chopped before adding to plate
✅ ALL ingredients must be on plate BEFORE cooking
✅ Complete plate MUST be cooked at Stove (all together)
✅ Cannot cook individual vegetables - must be complete soup
```

---

## 🍳 6. OMELETTE (25 pts)
**Ingredients:** Egg, Cheese, Mushroom

### Proper Assembly Sequence:
1. **Get Plate** from Plates Station
2. **Egg Processing:**
   - Get Egg from Crate
   - Add to Plate (no chopping needed)
3. **Cheese:**
   - Get Cheese from Crate
   - Add to Plate (no chopping needed for omelette)
4. **Mushroom Processing:**
   - Get Mushroom from Crate
   - Chop Mushroom at Chopping Board (2.5s)
   - Add to Plate
5. **Cook Complete Omelette:**
   - Take Plate with all ingredients
   - Cook at Stove (4s) - cooks the egg
6. **Serve** at Serving Station

### Current Issues to Fix:
- ❌ Can cook egg without other ingredients
- ❌ Can add unchopped mushroom to plate

### Required Validation Rules:
```
✅ Egg needs no chopping
✅ Cheese needs no chopping for omelette
✅ Mushroom MUST be chopped before adding to plate
✅ ALL ingredients must be on plate BEFORE cooking
✅ Complete plate MUST be cooked at Stove (egg cooks everything)
✅ Cannot cook egg alone - must be complete omelette
```

---

## 🥩🍄 7. STEAK & MUSHROOM (45 pts)
**Ingredients:** Meat, Mushroom, Onion

### Proper Assembly Sequence:
1. **Get Plate** from Plates Station
2. **Meat Processing:**
   - Get Meat from Crate
   - Chop Meat at Chopping Board (4.5s)
   - Add to Plate
3. **Mushroom Processing:**
   - Get Mushroom from Crate
   - Chop Mushroom at Chopping Board (2.5s)
   - Add to Plate
4. **Onion Processing:**
   - Get Onion from Crate
   - Chop Onion at Chopping Board (2.5s)
   - Add to Plate
5. **Cook Complete Dish:**
   - Take Plate with all chopped ingredients
   - Cook at Stove (6s) - cooks all together
6. **Serve** at Serving Station

### Current Issues to Fix:
- ❌ Can cook ingredients individually
- ❌ Can add unchopped ingredients to plate

### Required Validation Rules:
```
✅ Meat MUST be chopped before adding to plate
✅ Mushroom MUST be chopped before adding to plate
✅ Onion MUST be chopped before adding to plate
✅ ALL ingredients must be on plate BEFORE cooking
✅ Complete plate MUST be cooked at Stove (all together)
✅ Cannot cook individual ingredients - must be complete dish
```

---

## 🌮 8. FISH TACOS (40 pts)
**Ingredients:** Fish, Lettuce, Tomato, Bread

### Proper Assembly Sequence:
1. **Get Plate** from Plates Station
2. **Fish Processing:**
   - Get Fish from Crate
   - Chop Fish at Chopping Board (2.5s)
   - Cook Chopped Fish at Stove (5s)
   - Add to Plate
3. **Lettuce Processing:**
   - Get Lettuce from Crate
   - Chop Lettuce at Chopping Board (2.5s)
   - Add to Plate (no cooking)
4. **Tomato Processing:**
   - Get Tomato from Crate
   - Chop Tomato at Chopping Board (2.5s)
   - Add to Plate (no cooking)
5. **Bread:**
   - Get Bread from Crate
   - Add to Plate (no processing)
6. **Serve** at Serving Station

### Current Issues to Fix:
- ❌ Can cook fish without chopping first
- ❌ Can add unchopped vegetables to plate

### Required Validation Rules:
```
✅ Fish MUST be chopped before cooking
✅ Fish MUST be cooked after chopping
✅ Lettuce MUST be chopped before adding to plate
✅ Tomato MUST be chopped before adding to plate
✅ Bread needs no processing
✅ ALL ingredients must be on plate before serving
```

---

## 🚨 CRITICAL VALIDATION RULES TO IMPLEMENT

### 1. Chopping Board Rules
```javascript
// Can only place items that need chopping
// Can only pick up items that are fully chopped
// Cannot cook items that need chopping without chopping first
```

### 2. Stove Rules
```javascript
// Cannot place items that need chopping but aren't chopped
// Cannot place bread (doesn't need cooking)
// Cannot place dough (should go to oven)
// Cannot place lettuce (doesn't need cooking)
// Rice must be washed before cooking
```

### 3. Oven Rules
```javascript
// Only accepts dough or plates with dough
// Dough must be rolled before going to oven
// Pizza must be fully assembled before cooking
```

### 4. Roller Rules
```javascript
// Only accepts dough
// Dough must be rolled before adding to plate
```

### 5. Sink Rules
```javascript
// Only accepts rice
// Rice must be washed before cooking
```

### 6. Plate Assembly Rules
```javascript
// Cannot add unchopped items that require chopping
// Cannot add uncooked items that require cooking (except for assembly dishes)
// For assembly dishes (soup, omelette, pizza, steak), all items go on plate THEN cook
// For individual cook items (burger meat, fish), cook THEN add to plate
```

### 7. Serving Rules
```javascript
// Must have ALL required ingredients
// All ingredients must be properly processed (chopped/cooked/washed/rolled)
// Plate must not be burnt
```

---

## 📋 IMPLEMENTATION PRIORITY

### Phase 1: Basic Validation (CRITICAL)
1. ✅ Prevent cooking items that need chopping without chopping first
2. ✅ Prevent adding unchopped items to plate when chopping is required
3. ✅ Prevent cooking rice without washing first
4. ✅ Prevent rolling dough without using roller first

### Phase 2: Station-Specific Rules
1. ✅ Stove: Block bread, lettuce, dough, unwashed rice
2. ✅ Oven: Only accept dough-based items
3. ✅ Roller: Only accept dough
4. ✅ Sink: Only accept rice

### Phase 3: Assembly Logic
1. ✅ Dishes that cook together (soup, omelette, steak, pizza)
2. ✅ Dishes that cook individually then assemble (burger, tacos)
3. ✅ Dishes with no cooking (salad)
4. ✅ Dishes with special processing (sushi - wash rice, pizza - roll dough)

### Phase 4: Error Messages
1. ✅ Clear feedback when player tries invalid action
2. ✅ Hints on what to do next
3. ✅ Visual indicators for required steps

---

## 🎯 SUMMARY OF DISH TYPES

### Type A: Individual Cook Then Assemble
- **Burger** - Cook meat separately, then assemble
- **Fish Tacos** - Cook fish separately, then assemble

### Type B: Assemble Then Cook Together
- **Soup** - All chopped ingredients on plate, cook together
- **Omelette** - All ingredients on plate, cook together
- **Steak & Mushroom** - All chopped ingredients on plate, cook together
- **Pizza** - All ingredients on plate, cook in oven

### Type C: No Cooking Required
- **Salad** - Just chop and assemble

### Type D: Special Processing
- **Sushi** - Wash rice, cook rice, chop fish (no cook fish)
- **Pizza** - Roll dough, assemble, cook in oven

