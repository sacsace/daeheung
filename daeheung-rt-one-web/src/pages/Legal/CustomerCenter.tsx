import React from 'react';
import {
  Box,
  Typography,
  Divider,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Email as EmailIcon,
  Language as LanguageIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import PublicInfoPageLayout from './PublicInfoPageLayout';

const contactCardSx = {
  p: 2.25,
  borderRadius: '8px',
  border: '1px solid',
  borderColor: 'divider',
  height: '100%',
  bgcolor: 'background.paper',
} as const;

const contactCardsLayoutSx = {
  display: 'flex',
  flexDirection: { xs: 'column', sm: 'row' },
  gap: 2,
  mb: 3,
  '& > *': {
    flex: { xs: '1 1 auto', sm: '1 1 0' },
    minWidth: 0,
  },
} as const;

const CustomerCenter: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const faqItems = t('legalPages.support.faq', { returnObjects: true }) as Array<{
    question: string;
    answer: string;
  }>;

  return (
    <PublicInfoPageLayout
      title={t('legalPages.support.title')}
      subtitle={t('legalPages.support.intro')}
    >
      <Box sx={contactCardsLayoutSx}>
        <Paper elevation={0} sx={contactCardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <EmailIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {t('legalPages.support.emailLabel')}
            </Typography>
          </Box>
          <Typography
            component="a"
            href={`mailto:${t('legalPages.support.emailValue')}`}
            variant="body2"
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              fontWeight: 600,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {t('legalPages.support.emailValue')}
          </Typography>
        </Paper>

        <Paper elevation={0} sx={contactCardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LanguageIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {t('legalPages.support.websiteLabel')}
            </Typography>
          </Box>
          <Typography
            component="a"
            href="https://www.msventures.in"
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              fontWeight: 600,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {t('legalPages.support.websiteValue')}
          </Typography>
        </Paper>

        <Paper elevation={0} sx={contactCardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ScheduleIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {t('legalPages.support.hoursLabel')}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65, whiteSpace: 'pre-line' }}>
            {t('legalPages.support.hoursValue')}
          </Typography>
        </Paper>
      </Box>

      <Divider sx={{ mb: 2.5 }} />

      <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 1.5 }}>
        {t('legalPages.support.faqTitle')}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.isArray(faqItems) &&
          faqItems.map((item) => (
            <Accordion
              key={item.question}
              disableGutters
              elevation={0}
              sx={{
                borderRadius: '8px !important',
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                '&:before': { display: 'none' },
                overflow: 'hidden',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  minHeight: 52,
                  '& .MuiAccordionSummary-content': { my: 1 },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {item.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
      </Box>
    </PublicInfoPageLayout>
  );
};

export default CustomerCenter;
