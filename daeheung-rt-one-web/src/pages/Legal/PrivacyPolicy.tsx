import React from 'react';
import { Box, Typography, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PublicInfoPageLayout from './PublicInfoPageLayout';

const PrivacyPolicy: React.FC = () => {
  const { t } = useTranslation();
  const sections = t('legalPages.privacy.sections', { returnObjects: true }) as Array<{
    title: string;
    paragraphs: string[];
  }>;

  return (
    <PublicInfoPageLayout
      title={t('legalPages.privacy.title')}
      subtitle={t('legalPages.privacy.intro')}
      lastUpdated={t('legalPages.privacy.lastUpdated')}
    >
      <Box sx={{ display: 'grid', gap: 2.5 }}>
        {Array.isArray(sections) &&
          sections.map((section, index) => (
            <Box key={section.title}>
              {index > 0 && <Divider sx={{ mb: 2.5, borderColor: 'divider' }} />}
              <Typography
                component="h2"
                variant="subtitle1"
                sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 1.25 }}
              >
                {section.title}
              </Typography>
              {section.paragraphs.map((paragraph) => (
                <Typography
                  key={paragraph}
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.75, mb: 1.25, whiteSpace: 'pre-line' }}
                >
                  {paragraph}
                </Typography>
              ))}
            </Box>
          ))}
      </Box>
    </PublicInfoPageLayout>
  );
};

export default PrivacyPolicy;
