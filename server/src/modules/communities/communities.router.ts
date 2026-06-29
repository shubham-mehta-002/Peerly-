import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateBody } from '../../shared/validator';
import {
  listHandler, getHandler, createHandler, updateHandler,
  deleteHandler, joinHandler, leaveHandler, kickHandler, updateRoleHandler,
  transferOwnershipHandler, getMembersHandler, getMessagesHandler,
} from './communities.controller';
import { CreateCommunitySchema, UpdateCommunitySchema, UpdateMemberRoleSchema } from './communities.types';

const router = Router();
router.use(authenticate);

router.get('/', listHandler);
router.post('/', validateBody(CreateCommunitySchema), createHandler);
router.get('/:id', getHandler);
router.patch('/:id', validateBody(UpdateCommunitySchema), updateHandler);
router.delete('/:id', deleteHandler);

router.get('/:id/members', getMembersHandler);
router.get('/:id/messages', getMessagesHandler);
router.post('/:id/join', joinHandler);
router.post('/:id/leave', leaveHandler);
router.post('/:id/transfer-ownership', transferOwnershipHandler);
router.delete('/:id/members/:userId', kickHandler);
router.patch('/:id/members/:userId', validateBody(UpdateMemberRoleSchema), updateRoleHandler);

export default router;
