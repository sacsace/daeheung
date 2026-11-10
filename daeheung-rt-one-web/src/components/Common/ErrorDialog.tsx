import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Collapse,
  Alert
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useErrorStore } from '../../store/errorStore';

const ErrorDialog: React.FC = () => {
  const { t } = useTranslation();
  const { errors, clearErrors } = useErrorStore();
  const [expandedErrors, setExpandedErrors] = React.useState<Set<string>>(new Set());

  if (errors.length === 0) return null;

  const currentError = errors[errors.length - 1];

  const handleClose = () => {
    const redirectTo = currentError.redirectTo;
    clearErrors();
    if (redirectTo && typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
  };

  const toggleExpand = (errorId: string) => {
    setExpandedErrors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(errorId)) {
        newSet.delete(errorId);
      } else {
        newSet.add(errorId);
      }
      return newSet;
    });
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'warning':
        return <WarningIcon sx={{ color: 'warning.main', fontSize: 40 }} />;
      case 'info':
        return <InfoIcon sx={{ color: 'info.main', fontSize: 40 }} />;
      default:
        return <ErrorIcon sx={{ color: 'error.main', fontSize: 40 }} />;
    }
  };

  const getTitleColor = (type?: string) => {
    switch (type) {
      case 'warning':
        return 'warning.main';
      case 'info':
        return 'info.main';
      default:
        return 'error.main';
    }
  };

  const getMessageKey = (message: string): string | null => {
    if (message.includes('Network Error') || message.includes('timeout')) return 'errors.networkError';
    if (message.includes('401') || message.includes('Unauthorized')) return 'errors.needLogin';
    if (message.includes('403') || message.includes('Forbidden')) return 'errors.noPermission';
    if (message.includes('404') || message.includes('Not Found')) return 'errors.notFoundInfo';
    if (message.includes('500') || message.includes('Internal Server Error')) return 'errors.serverTemporary';
    if (message.includes('Validation')) return 'errors.checkInput';
    return null;
  };

  const displayMessage = (message: string): string => {
    const key = getMessageKey(message);
    return key ? t(key) : message;
  };

  return (
    <Dialog
      open={true}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableRestoreFocus
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          pb: 1,
          borderBottom: `2px solid`,
          borderColor: getTitleColor(currentError.type)
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          {getIcon(currentError.type)}
          <Typography variant="h6" sx={{ color: getTitleColor(currentError.type), fontWeight: 600 }}>
            {currentError.title || t('common.notification')}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3, pb: 2 }}>
        <Typography variant="body1" sx={{ mb: 2, color: 'text.primary', lineHeight: 1.6 }}>
          {displayMessage(currentError.message)}
        </Typography>
        
        {currentError.details && (
          <Box>
            <Button
              size="small"
              onClick={() => toggleExpand(currentError.id)}
              endIcon={expandedErrors.has(currentError.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ mb: 1, textTransform: 'none' }}
            >
              {expandedErrors.has(currentError.id) ? t('common.detailHide') : t('common.detailShow')}
            </Button>
            
            <Collapse in={expandedErrors.has(currentError.id)}>
              <Alert severity={currentError.type || 'error'} sx={{ mt: 1 }}>
                <Typography variant="body2" component="pre" sx={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {currentError.details}
                </Typography>
              </Alert>
            </Collapse>
          </Box>
        )}
        
        {errors.length > 1 && (
          <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary' }}>
            {t('common.errorCount', { count: errors.length })} {errors.length > 10 && t('common.errorCountTruncated')}
          </Typography>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleClose}
          variant="contained"
          color={currentError.type === 'warning' ? 'warning' : currentError.type === 'info' ? 'info' : 'error'}
          sx={{ minWidth: 100 }}
        >
          {t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ErrorDialog;


