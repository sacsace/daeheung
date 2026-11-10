import { Router } from 'express';
import { dispatchHeresnowAttendance } from '../controllers/heresnowIntegrationController';

const router = Router();

/** HeresNow → MVS Push (Webhook) */
router.post('/mvs/dispatch', dispatchHeresnowAttendance);

export default router;
