import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateBody } from '../../shared/validator';
import { createPostSchema, voteSchema } from './posts.types';
import * as controller from './posts.controller';
import commentsRouter from '../comments/comments.router';

const router = Router();
router.use(authenticate);

router.get('/campus', controller.getCampusFeed);
router.get('/global', controller.getGlobalFeed);
router.get('/user/:username', controller.getUserPosts);
router.get('/:id', controller.getPost);
router.post('/', validateBody(createPostSchema), controller.createPost);
router.delete('/:id', controller.deletePost);
router.post('/:id/vote', validateBody(voteSchema), controller.vote);

// Mount comments under /posts/:postId/comments
router.use('/:postId/comments', commentsRouter);

export default router;
