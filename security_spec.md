# Quiz Duel — Firestore Security Specification & Red Team Audit

## 1. Data Invariants

1. **Path & Document ID Parity**: Every `/rooms/{roomCode}` document ID must match `^[A-Z0-9]{6}$` and equal `data.roomCode`.
2. **Verified Identity**: Only authenticated Google users with `request.auth.token.email_verified == true` may create or update a room.
3. **No PII Storage**: Only display names (`hostName`, `guestName` <= 64 chars) and UIDs (`hostUid`, `guestUid`) are stored in `/rooms/{roomCode}`; no emails, phone numbers, or addresses are stored.
4. **Strict Schema & Volumetric Bounds**: Every `Room` write must contain all 18 required keys (`hasAll` and `hasOnly`), bounded strings, valid character enums (`dark-ninja`, `reaper`, `samurai`, `knight`), valid status enums (`waiting`, `playing`, `finished`), and `actionLog` bounded to `<= 500` map items.
5. **Action-Based State Transitions & Terminal Lock**:
   - `waiting -> playing`: Only via a Guest Join action (`guestUid` transitions from `""` to `request.auth.uid`).
   - `playing -> playing | finished`: Only by seated participants (`hostUid` or `guestUid`), preserving immutable `roomCode`, `hostUid`, `hostName`, `guestUid`, `seed`, and `createdAt`.
   - `finished -> playing`: Only via an explicit Rematch action that increments `rematchCount` by 1 and resets `winnerSeat` and `forfeitedBySeat` to `0`.
6. **Temporal Integrity**: `createdAt == request.time` on creation (`immutable` on update) and `updatedAt == request.time` on every write.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Shadow Field Injection**: Adding `{"isAdmin": true}` to `/rooms/QD7X9K` — rejected by `data.keys().hasOnly(...)`.
2. **Unverified Email Spoofing**: Calling `create` or `update` with `email_verified: false` — rejected by `isVerifiedUser()`.
3. **Host Identity Spoofing on Create**: Setting `hostUid` to another user's UID — rejected by `incoming().hostUid == request.auth.uid`.
4. **Room ID Poisoning**: Creating `/rooms/invalid_1mb_id...` — rejected by `isValidRoomId(roomCode)`.
5. **Host Hijack on Update**: Modifying `hostUid` or `createdAt` during an update — rejected by immutability gates (`incoming().hostUid == existing().hostUid`).
6. **Third-Party Match Sabotage**: A third user (neither `hostUid` nor `guestUid`) attempting to append actions to an active `'playing'` room — rejected by participant UID check.
7. **Post-Finish Result Tampering**: Attempting to modify `winnerSeat` on a room already in `status == 'finished'` without starting a valid rematch — rejected by terminal state lock.
8. **ActionLog Denial-of-Wallet**: Sending `actionLog` with 5,000 items or non-map primitives — rejected by `data.actionLog.size() <= 500 && (data.actionLog.size() == 0 || data.actionLog[0] is map)`.
9. **Client Timestamp Forgery**: Supplying a past or future `createdAt` or `updatedAt` — rejected by `request.time` equality checks.
10. **Unauthorized Blanket List Scraping**: Querying `/rooms` without filtering by `hostUid == request.auth.uid` or `guestUid == request.auth.uid` — rejected by `allow list` resource check.
11. **Invalid Character Enum Injection**: Supplying `hostCharacter: "wizard"` — rejected by `isValidCharacter()`.
12. **Delete Room Attack**: Attempting to delete a `/rooms/{roomCode}` document from the client — rejected by `allow delete: if false;`.
