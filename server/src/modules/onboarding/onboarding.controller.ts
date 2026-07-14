import { Request, Response, NextFunction } from 'express';
import * as onboardingService from './onboarding.service';

export async function getCampuses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const campuses = await onboardingService.getCampusesForUser(req.user.email);
    res.json(campuses);
  } catch (err) { next(err); }
}

export async function completeOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await onboardingService.completeOnboarding(
      req.user.userId,
      req.user.email,
      req.user.isAdmin,
      req.body
    );
    res.json(result);
  } catch (err) { next(err); }
}
