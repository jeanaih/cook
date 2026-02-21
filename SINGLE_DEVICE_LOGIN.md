# Single Device Login Implementation

## Overview
Implemented a single-device login system that prevents users from being logged in on multiple devices simultaneously. When a user logs in from a new device, any existing session on another device is automatically terminated.

## Changes Made

### Server-Side (server.js)

1. **Added Session Tracking**
   - Added `userToSocket` mapping to track which socket ID is associated with each user
   - This allows the server to identify and disconnect previous sessions

2. **Enhanced Login Handlers**
   - Modified `userLogin` handler to check for existing sessions
   - Modified `guestLogin` handler to check for existing sessions
   - When a duplicate login is detected:
     - The previous session receives a `forceLogout` event
     - The previous socket is forcefully disconnected
     - The new session is allowed to proceed

3. **Updated Disconnect Handler**
   - Added cleanup for `userToSocket` mapping when users disconnect
   - Only removes the mapping if the disconnecting socket is the current one for that user
   - Prevents race conditions during session transfers

### Client-Side (public/js/game.js)

1. **Added Force Logout Handler**
   - Listens for `forceLogout` event from server
   - Displays a notification explaining the session was ended
   - Clears stored credentials (localStorage and sessionStorage)
   - Reloads the page after 2 seconds to return to login screen

## How It Works

### Login Flow
1. User attempts to log in (either account or guest)
2. Server checks if `userToSocket[userId]` exists
3. If exists and points to a different socket:
   - Server sends `forceLogout` event to the old socket
   - Server disconnects the old socket
   - Server logs the action
4. Server updates both mappings:
   - `socketToUser[socket.id] = userId`
   - `userToSocket[userId] = socket.id`
5. New session is established

### Disconnect Flow
1. User disconnects (closes browser, network issue, etc.)
2. Server retrieves `userId` from `socketToUser[socket.id]`
3. Server checks if `userToSocket[userId] === socket.id`
4. If true, removes the `userToSocket[userId]` entry
5. Always removes `socketToUser[socket.id]` entry

### Force Logout Flow
1. Old device receives `forceLogout` event
2. Client shows error notification with message
3. Client clears all stored credentials
4. Client reloads page after 2 seconds
5. User sees login screen

## Benefits

- **Security**: Prevents account sharing and unauthorized access
- **Session Management**: Ensures only one active session per user
- **User Experience**: Clear feedback when session is terminated
- **Automatic Cleanup**: Properly handles disconnections and reconnections

## Testing Recommendations

1. **Test Account Login**
   - Log in with an account on Device A
   - Log in with the same account on Device B
   - Verify Device A is logged out automatically

2. **Test Guest Login**
   - Log in as guest on Device A
   - Log in with same guest ID on Device B
   - Verify Device A is logged out automatically

3. **Test Reconnection**
   - Log in on Device A
   - Disconnect (close browser)
   - Log in again on Device A
   - Verify successful login without issues

4. **Test Multiple Users**
   - Log in User 1 on Device A
   - Log in User 2 on Device B
   - Verify both can stay logged in (different users)

## Notes

- Guest sessions are tracked by their session ID stored in sessionStorage
- Account sessions are tracked by their user ID stored in localStorage
- The system works for both registered accounts and guest accounts
- Reconnection to games is still supported (separate from login sessions)
