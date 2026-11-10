import { Router } from 'express';
import { authenticateToken, requireRole, restrictAuditToReadOnly } from '../middleware/auth';
import {
  createCompanyPolicy,
  deleteCompanyPolicy,
  getCompanyPolicy,
  getCompanyPolicyRevision,
  listCompanyPolicies,
  listCompanyPolicyHistory,
  updateCompanyPolicy,
} from '../controllers/companyPolicyController';

const router = Router();

router.use(authenticateToken);

router.get('/', listCompanyPolicies);
router.post(
  '/',
  restrictAuditToReadOnly,
  requireRole(['admin', 'root']),
  createCompanyPolicy
);
router.get('/:key/history', listCompanyPolicyHistory);
router.get('/:key/history/:version', getCompanyPolicyRevision);
router.get('/:key', getCompanyPolicy);
router.put(
  '/:key',
  restrictAuditToReadOnly,
  requireRole(['admin', 'root']),
  updateCompanyPolicy
);
router.delete(
  '/:key',
  restrictAuditToReadOnly,
  requireRole(['admin', 'root']),
  deleteCompanyPolicy
);

export default router;
