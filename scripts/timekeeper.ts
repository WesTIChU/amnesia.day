import 'dotenv/config';
import { runTimekeeperProcess } from '../server/db.js';

const result = runTimekeeperProcess();
console.log(`[Amnesia] Timekeeper unlocked ${result.unlockedCount} memories at ${result.runAt}`);
