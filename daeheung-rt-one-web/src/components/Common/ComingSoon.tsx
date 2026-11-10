import React from 'react';
import { Box, Typography, Container, Paper } from '@mui/material';
import { Construction as ConstructionIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface UnderDevelopmentProps {
  pageName?: string;
  description?: string;
}

const UnderDevelopment: React.FC<UnderDevelopmentProps> = ({
  pageName,
  description
}) => {
  const { t } = useTranslation();
  const title = pageName ?? t('common.page');
  const desc = description ?? t('common.preparingDesc');
  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          py: 8
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 2,
            backgroundColor: '#f8f9fa'
          }}
        >
          <ConstructionIcon
            sx={{
              fontSize: 80,
              color: '#ff9800',
              mb: 3
            }}
          />
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 600,
              color: '#333',
              mb: 2
            }}
          >
            {t('common.comingSoonTitle')}
          </Typography>
          <Typography
            variant="h6"
            component="h2"
            sx={{
              color: '#666',
              mb: 3,
              fontWeight: 500
            }}
          >
            {title}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: '#888',
              lineHeight: 1.8
            }}
          >
            {desc}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: '#aaa',
              mt: 4,
              fontStyle: 'italic'
            }}
          >
            {t('common.comingSoonMessage')}
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default UnderDevelopment;

