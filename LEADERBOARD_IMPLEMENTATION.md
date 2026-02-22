# Leaderboard System Implementation

## Overview
Nag-implement ng leaderboard system para sa registered users with real-time rankings at filtering options.

## Features Implemented

### 1. Backend API (server.js)
- **Endpoint**: `GET /api/leaderboard`
- **Query Parameters**:
  - `category`: 'score' (default), 'wins', 'dishes'
  - `limit`: number of top players (default: 100)
- **Filters**: Registered users only (guests excluded)
- **Sorting**: Based on selected category

### 2. Leaderboard Panel (Left Side of Main Menu)
Located sa left side ng main menu, katulad ng friends panel sa right side.

**Features**:
- Top 10 players display
- Real-time filtering with 3 categories:
  1. **Total Score** - Cumulative points from all games
  2. **Dishes Cooked** - Total dishes served
  3. **VS Wins** - Wins in competitive battles

**Visual Elements**:
- Rank badges (1-10)
- Special styling for top 3:
  - 🥇 Rank 1: Gold (#FFD700)
  - 🥈 Rank 2: Silver (#C0C0C0)
  - 🥉 Rank 3: Bronze (#CD7F32)
- Player avatars
- Username display
- Category-specific stats

### 3. UI Components

**HTML Structure** (public/index.html):
```html
<div class="leaderboard-panel">
  <div class="leaderboard-panel-header">
    <i class="bi bi-trophy-fill"></i> Top Chefs
  </div>
  <div class="leaderboard-panel-filters">
    <!-- 3 filter buttons -->
  </div>
  <div class="leaderboard-panel-list">
    <!-- Leaderboard items -->
  </div>
</div>
```

**CSS Styling** (public/css/style.css):
- Panel width: 220px (matches friends panel)
- Max height: 450px with scrolling
- Responsive design for mobile
- Hover effects and transitions
- Special rank colors for top 3

**JavaScript Functions** (public/js/game.js):
- `switchMainLeaderboardCategory(category, btn)` - Filter switching
- `fetchMainLeaderboard()` - API call and rendering
- Auto-loads on user login

## Data Flow

1. **User Login** → Triggers `fetchMainLeaderboard()`
2. **API Call** → `GET /api/leaderboard?category=score&limit=10`
3. **Server Processing**:
   - Filters registered users only
   - Sorts by selected category
   - Returns top N players
4. **Client Rendering**:
   - Displays ranked list
   - Applies special styling for top 3
   - Shows category-specific stats

## Category Metrics

### Total Score
- Tracks: `stats.scoreTotal`
- Display: "X pts"
- Best for: Overall performance

### Dishes Cooked
- Tracks: `stats.dishesServed`
- Display: "X dishes"
- Best for: Productivity

### VS Wins
- Tracks: `stats.wins`
- Display: "X wins"
- Best for: Competitive skill

## Responsive Design

**Desktop** (>768px):
- Leaderboard panel: Left side
- Menu buttons: Center
- Friends panel: Right side

**Mobile** (≤768px):
- Stacked layout
- Full width panels
- Reduced max height

## Future Enhancements

Possible additions:
- [ ] Weekly/Monthly leaderboards
- [ ] Personal rank display
- [ ] Click to view player profile
- [ ] Animated rank changes
- [ ] More filter categories (perfect dishes, co-op games, etc.)
- [ ] Pagination for more than 10 players
- [ ] Search functionality

## Testing Checklist

- [x] API endpoint returns correct data
- [x] Filters switch properly
- [x] Top 3 styling applies correctly
- [x] Avatars display properly
- [x] Responsive layout works
- [x] Auto-loads on login
- [x] Guest users excluded from rankings
- [ ] Test with multiple users
- [ ] Test with empty leaderboard
- [ ] Test API error handling

## Notes

- Leaderboard only shows registered users (type === 'account')
- Guest accounts are excluded from rankings
- Data updates after each game completion
- Rankings are calculated server-side for security
