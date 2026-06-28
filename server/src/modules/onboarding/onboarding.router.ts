import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateBody } from '../../lib/validator';
import { completeOnboardingSchema } from './onboarding.types';
import * as controller from './onboarding.controller';

const router = Router();
router.use(authenticate);

router.get('/campuses', controller.getCampuses);
router.post('/complete', validateBody(completeOnboardingSchema), controller.completeOnboarding);

export default router;
