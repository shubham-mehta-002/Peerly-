import type { Request, Response, NextFunction } from 'express';
import {
  getCommunities, getCommunity, createCommunity,
  updateCommunity, deleteCommunity, joinCommunity,
  leaveCommunity, kickMember, updateMemberRole, transferOwnership,
  getMembers, getMessages, getMemberRole,
} from './communities.service';

export async function getMessagesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const communityId = req.params.id as string;
    const limit = Math.min(Number(req.query.limit) || 30, 50);
    const beforeId = req.query.before as string | undefined;

    // Verify membership before returning messages
    const role = await getMemberRole(communityId, req.user.userId);
    if (!role) {
      res.status(403).json({ error: 'Members only' });
      return;
    }

    const messages = await getMessages(communityId, limit, beforeId);
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.campusId) {
      res.status(403).json({ error: 'Campus not assigned' });
      return;
    }
    const communities = await getCommunities(req.user.campusId, req.user.userId, req.query.search as string | undefined);
    res.json(communities);
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const community = await getCommunity(req.params.id as string, req.user.userId);
    res.json(community);
  } catch (err) {
    next(err);
  }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.campusId) {
      res.status(403).json({ error: 'Campus not assigned' });
      return;
    }
    const community = await createCommunity(req.body, req.user.userId, req.user.campusId);
    res.status(201).json(community);
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const community = await updateCommunity(req.params.id as string, req.body, req.user.userId);
    res.json(community);
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteCommunity(req.params.id as string, req.user.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function joinHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await joinCommunity(req.params.id as string, req.user.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function leaveHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await leaveCommunity(req.params.id as string, req.user.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function kickHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await kickMember(req.params.id as string, req.user.userId, req.params.userId as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function updateRoleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await updateMemberRole(req.params.id as string, req.user.userId, req.params.userId as string, req.body);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function transferOwnershipHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { newOwnerId } = req.body as { newOwnerId: string };
    if (!newOwnerId) { res.status(400).json({ error: 'newOwnerId is required' }); return; }
    await transferOwnership(req.params.id as string, req.user.userId, newOwnerId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getMembersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const members = await getMembers(req.params.id as string, req.user.userId);
    res.json(members);
  } catch (err) {
    next(err);
  }
}
